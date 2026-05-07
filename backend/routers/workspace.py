import io
import uuid
import logging
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Response
from PIL import Image, ImageOps
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.database import get_db
from backend.models import User
from backend.models.workspace import Workspace, Panel
from backend.routers.canvas import (
    _validate_external_image_url,
    _get_rembg_session,
    _REMOVE_BG_FETCH_TIMEOUT,
)
from backend.schemas import (
    CanvasAssetUploadResponse,
    PanelCreateRequest,
    PanelMetaUpdate,
    PanelCanvasUpdate,
    PanelResponse,
    PanelPreviewResponse,
    RemoveBgRequest,
    RemoveBgResponse,
    WorkspaceMeta,
    WorkspaceResponse,
    UserSearch,
)
from backend.utils.auth import authenthicate_access_token
from backend.utils.files import check_file_size, validate_image
from backend.utils.image_processing import strip_metadata
from backend.utils.s3 import upload_image_bytes
from backend.utils.rate_limit import limiter, get_user_or_ip_key

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/workspace",
    tags=["Workspace"],
)

_MAX_PNG_SIZE = 15 * 1024 * 1024
_DEFAULT_WORKSPACE_W = 1280
_DEFAULT_WORKSPACE_H = 800
_DEFAULT_PANEL_W = 420
_DEFAULT_PANEL_H = 320
_GRID_STEP = 40
_FALLBACK_POS = (20, 20)


def _ensure_workspace(db: Session, user_id: int) -> Workspace:
    stmt = (
        pg_insert(Workspace)
        .values(user_id=user_id)
        .on_conflict_do_nothing(constraint="uq_workspace_user")
    )
    db.execute(stmt)
    db.commit()
    workspace = db.execute(
        select(Workspace).where(Workspace.user_id == user_id)
    ).scalar_one()
    return workspace


def _list_panels(db: Session, workspace_id: int) -> list[Panel]:
    return (
        db.execute(
            select(Panel)
            .where(Panel.workspace_id == workspace_id)
            .order_by(Panel.z.asc(), Panel.id.asc())
        )
        .scalars()
        .all()
    )


def _build_workspace_response(workspace: Workspace, panels: list[Panel]) -> WorkspaceResponse:
    return WorkspaceResponse(
        workspace=WorkspaceMeta.model_validate(workspace),
        panels=[PanelResponse.model_validate(p) for p in panels],
    )


def _find_grid_spot(panels: list[Panel], w: int, h: int) -> tuple[int, int]:
    """Walk the workspace in row-major order, returning the first axis-aligned slot
    that does not overlap any existing panel. Falls back to a fixed offset when full."""
    max_x = _DEFAULT_WORKSPACE_W - w
    max_y = _DEFAULT_WORKSPACE_H - h
    if max_x < 0 or max_y < 0:
        return _FALLBACK_POS
    y = 0
    while y <= max_y:
        x = 0
        while x <= max_x:
            collide = False
            for p in panels:
                if x < p.x + p.w and x + w > p.x and y < p.y + p.h and y + h > p.y:
                    collide = True
                    break
            if not collide:
                return x, y
            x += _GRID_STEP
        y += _GRID_STEP
    return _FALLBACK_POS


def _get_user_panel(db: Session, user_id: int, panel_id: int) -> Panel:
    panel = db.execute(
        select(Panel)
        .join(Workspace, Workspace.id == Panel.workspace_id)
        .where(Panel.id == panel_id, Workspace.user_id == user_id)
    ).scalar_one_or_none()
    if panel is None:
        raise HTTPException(404, "Panel not found")
    return panel


@router.get("/me", response_model=WorkspaceResponse)
def get_my_workspace(
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    workspace = _ensure_workspace(db, user.user_id)
    panels = _list_panels(db, workspace.id)
    return _build_workspace_response(workspace, panels)


@router.post("/me/panels", response_model=PanelResponse)
def create_panel(
    body: PanelCreateRequest,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    workspace = _ensure_workspace(db, user.user_id)

    if body.rect is not None:
        x, y, w, h = body.rect.x, body.rect.y, body.rect.w, body.rect.h
    elif not body.placed:
        w = body.w if body.w is not None else _DEFAULT_PANEL_W
        h = body.h if body.h is not None else _DEFAULT_PANEL_H
        x, y = 0, 0
    else:
        existing = _list_panels(db, workspace.id)
        w = body.w if body.w is not None else _DEFAULT_PANEL_W
        h = body.h if body.h is not None else _DEFAULT_PANEL_H
        x, y = _find_grid_spot(existing, w, h)

    workspace.z_counter = workspace.z_counter + 1
    panel = Panel(
        workspace_id=workspace.id,
        x=x,
        y=y,
        w=w,
        h=h,
        z=workspace.z_counter,
        placed=body.placed,
        title=body.title,
        accent=body.accent,
    )
    db.add(panel)
    db.commit()
    db.refresh(panel)
    return PanelResponse.model_validate(panel)


@router.patch("/me/panels/{panel_id}", response_model=PanelResponse)
def update_panel_meta(
    panel_id: int,
    body: PanelMetaUpdate,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    panel = _get_user_panel(db, user.user_id, panel_id)
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(panel, field, value)
    db.commit()
    db.refresh(panel)
    return PanelResponse.model_validate(panel)


@router.put("/me/panels/{panel_id}/canvas", response_model=PanelResponse)
@limiter.limit("10/minute", key_func=get_user_or_ip_key)
def save_panel_canvas(
    request: Request,
    panel_id: int,
    body: PanelCanvasUpdate,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    panel = _get_user_panel(db, user.user_id, panel_id)
    panel.canvas_json = body.canvas_json
    db.commit()
    db.refresh(panel)
    return PanelResponse.model_validate(panel)


@router.post("/me/panels/{panel_id}/preview", response_model=PanelPreviewResponse)
@limiter.limit("5/hour", key_func=get_user_or_ip_key)
def upload_panel_preview(
    request: Request,
    panel_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    panel = _get_user_panel(db, user.user_id, panel_id)

    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > _MAX_PNG_SIZE:
        raise HTTPException(413, "Preview image too large")

    png_bytes = file.file.read()
    key = f"canvas_previews/{user.user_id}/panel_{panel.id}/{uuid.uuid4()}.png"
    preview_url = upload_image_bytes(key, png_bytes, "image/png")

    panel.preview_path = preview_url
    db.commit()
    return PanelPreviewResponse(preview_path=preview_url)


@router.delete("/me/panels/{panel_id}", status_code=204)
def delete_panel(
    panel_id: int,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    panel = _get_user_panel(db, user.user_id, panel_id)
    db.delete(panel)
    db.commit()
    return Response(status_code=204)


@router.post("/me/assets", response_model=CanvasAssetUploadResponse)
@limiter.limit("20/hour", key_func=get_user_or_ip_key)
def upload_workspace_asset(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    check_file_size(file)
    validate_image(file)

    contents = file.file.read()
    image = Image.open(io.BytesIO(contents))
    image = ImageOps.exif_transpose(image)

    has_alpha = image.mode in ("RGBA", "LA") or (
        image.mode == "P" and "transparency" in image.info
    )
    image = image.convert("RGBA" if has_alpha else "RGB")
    image = strip_metadata(image)

    buf = io.BytesIO()
    if has_alpha:
        image.save(buf, "PNG", optimize=True)
        ext, content_type = "png", "image/png"
    else:
        image.save(buf, "JPEG", quality=90, optimize=True)
        ext, content_type = "jpg", "image/jpeg"

    key = f"canvas_assets/{user.user_id}/{uuid.uuid4()}.{ext}"
    asset_url = upload_image_bytes(key, buf.getvalue(), content_type)

    return CanvasAssetUploadResponse(asset_url=asset_url)


@router.post("/me/remove-bg", response_model=RemoveBgResponse)
@limiter.limit("10/hour", key_func=get_user_or_ip_key)
def remove_workspace_image_background(
    request: Request,
    body: RemoveBgRequest,
    user: UserSearch = Depends(authenthicate_access_token),
):
    _validate_external_image_url(body.image_url)

    try:
        req = urllib.request.Request(body.image_url, headers={"User-Agent": "PetrCollect/1.0"})
        with urllib.request.urlopen(req, timeout=_REMOVE_BG_FETCH_TIMEOUT) as resp:
            image_bytes = resp.read()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Could not fetch image")

    try:
        from rembg import remove as rembg_remove
        output_bytes = rembg_remove(image_bytes, session=_get_rembg_session())
    except BaseException:
        raise HTTPException(500, "Background removal failed")

    key = f"canvas_assets/{user.user_id}/{uuid.uuid4()}.png"
    processed_url = upload_image_bytes(key, output_bytes, "image/png")

    return RemoveBgResponse(processed_url=processed_url)


@router.get("/{username}", response_model=WorkspaceResponse)
def get_public_workspace(username: str, db: Session = Depends(get_db)):
    db_user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if db_user is None:
        raise HTTPException(404, "User not found")

    workspace = db.execute(
        select(Workspace).where(Workspace.user_id == db_user.id)
    ).scalar_one_or_none()
    if workspace is None:
        raise HTTPException(404, "Workspace not found")

    panels = (
        db.execute(
            select(Panel)
            .where(Panel.workspace_id == workspace.id, Panel.placed == True)  # noqa: E712
            .order_by(Panel.z.asc(), Panel.id.asc())
        )
        .scalars()
        .all()
    )
    return _build_workspace_response(workspace, panels)
