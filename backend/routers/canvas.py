import uuid
import logging
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.database import get_db
from backend.models import User
from backend.models.canvas import UserCanvas
from backend.schemas import CanvasSaveRequest, CanvasResponse, CanvasPreviewResponse, CanvasAssetUploadResponse, RemoveBgRequest, RemoveBgResponse, UserSearch
from backend.utils.auth import authenthicate_access_token
from backend.utils.files import check_file_size, validate_image
from backend.utils.s3 import upload_image_bytes
from backend.utils.rate_limit import limiter, get_user_or_ip_key

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/canvas",
    tags=["Canvas"]
)

_MAX_PNG_SIZE = 15 * 1024 * 1024  # 15 MB ceiling for exported canvas PNG

# Cached rembg session — loaded once on first use, reused for all subsequent requests.
# u2netp is ~4.7 MB vs ~170 MB for u2net and 3-4x faster on CPU at acceptable quality.
_rembg_session = None

def _get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        try:
            from rembg import new_session
            _rembg_session = new_session("u2netp")
        except BaseException as exc:
            raise RuntimeError("rembg unavailable") from exc
    return _rembg_session


@router.get("/me", response_model=CanvasResponse)
def get_my_canvas(
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    row = db.execute(
        select(UserCanvas).where(UserCanvas.user_id == user.user_id)
    ).scalar_one_or_none()

    if row is None:
        return CanvasResponse()
    return CanvasResponse(canvas_json=row.canvas_json, preview_path=row.preview_path)


@router.put("/me", response_model=CanvasResponse)
@limiter.limit("10/minute", key_func=get_user_or_ip_key)
def save_my_canvas(
    request: Request,
    body: CanvasSaveRequest,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    stmt = (
        pg_insert(UserCanvas)
        .values(user_id=user.user_id, canvas_json=body.canvas_json)
        .on_conflict_do_update(
            constraint="uq_user_canvas",
            set_={
                "canvas_json": body.canvas_json,
                "updated_at": UserCanvas.updated_at,
            },
        )
        .returning(UserCanvas.canvas_json, UserCanvas.preview_path)
    )
    result = db.execute(stmt).fetchone()
    db.commit()
    return CanvasResponse(canvas_json=result.canvas_json, preview_path=result.preview_path)


@router.post("/me/preview", response_model=CanvasPreviewResponse)
@limiter.limit("5/hour", key_func=get_user_or_ip_key)
def upload_canvas_preview(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    # Size check — no PIL processing; the PNG is already rendered by the client
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > _MAX_PNG_SIZE:
        raise HTTPException(413, "Preview image too large")

    png_bytes = file.file.read()
    key = f"canvas_previews/{user.user_id}/{uuid.uuid4()}.png"
    preview_url = upload_image_bytes(key, png_bytes, "image/png")

    row = db.execute(
        select(UserCanvas).where(UserCanvas.user_id == user.user_id)
    ).scalar_one_or_none()

    if row is None:
        db.add(UserCanvas(user_id=user.user_id, preview_path=preview_url))
    else:
        row.preview_path = preview_url

    db.commit()
    return CanvasPreviewResponse(preview_path=preview_url)


@router.post("/me/assets", response_model=CanvasAssetUploadResponse)
@limiter.limit("20/hour", key_func=get_user_or_ip_key)
def upload_canvas_asset(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    check_file_size(file)
    validate_image(file)

    contents = file.file.read()
    key = f"canvas_assets/{user.user_id}/{uuid.uuid4()}.jpg"
    asset_url = upload_image_bytes(key, contents, file.content_type or "image/jpeg")

    return CanvasAssetUploadResponse(asset_url=asset_url)


@router.post("/me/remove-bg", response_model=RemoveBgResponse)
@limiter.limit("10/hour", key_func=get_user_or_ip_key)
def remove_image_background(
    request: Request,
    body: RemoveBgRequest,
    user: UserSearch = Depends(authenthicate_access_token),
):
    try:
        req = urllib.request.Request(body.image_url, headers={"User-Agent": "PetrCollect/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            image_bytes = resp.read()
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


@router.get("/{username}/preview", response_model=CanvasPreviewResponse)
def get_public_canvas_preview(username: str, db: Session = Depends(get_db)):
    db_user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if db_user is None:
        raise HTTPException(404, "User not found")

    row = db.execute(
        select(UserCanvas).where(UserCanvas.user_id == db_user.id)
    ).scalar_one_or_none()

    if row is None or row.preview_path is None:
        raise HTTPException(404, "No canvas preview for this user")

    return CanvasPreviewResponse(preview_path=row.preview_path)
