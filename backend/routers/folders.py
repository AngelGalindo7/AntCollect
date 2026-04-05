from fastapi import Depends, HTTPException, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, func
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
from ..utils.auth import authenthicate_access_token
from ..schemas import UserSearch
from typing import List

router = APIRouter(
    prefix="/folders",
    tags=["Folders"],
)


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
            Folder.is_public,
            Folder.created_at,
            Folder.updated_at,
            post_count_subquery.label("post_count"),
        ).where(Folder.id == folder.id)
    ).one()
    return FolderResponse.model_validate(row)


# Static route MUST come before /{folder_id} to avoid shadowing.
@router.get("/user/{username}", response_model=List[FolderResponse])
def list_user_folders(
    username: str,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    target_user = db.query(User).filter(User.username == username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    is_owner = user.user_id == target_user.id

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
        Folder.is_public,
        Folder.created_at,
        Folder.updated_at,
        post_count_subquery.label("post_count"),
    ).where(Folder.user_id == target_user.id)

    if not is_owner:
        query = query.where(Folder.is_public == True)

    rows = db.execute(query).all()
    return [FolderResponse.model_validate(row) for row in rows]


@router.get("/{folder_id}", response_model=FolderWithPostsResponse)
def get_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token),
):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    is_owner = user.user_id == folder.user_id

    if not folder.is_public and not is_owner:
        raise HTTPException(status_code=403, detail="Forbidden")

    likes_subquery = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id)
        .scalar_subquery()
    )
    existing_like_subquery = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id, PostLike.user_id == user.user_id)
        .scalar_subquery()
    )

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
        )
        .join(FolderPost, Post.id == FolderPost.post_id)
        .outerjoin(PostImage, Post.id == PostImage.post_id)
        .outerjoin(MediaAsset, PostImage.asset_id == MediaAsset.id)
        .where(FolderPost.folder_id == folder_id)
        .group_by(Post.id, FolderPost.order_index)
        .order_by(FolderPost.order_index)
    )

    if not is_owner:
        posts_query = posts_query.where(Post.public == True, Post.is_published == True)

    post_rows = db.execute(posts_query).all()

    return FolderWithPostsResponse(
        id=folder.id,
        user_id=folder.user_id,
        name=folder.name,
        description=folder.description,
        cover_post_id=folder.cover_post_id,
        is_public=folder.is_public,
        posts=[PostBase.model_validate(row) for row in post_rows],
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
            Folder.is_public,
            Folder.created_at,
            Folder.updated_at,
            post_count_subquery.label("post_count"),
        ).where(Folder.id == folder.id)
    ).one()
    return FolderResponse.model_validate(row)


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
