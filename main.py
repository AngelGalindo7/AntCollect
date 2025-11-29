from fastapi import FastAPI, UploadFile, File, Depends, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import PostImage, User, RefreshToken, Post, PostLike, PostComment
import shutil, os
import os
from utils.files import save_upload_file, get_file_size, delete_file
from schemas import UserCreate, UserResponse, UserLogin, TokenResponse, RefreshRequest, AuthorizeTokenResponse
from utils.auth import hash_password, verify_password, create_access_token, create_refresh_token,valid_refresh_token,authenthicate_access_token


app = FastAPI()

UPLOAD_DIR = "Uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)



@app.get("/test-db/")
def test_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Database connection works!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    


@app.post("/create-user", response_model = UserResponse)
def create_user(
    user:UserCreate,
    db: Session = Depends(get_db)
):  
    print("Original password:", user.password)
    print("Type:", type(user.password))
    print("Length (chars):", len(user.password))
    
    # Convert to bytes
    password_bytes = user.password.encode("utf-8")
    print("Bytes:", password_bytes)
    print("Length (bytes):", len(password_bytes))
    hashed_pw = hash_password(user.password)
    print(hash_password("Passowrd@"))

    new_user = User(
        username = user.username,
        email = user.email,
        password_hash = hashed_pw
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

#TODO Add token to httpcookie/local memory in the frontend
@app.post("/login", response_model= TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    verify_password(user.password, db_user.password_hash)

    #"sub" field has to be a string not a int
    #TODO Look into making user.id to str
    access_token = create_access_token({"sub" : str(db_user.id)})
    refresh_token_data = create_refresh_token({"sub" : db_user.id})

    refresh_token = RefreshToken(
        user_id=db_user.id,
        token=refresh_token_data["token"],
        issued_at=refresh_token_data["issued_at"],
        expires_at=refresh_token_data["expires_at"],
        revoked=False
    )
    
    #TODO Look into wether multiple user refresh accounts should be added to db
    db.add(refresh_token)
    db.commit()
    db.refresh(refresh_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_data["token"],
        token_type="bearer",
        user=UserResponse(
            id=db_user.id,
            email=db_user.email,
            username=db_user.username
        )
    )

#TODO Add token to httpcookie/local memory in the frontend
@app.post("/authorize-token")
def authorize_token(
    req:RefreshRequest,
    db: Session = Depends(get_db)
):
    db_token = db.query(RefreshToken).filter(RefreshToken.token == req.refresh_token).first()

    if not db_token:
        raise HTTPException(status_code=401, detail="Invalid token1")
    
    if not valid_refresh_token(db_token):
        raise HTTPException(status_code=401, detail="Invalid token")
    

    new_access_token = create_access_token({"sub" : db_token.user_id})
    new_refresh_token = create_refresh_token({"sub" : db_token.user_id})

    db_token.revoked = True

    refresh_token = RefreshToken(
        user_id = db_token.user_id,
        token = new_refresh_token["token"],
        issued_at = new_refresh_token["issued_at"],
        expires_at = new_refresh_token["expires_at"],
        revoked=False
    )
    #TODO Look into transition block for atomicity
    #TODO Make sure column blocks of timestamps match inserted data
    db.add(refresh_token)
    db.commit()
    db.refresh(refresh_token)

    return AuthorizeTokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token["token"],
        token_type= "bearer"
    )


#TODO Add a ban table in postgresql and check if user_id is not banned
@app.post("/upload-post")
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
@app.post("/like_image")
def like_image(
    post_id: int, 
    user_id: User = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
):

    new_like = PostLike(
    post_id=post_id,
    user_id =user_id
    )

    db.add(new_like)
    db.commit()
    db.refresh(new_like)

    return {
        "like_id": new_like.like_id,
        "message": "Successfully liked"}


    #TODO like_image/comment errors out after commenting/liking again
    #add error handling




@app.post("/comment_post")
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