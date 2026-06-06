import base64
import binascii
import logging
from fastapi import UploadFile, File, Depends, Form, HTTPException, APIRouter, Request, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, select, desc, tuple_, literal, or_
from backend.database import get_db
from backend.models import PostImage, User, Post, PostLike, PostComment, EngagementLog, EngagementType, MediaAsset, Folder, FolderPost
from backend.schemas import TopPostsResponse, PostWithEngagement, LikeImageRequest, UserSearch
from ..utils.files import delete_file, process_and_save_image
from ..utils.posts_creation import create_post_with_images
from ..utils.auth import authenthicate_access_token, optional_auth_token
from ..utils.rate_limit import limiter, get_user_or_ip_key
from ..utils.permissions import can_delete_post, is_acting_as_moderator
from ..utils.audit import log_admin_action

logger = logging.getLogger(__name__)

MAX_IMAGES_PER_POST = 5

router = APIRouter(
    prefix="/posts",
    tags=["Posts"]
)



@router.post("/upload-post")
@limiter.limit("10/hour", key_func=get_user_or_ip_key)
def upload_post(
    request: Request,
    caption: str | None = Form(None),
    post_type: str=Form(...),
    is_published: bool = Form(True),
    post_images: list[UploadFile] = File(...),
    current_user: UserSearch = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
    ):
     
    user_id = current_user.user_id

    if not post_images:
        raise HTTPException(status_code=400, detail="No images provided")
    if len(post_images) > MAX_IMAGES_PER_POST:
        raise HTTPException(
            status_code=400,
            detail=f"Too many images (max {MAX_IMAGES_PER_POST} per post)",
        )

    all_created_files: list[str] = []

    try:
        post = create_post_with_images(
            db,
            user_id=user_id,
            caption=caption,
            post_type=post_type,
            is_published=is_published,
            files=post_images,
            created_paths_sink=all_created_files,
        )
        db.commit()
        db.refresh(post)
        return {
        "post_id": str(post.id),
        "message": "Upload successful"
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
        logger.error("post upload failed", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred during upload"
        )
@router.post("/like_image")
def like_image(
    request: LikeImageRequest, 
    user: UserSearch = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
):


    existing_like = (
        db.query(PostLike)
        .filter(
            PostLike.user_id==user.user_id,
            PostLike.post_id==request.post_id
        )
        .first()
    )

    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {
            "message":"Unliked",
            "liked":False
        }

    new_like = PostLike(
    post_id=request.post_id,
    user_id =user.user_id
    )

    new_engagement = EngagementLog(
        post_id=request.post_id,
        user_id=user.user_id,
        event_type=EngagementType.like
    )

    try:
        db.add(new_like)
        db.add(new_engagement)
        db.commit()
        db.refresh(new_like)

        return {
            "like_id":new_like.id,
            "message":"Liked",
            "liked":True
            }
    #Catches race condition where simultaneous try to like 
    except IntegrityError:
        db.rollback()
        #The row must have been created in the other request
        return {
            "message":"Liked",
            "liked":True
            }

def _encode_feed_cursor(engagement: int, post_id: int) -> str:
    raw = f"{engagement}:{post_id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_feed_cursor(cursor: str) -> tuple[int, int]:
    padding = "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode((cursor + padding).encode()).decode()
    eng_str, id_str = raw.split(":", 1)
    return int(eng_str), int(id_str)


@router.get("/top", response_model=TopPostsResponse)
@limiter.limit("30/minute;200/hour", key_func=get_user_or_ip_key)
def get_top_posts(
    request: Request,
    limit: int = 20,
    cursor: str | None = None,
    db: Session = Depends(get_db),
    current_user: UserSearch | None = Depends(optional_auth_token),
):
    limit = min(max(limit, 1), 50)

    cursor_eng: int | None = None
    cursor_post_id: int | None = None
    if cursor:
        try:
            cursor_eng, cursor_post_id = _decode_feed_cursor(cursor)
        except (ValueError, binascii.Error, UnicodeDecodeError):
            raise HTTPException(status_code=422, detail="Invalid cursor")

    author = aliased(User)

    if current_user is not None:
        existing_like_subquery = (
            select(func.count(PostLike.id))
            .where(
                PostLike.post_id == Post.id,
                PostLike.user_id == current_user.user_id,
            )
            .scalar_subquery()
        )
    else:
        existing_like_subquery = select(literal(0)).scalar_subquery()

    likes_subquery = (
        select(func.coalesce(func.count(PostLike.id), 0))
        .where(PostLike.post_id == Post.id)
        .scalar_subquery()
    )

    engagement_count = func.coalesce(func.count(EngagementLog.id), 0)

    in_private_folder = (
        select(literal(1))
        .select_from(FolderPost)
        .join(Folder, Folder.id == FolderPost.folder_id)
        .where(
            FolderPost.post_id == Post.id,
            Folder.is_public == False,
        )
        .exists()
    )

    # A post is visible if it is public, or the viewer owns it.
    # Guests see only explicitly public posts.
    post_visibility = (
        or_(Post.public == True, Post.user_id == current_user.user_id)
        if current_user is not None
        else (Post.public == True)
    )

    ranking_subquery = (
        select(
            Post.id.label("id"),
            engagement_count.label("engagement_count"),
        )
        .outerjoin(EngagementLog, Post.id == EngagementLog.post_id)
        .where(
            Post.is_published == True,
            post_visibility,
        )
        .group_by(Post.id)
    )

    if cursor_eng is not None:
        ranking_subquery = ranking_subquery.having(
            tuple_(engagement_count, Post.id) < tuple_(literal(cursor_eng), literal(cursor_post_id))
        )

    ranking_subquery = (
        ranking_subquery
        .order_by(engagement_count.desc(), Post.id.desc())
        .limit(limit + 1)
        .subquery()
    )

    final_query = (
        select(
            Post.id.label("post_id"),
            Post.caption,
            Post.public,
            Post.is_published,
            Post.type,
            Post.updated_at,
            ranking_subquery.c.engagement_count.label("total_engagement"),
            func.array_agg(
                MediaAsset.json_metadata,
                order_by=PostImage.order_index,
            ).label("images"),
            likes_subquery.label("total_likes"),
            existing_like_subquery.label("is_liked"),
            author.id.label("user_user_id"),
            author.username.label("user_username"),
            author.avatar_path.label("user_avatar_path"),
        )
        .join(ranking_subquery, Post.id == ranking_subquery.c.id)
        .outerjoin(author, Post.user_id == author.id)
        .outerjoin(PostImage, Post.id == PostImage.post_id)
        .outerjoin(MediaAsset, PostImage.asset_id == MediaAsset.id)
        .group_by(Post.id, ranking_subquery.c.engagement_count, author.id, author.username, author.avatar_path)
        .order_by(ranking_subquery.c.engagement_count.desc(), Post.id.desc())
    )

    rows = db.execute(final_query).mappings().all()

    has_more = len(rows) > limit
    page_rows = rows[:limit]

    posts = []
    for row in page_rows:
        post_author = {
            "user_id": row["user_user_id"],
            "username": row["user_username"],
            "avatar_path": row["user_avatar_path"],
        } if row["user_user_id"] else None

        post_data = {
            "post_id": row["post_id"],
            "caption": row["caption"],
            "public": row["public"],
            "is_published": row["is_published"],
            "type": row["type"],
            "updated_at": row["updated_at"],
            "total_engagement": row["total_engagement"],
            "images": row["images"],
            "total_likes": row["total_likes"],
            "is_liked": (row["is_liked"] > 0 if row["is_liked"] is not None else False) if current_user else False,
            "user": post_author,
        }
        posts.append(PostWithEngagement.model_validate(post_data))

    next_cursor: str | None = None
    if has_more and page_rows:
        last = page_rows[-1]
        next_cursor = _encode_feed_cursor(int(last["total_engagement"]), int(last["post_id"]))

    return TopPostsResponse(
        total_returned=len(posts),
        k_value=limit,
        posts=posts,
        next_cursor=next_cursor,
    )


@router.post("/comment_post")
@limiter.limit("30/hour", key_func=get_user_or_ip_key)
def comment(
    request: Request,
    post_id: int,
    content: str = Query(..., min_length=1, max_length=2000),
    user: UserSearch = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
):

    new_comment = PostComment(
        post_id=post_id,
        user_id=user.user_id,
        content=content,
    )

    new_engagement = EngagementLog(
        post_id=post_id,
        user_id=user.user_id,
        event_type=EngagementType.comment
    )
    db.add(new_comment)
    db.add(new_engagement)
    db.commit()
    db.refresh(new_comment)

    return {
        "comment_id": new_comment.id,
        "message": "Successfully commented"}


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    current_user: UserSearch = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if not can_delete_post(current_user, post):
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")

    if is_acting_as_moderator(current_user, post):
        log_admin_action(
            current_user,
            "post_deleted",
            target_type="post",
            target_id=post.id,
            owner_id=post.user_id,
        )

    # 1. Collect all media assets associated with this post
    # We do this before deleting the post because deleting the post will cascade-delete the PostImage records
    post_images = db.query(PostImage).filter(PostImage.post_id == post_id).all()
    media_assets = [pi.asset for pi in post_images if pi.asset]

    # 2. Delete the post (this will cascade to PostImage, PostLike, PostComment, EngagementLog, etc.)
    db.delete(post)

    # 3. Cleanup files and MediaAsset records
    # Since each post upload currently creates unique MediaAsset records, it's safe to delete them here.
    for asset in media_assets:
        if asset.json_metadata and "paths" in asset.json_metadata:
            paths = asset.json_metadata["paths"]
            for path in paths.values():
                try:
                    delete_file(path)
                except Exception as e:
                    logger.error(f"Failed to delete file {path}: {e}")
        
        db.delete(asset)

    db.commit()
    return {"message": "Post deleted successfully"}
    
