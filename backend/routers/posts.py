import logging
from fastapi import UploadFile, File, Depends, Form, HTTPException, APIRouter, Request
from sqlalchemy.orm import Session, aliased
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, select, desc
from backend.database import get_db
from backend.models import PostImage, User, Post, PostLike, PostComment, EngagementLog, EngagementType, MediaAsset
from backend.models.media_assets import AssetStatus
from backend.schemas import TopPostsResponse, PostWithEngagement, LikeImageRequest, UserSearch
from ..utils.files import delete_file, process_and_save_image
from ..utils.auth import authenthicate_access_token
from ..utils.rate_limit import limiter, get_user_or_ip_key

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/posts",
    tags=["Posts"]
)



@router.post("/upload-post")
@limiter.limit("10/hour", key_func=get_user_or_ip_key)
def upload_post(
    request: Request,
    caption: str=Form(...),
    post_type: str=Form(...),
    is_published: bool = Form(True),
    post_images: list[UploadFile] = File(...),
    current_user: User = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
    ):
     
    user_id = current_user.user_id
    image_records = []
    all_created_files = []

    try:
        post = Post(
        user_id=user_id,
        caption=caption,
        type=post_type,
        is_published=is_published
    )   
        db.add(post)
        db.flush()
        for i, image in enumerate(post_images):
            image_data = process_and_save_image(image, user_id)
            all_created_files.extend(image_data["paths"].values())
            
            asset = MediaAsset(
                uploader_id=user_id,
                file_url=image_data["paths"]["original"],
                s3_key=f"posts/{user_id}/original/{image_data['filename']}",
                json_metadata={
                    "paths": {
                        "thumbnail": image_data["paths"]["thumbnail"],
                        "medium":    image_data["paths"]["medium"],
                        "original":  image_data["paths"]["original"]
                    },
                    "original_width":  image_data["dimensions"]["original"]["width"],
                    "original_height": image_data["dimensions"]["original"]["height"]
                },
                status=AssetStatus.ATTACHED
            )
            db.add(asset)
            db.flush()

            post_image = PostImage(
                post_id=post.id,
                order_index=i + 1,
                asset_id=asset.id
            )
            image_records.append(post_image)
        
        db.add_all(image_records)
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
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during upload: {e}"
        )
@router.post("/like_image")
def like_image(
    request: LikeImageRequest, 
    user: User = Depends(authenthicate_access_token),
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

@router.get("/top", response_model=TopPostsResponse)
def get_top_posts(k: int = 10, db: Session = Depends(get_db), current_user: UserSearch = Depends(authenthicate_access_token)):
    k = min(max(k, 1), 100)

    author = aliased(User)

    existing_like_subquery = (
    select(func.count(PostLike.id))
    .where(
        PostLike.post_id == Post.id,
        PostLike.user_id == current_user.user_id  # current user from auth token
    )
    .scalar_subquery()
    )

    likes_subquery = (
        select(func.coalesce(func.count(PostLike.id),0))
        .where(PostLike.post_id == Post.id)
        .scalar_subquery()
    )
    top_posts_subquery = (
        select(Post.id.label("id"),
               func.count(EngagementLog.id).label("engagement_count")
               )
               .outerjoin(EngagementLog, Post.id == EngagementLog.post_id)
               .where(Post.public == True, Post.is_published == True)
               .group_by(Post.id)
               .order_by(func.coalesce(func.count(EngagementLog.id),0).desc())
               .limit(k)
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
            top_posts_subquery.c.engagement_count.label("total_engagement"),
            func.array_agg(
                MediaAsset.json_metadata,
                order_by=PostImage.order_index
                ).label("images"),
            likes_subquery.label("total_likes"),
            existing_like_subquery.label("is_liked"),
            author.id.label("user_user_id"),
            author.username.label("user_username"),
            author.avatar_path.label("user_avatar_path"),
    )
    .join(top_posts_subquery, Post.id == top_posts_subquery.c.id)
    .outerjoin(author, Post.user_id == author.id)
    .outerjoin(PostImage, Post.id == PostImage.post_id)
    .outerjoin(MediaAsset, PostImage.asset_id == MediaAsset.id)
    .group_by(Post.id, top_posts_subquery.c.engagement_count, author.id, author.username, author.avatar_path)
    .order_by(top_posts_subquery.c.engagement_count.desc())
    )

    results = db.execute(final_query).mappings().all()

    posts = []
    for row in results:
        # Construct the user object explicitly as a dict for the response model
        post_author = {
            "user_id": row["user_user_id"],
            "username": row["user_username"],
            "avatar_path": row["user_avatar_path"]
        } if row["user_user_id"] else None

        # Build the post dict to match PostWithEngagement
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
            "is_liked": row["is_liked"] > 0 if row["is_liked"] is not None else False,
            "user": post_author
        }

        posts.append(PostWithEngagement.model_validate(post_data))

    return TopPostsResponse(
        total_returned=len(posts),
        k_value=k,
        posts=posts,
    )


@router.post("/comment_post")
def comment(
    post_id: int,
    content: str,
    user: User = Depends(authenthicate_access_token),
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
    current_user: User = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")

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
    
