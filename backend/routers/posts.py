from fastapi import UploadFile, File, Depends, Form, HTTPException, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.database import get_db
from ..models import PostImage, User, Post, PostLike, PostComment
from ..utils.files import save_upload_file, get_file_size, delete_file
from ..utils.auth import authenthicate_access_token


router = APIRouter(
    prefix="/posts",
    tags=["Posts"]
)



#TODO Add a ban table in postgresql and check if user_id is not banned
@router.post("/upload-post")
def upload_post(
    caption: str=Form(...),
    is_published: bool = Form(True),
    post_images: list[UploadFile] = File(...),
    user_id: User = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
    ):
    

    try:
        print(f"userid:{user_id}")
        post = Post(
        user_id=user_id,
        caption=caption,
        is_published=is_published
    )   
        
        db.add(post)
        db.flush()
        image_records = []
        uploaded_files = []
        for i, image in enumerate(post_images):
            file_path = save_upload_file(image)
            uploaded_files.append(file_path)
            size_bytes = get_file_size(file_path)
            order_index = i+1
            post_image = PostImage(
                post_id=post.post_id,
                order_index=order_index,
                filename=image.filename,
                file_path=file_path,
                mime_type=image.content_type,
                size_bytes=size_bytes,
            )
            image_records.append(post_image)
        
        db.add_all(image_records)
        db.commit()
        db.refresh(post)
        return {
        "post_id": str(post.post_id),
        "message": "Upload successful"
    }
    
    except Exception as e:
        db.rollback()
        #add cleanup function

        for path in uploaded_files:
            try:
                pass
                delete_file(path)
            except Exception:
                pass
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during upload: {e}"
        )
@router.post("/like_image")
def like_image(
    post_id: int, 
    user_id: User = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
):



    existing_like = (
        db.query(PostLike)
        .filter(
            PostLike.user_id==user_id,
            PostLike.post_id==post_id
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
    post_id=post_id,
    user_id =user_id
    )

    try:
        db.add(new_like)
        db.commit()
        db.refresh(new_like)

        return {
            "like_id":new_like.like_id,
            "messae":"Liked",
            "liked":True
            }
    #Catches race condition where simultaneous try to like 
    except IntegrityError:
        db.rollback()
        #The row must have been created in the other request
        return {
            "messae":"Liked",
            "liked":True
            }


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
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    return {
        "comment_id": new_comment.post_comment_id,
        "message": "Successfully commented"}
    



"""TODO Verify logic on banning
Should each api request check if user is banned?
Or should a user not be able to make any request at all

"""
