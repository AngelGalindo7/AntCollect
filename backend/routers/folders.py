from fastapi import Depends, HTTPException, APIRouter, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, func, literal
from ..database import get_db
from backend.models import User, Post, PostLike, PostImage, MediaAsset, Folder, FolderPost
from ..schemas import (
    FolderCreate,
    FolderUpdate,
    FolderResponse,
    AddPostToFolderRequest,
    FolderWithPostsResponse,
    PostBase,
)
from ..utils.auth import authenthicate_access_token, optional_auth_token
from ..utils.files import process_and_save_image, delete_file
from ..utils.posts_creation import create_post_with_images
from ..utils.rate_limit import limiter, get_user_or_ip_key
from ..schemas import UserSearch
from typing import List

MAX_IMAGES_PER_POST = 5

router = APIRouter(
    prefix="/folders",
    tags=["Folders"],
)


def _get_preview_images_for_folders(db: Session, folder_ids: List[int]) -> dict[int, List[str]]:
    """Top 4 thumbnails per folder, ranked by FolderPost.order_index then by PostImage.order_index."""
    if not folder_ids:
        return {}

    fp_ranked = (
        select(
            FolderPost.folder_id,
            FolderPost.post_id,
            FolderPost.order_index.label("fp_order"),
            func.row_number()
            .over(partition_by=FolderPost.folder_id, order_by=FolderPost.order_index)
            .label("rn"),
        )
        .where(FolderPost.folder_id.in_(folder_ids))
        .subquery()
    )

    pi_ranked = (
        select(
            PostImage.post_id,
            MediaAsset.json_metadata.label("meta"),
            func.row_number()
            .over(partition_by=PostImage.post_id, order_by=PostImage.order_index)
            .label("img_rn"),
        )
        .join(MediaAsset, MediaAsset.id == PostImage.asset_id)
        .subquery()
    )

    rows = db.execute(
        select(
            fp_ranked.c.folder_id,
            fp_ranked.c.fp_order,
            pi_ranked.c.meta,
        )
        .join(pi_ranked, pi_ranked.c.post_id == fp_ranked.c.post_id)
        .where(fp_ranked.c.rn <= 4, pi_ranked.c.img_rn == 1)
        .order_by(fp_ranked.c.folder_id, fp_ranked.c.fp_order)
    ).all()

    out: dict[int, List[str]] = {fid: [] for fid in folder_ids}
    for folder_id, _fp_order, meta in rows:
        if isinstance(meta, dict):
            thumb = meta.get("paths", {}).get("thumbnail")
            if thumb:
                out[folder_id].append(thumb)
    return out


def _folder_response_with_preview(db: Session, row) -> FolderResponse:
    resp = FolderResponse.model_validate(row)
    resp.preview_images = _get_preview_images_for_folders(db, [row.id]).get(row.id, [])
    return resp


@router.post("", response_model=FolderResponse)
def create_folder(
    payload: FolderCreate,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    folder = Folder(
        user_id=user.user_id,
        name=payload.name,
        description=payload.description,
        is_public=payload.is_public,
        folder_type=payload.folder_type,
    )
    db.add(folder)
    db.flush()
    db.commit()
    db.refresh(folder)

    post_count_subquery = (
        select(func.count(FolderPost.id))
        .where(FolderPost.folder_id == folder.id)
        .scalar_subquery()
    )
    row = db.execute(
        select(
            Folder.id,
            Folder.user_id,
            Folder.name,
            Folder.description,
            Folder.cover_post_id,
            Folder.avatar_path,
            Folder.is_public,
            Folder.folder_type,
            Folder.created_at,
            Folder.updated_at,
            post_count_subquery.label("post_count"),
        ).where(Folder.id == folder.id)
    ).one()
    return _folder_response_with_preview(db, row)


# Static route MUST come before /{folder_id} to avoid shadowing.
@router.get("/user/{username}", response_model=List[FolderResponse])
@limiter.limit("30/minute;200/hour", key_func=get_user_or_ip_key)
def list_user_folders(
    request: Request,
    username: str,
    db: Session = Depends(get_db),
    user: UserSearch | None = Depends(optional_auth_token),
):
    target_user = db.query(User).filter(User.username == username).first()
    if not target_user:
        return []  # Don't leak user existence via 404

    is_owner = (user is not None) and (user.user_id == target_user.id)

    post_count_subquery = (
        select(func.count(FolderPost.id))
        .where(FolderPost.folder_id == Folder.id)
        .scalar_subquery()
    )

    query = select(
        Folder.id,
        Folder.user_id,
        Folder.name,
        Folder.description,
        Folder.cover_post_id,
        Folder.avatar_path,
        Folder.is_public,
        Folder.folder_type,
        Folder.created_at,
        Folder.updated_at,
        post_count_subquery.label("post_count"),
    ).where(Folder.user_id == target_user.id)

    if not is_owner:
        query = query.where(Folder.is_public == True)

    rows = db.execute(query).all()
    previews = _get_preview_images_for_folders(db, [row.id for row in rows])
    out: List[FolderResponse] = []
    for row in rows:
        resp = FolderResponse.model_validate(row)
        resp.preview_images = previews.get(row.id, [])
        out.append(resp)
    return out


@router.get("/{folder_id}", response_model=FolderWithPostsResponse)
@limiter.limit("30/minute;200/hour", key_func=get_user_or_ip_key)
def get_folder(
    request: Request,
    folder_id: int,
    db: Session = Depends(get_db),
    user: UserSearch | None = Depends(optional_auth_token),
):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    is_owner = (user is not None) and (user.user_id == folder.user_id)

    if not folder.is_public and not is_owner:
        raise HTTPException(status_code=403, detail="Forbidden")

    likes_subquery = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id)
        .scalar_subquery()
    )
    if user is not None:
        existing_like_subquery = (
            select(func.count(PostLike.id))
            .where(PostLike.post_id == Post.id, PostLike.user_id == user.user_id)
            .scalar_subquery()
        )
    else:
        existing_like_subquery = select(literal(0)).scalar_subquery()

    posts_query = (
        select(
            Post.id.label("post_id"),
            Post.caption,
            Post.public,
            Post.is_published,
            Post.type,
            Post.updated_at,
            func.array_agg(
                MediaAsset.json_metadata, order_by=PostImage.order_index
            ).label("images"),
            likes_subquery.label("total_likes"),
            existing_like_subquery.label("is_liked"),
            User.id.label("user_user_id"),
            User.username.label("user_username"),
            User.avatar_path.label("user_avatar_path"),
        )
        .join(User, Post.user_id == User.id)
        .join(FolderPost, Post.id == FolderPost.post_id)
        .outerjoin(PostImage, Post.id == PostImage.post_id)
        .outerjoin(MediaAsset, PostImage.asset_id == MediaAsset.id)
        .where(FolderPost.folder_id == folder_id)
        .group_by(Post.id, FolderPost.order_index, User.id)
        .order_by(FolderPost.order_index)
    )

    if not is_owner:
        posts_query = posts_query.where(Post.public == True, Post.is_published == True)

    post_rows = db.execute(posts_query).all()

    posts = []
    for row in post_rows:
        row_dict = row._asdict()
        row_dict["user"] = {
            "user_id": row_dict.pop("user_user_id"),
            "username": row_dict.pop("user_username"),
            "avatar_path": row_dict.pop("user_avatar_path"),
        }
        posts.append(PostBase.model_validate(row_dict))

    return FolderWithPostsResponse(
        id=folder.id,
        user_id=folder.user_id,
        name=folder.name,
        description=folder.description,
        cover_post_id=folder.cover_post_id,
        avatar_path=folder.avatar_path,
        is_public=folder.is_public,
        folder_type=folder.folder_type,
        posts=posts,
    )


@router.patch("/{folder_id}", response_model=FolderResponse)
def update_folder(
    folder_id: int,
    payload: FolderUpdate,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if payload.name is not None:
        folder.name = payload.name
    if payload.description is not None:
        folder.description = payload.description
    if payload.is_public is not None:
        folder.is_public = payload.is_public
    if payload.cover_post_id is not None:
        cover_post = db.query(Post).filter(Post.id == payload.cover_post_id).first()
        if not cover_post or cover_post.user_id != user.user_id:
            raise HTTPException(status_code=404, detail="Cover post not found or not owned by you")
        folder.cover_post_id = payload.cover_post_id
    if payload.folder_type is not None:
        folder.folder_type = payload.folder_type

    db.commit()
    db.refresh(folder)

    post_count_subquery = (
        select(func.count(FolderPost.id))
        .where(FolderPost.folder_id == folder.id)
        .scalar_subquery()
    )
    row = db.execute(
        select(
            Folder.id,
            Folder.user_id,
            Folder.name,
            Folder.description,
            Folder.cover_post_id,
            Folder.avatar_path,
            Folder.is_public,
            Folder.folder_type,
            Folder.created_at,
            Folder.updated_at,
            post_count_subquery.label("post_count"),
        ).where(Folder.id == folder.id)
    ).one()
    return _folder_response_with_preview(db, row)


@router.post("/{folder_id}/avatar", response_model=FolderResponse)
@limiter.limit("5/hour", key_func=get_user_or_ip_key)
def upload_folder_avatar(
    request: Request,
    folder_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    old_avatar = folder.avatar_path
    result = process_and_save_image(file, user.user_id)
    folder.avatar_path = result["paths"]["thumbnail"]
    db.commit()

    if old_avatar:
        delete_file(old_avatar)

    post_count_subquery = (
        select(func.count(FolderPost.id))
        .where(FolderPost.folder_id == folder.id)
        .scalar_subquery()
    )
    row = db.execute(
        select(
            Folder.id,
            Folder.user_id,
            Folder.name,
            Folder.description,
            Folder.cover_post_id,
            Folder.avatar_path,
            Folder.is_public,
            Folder.folder_type,
            Folder.created_at,
            Folder.updated_at,
            post_count_subquery.label("post_count"),
        ).where(Folder.id == folder.id)
    ).one()
    return _folder_response_with_preview(db, row)


@router.delete("/{folder_id}", status_code=204)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    db.delete(folder)
    db.commit()


@router.post("/{folder_id}/posts", status_code=201)
def add_post_to_folder(
    folder_id: int,
    payload: AddPostToFolderRequest,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    post = db.query(Post).filter(Post.id == payload.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    max_order = db.execute(
        select(func.coalesce(func.max(FolderPost.order_index), 0)).where(
            FolderPost.folder_id == folder_id
        )
    ).scalar()

    folder_post = FolderPost(
        folder_id=folder_id,
        post_id=payload.post_id,
        order_index=max_order + 1,
    )
    db.add(folder_post)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Post already in folder")

    return {"folder_id": folder_id, "post_id": payload.post_id, "order_index": max_order + 1}


@router.delete("/{folder_id}/posts/{post_id}", status_code=204)
def remove_post_from_folder(
    folder_id: int,
    post_id: int,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    entry = (
        db.query(FolderPost)
        .filter(FolderPost.folder_id == folder_id, FolderPost.post_id == post_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Post not in folder")

    db.delete(entry)
    db.commit()


@router.post("/{folder_id}/upload", status_code=201)
@limiter.limit("100/hour", key_func=get_user_or_ip_key)
def upload_stickers_to_folder(
    request: Request,
    folder_id: int,
    files: list[UploadFile] = File(...),
    is_published: bool = Form(True),
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > MAX_IMAGES_PER_POST:
        raise HTTPException(
            status_code=400,
            detail=f"Too many images (max {MAX_IMAGES_PER_POST} per post)",
        )

    folder = (
        db.query(Folder)
        .filter(Folder.id == folder_id)
        .with_for_update()
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    if folder.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    max_order = db.execute(
        select(func.coalesce(func.max(FolderPost.order_index), 0)).where(
            FolderPost.folder_id == folder_id
        )
    ).scalar() or 0

    all_created_files: list[str] = []

    try:
        post = create_post_with_images(
            db,
            user_id=user.user_id,
            caption=None,
            post_type=folder.folder_type,
            is_published=is_published,
            files=files,
            created_paths_sink=all_created_files,
        )
        db.add(
            FolderPost(
                folder_id=folder_id,
                post_id=post.id,
                order_index=max_order + 1,
            )
        )

        db.commit()
        return {
            "folder_id": folder_id,
            "post_id": post.id,
            "image_count": len(files),
        }

    except HTTPException:
        db.rollback()
        for path in all_created_files:
            try:
                delete_file(path)
            except Exception:
                pass
        raise
    except Exception as e:
        db.rollback()
        for path in all_created_files:
            try:
                delete_file(path)
            except Exception:
                pass
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during upload: {e}",
        )
