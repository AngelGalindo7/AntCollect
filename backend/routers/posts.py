from fastapi import UploadFile, File, Depends, Form, HTTPException, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, select, desc
from backend.database import get_db
from backend.models import PostImage, User, Post, PostLike, PostComment, EngagementLog, EngagementType, MediaAsset
from backend.schemas import TopPostsResponse, PostWithEngagement, LikeImageRequest, UserSearch
from ..utils.files import save_upload_file, get_file_size, delete_file, process_and_save_image
from ..utils.auth import authenthicate_access_token

router = APIRouter(
    prefix="/posts",
    tags=["Posts"]
)



#TODO Add a ban table in postgresql and check if user_id is not banned
@router.post("/upload-post")
def upload_post(
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
            #file_path = save_upload_file(image)
            #uploaded_files.append(file_path)
            #size_bytes = get_file_size(file_path)
            image_data = process_and_save_image(image, user_id)
            all_created_files.extend(image_data["paths"].values())
            
            variants = {}
            
            """for size_name in ["thumbnail", "medium", "original"]:
                variants[size_name] = {
                    "path": image_data["paths"][size_name],
                    "size_bytes": image_data["sizes"][size_name],
                    "width": image_data["dimensions"][size_name]["width"],
                    "height": image_data["dimensions"][size_name]["height"]
                 }"""
            
            order_index = i+1
            post_image = PostImage(
                post_id=post.id,
                order_index=order_index,
                filename=image.filename,
                json_metadata={
                        "paths": {
                            "thumbnail": image_data["paths"]["thumbnail"],
                            "medium": image_data["paths"]["medium"],
                            "original": image_data["paths"]["original"]
                        },
                        "original_width": image_data["dimensions"]["original"]["width"],
                        "original_height": image_data["dimensions"]["original"]["height"]
                    } 

            )
            image_records.append(post_image)
        
        db.add_all(image_records)
        db.commit()
        db.refresh(post)
        return {
        "post_id": str(post.id),
        "message": "Upload successful"
    }
    
    except Exception as e:
        db.rollback()
        #add cleanup function

        # 'locals()' is a dictionary of all current local variables.
        # We use .get() to safely retrieve the list. If it doesn't exist, we get an empty list [].
        
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
    #print(f"Existing like: {existing_like}")

    if existing_like:
        #print(f"OKay delete?")
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

@router.get("/top")
def get_top_posts(k: int = 10, db: Session = Depends(get_db), user: UserSearch = Depends(authenthicate_access_token)):


    # top_posts = (
    #     db.query(
    #         Post,
    #         func.count(EngagementLog.id).label("total_engagement")
    #     )
    #     .join(EngagementLog, Post.id == EngagementLog.post_id)
    #     .group_by(Post.id)
    #     .order_by(func.count(EngagementLog.id).desc())
    #     .limit(k)
    #     .all()
    # )

    """
    existing_like = (
        db.query(PostLike)
        .filter(
            PostLike.user_id==user.user_id,
            PostLike.post_id==Post.post_id
        )
        .first()
    )"""
    existing_like_subquery = (
    select(func.count(PostLike.id))
    .where(
        PostLike.post_id == Post.id,
        PostLike.user_id == user.user_id  # current user from auth token
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
            #consider wrapping in array_remove to eliminate null values
            func.array_agg(
                MediaAsset.json_metadata,
                order_by=PostImage.order_index
                ).label("images"),
            #func.array_agg(PostImage.json_metadata,
            #               order_by=PostImage.order_index
            #               ).label("images"),
            likes_subquery.label("total_likes"),
            existing_like_subquery.label("is_liked")

    )
    .join(top_posts_subquery, Post.id == top_posts_subquery.c.id )
    .outerjoin(PostImage, Post.id == PostImage.post_id)
    .outerjoin(MediaAsset, PostImage.asset_id == MediaAsset.id)
    .group_by(Post.id,top_posts_subquery.c.engagement_count)
    .order_by(top_posts_subquery.c.engagement_count.desc())
    )

    results = db.execute(final_query).all()
    
    # return [
    #     {
    #         "post_id": post.id,
    #         "caption": post.caption,
    #         "engagement_score": total_engagement

    #     }
    #     for post, total_engagement in top_posts
    #]

    return TopPostsResponse(
        total_returned=len(results),
        k_value=k,
        posts=[PostWithEngagement.model_validate(row) for row in results]
    )

    #TODO Add messaging section for users to message each other

    #TODO Look into adding pydantic schemas in the resposnes for the endpoints

    #TODO Look into the correct input for comment/like

    #TODO For comment/like/post if token is expired then look into how to deal with it
    #1 within endpoint catch the error and call get autheriation jwt token
    #2 return response to frontend and let frontend call the get atuehrization token
    #prioritize low latency, "efficient" 

    #TODO Finish figma db tables for post users, refresh, comments, likes, comments
    #Add entity relationships as well

    #TODO Update README With current progress, description

    #TODO Create frontend with react, typescript, add login

    #TODO Add java microservice to track  requests to db success/failure, average speed for each request
    #Point is to track db usage and how code is affected after refactors etc 
    
    #TODO Add get likes for post @app.get("/post/{post_id}/likes_count")

    #TODO Add get to check if user liked a post @app.get("/post/{post_id}/liked_by_me")




@router.post("/comment_post")
def comment(
    post_id: int,
    content: str,
    user_id: User = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
):
    
    new_comment = PostComment(
        post_id=post_id,
        user_id=user_id,
        content=content,

    )

    new_engagement = EngagementLog(
        post_id=post_id,
        user_id=user_id,
        event_type=EngagementType.comment
    )
    db.add(new_comment)
    db.add(new_engagement)
    db.commit()
    db.refresh(new_comment)

    return {
        "comment_id": new_comment.id,
        "message": "Successfully commented"}
    



"""TODO Verify logic on banning
Should each api request check if user is banned?
Or should a user not be able to make any request at all

"""
