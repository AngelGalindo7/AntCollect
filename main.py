from fastapi import FastAPI, UploadFile, File, Depends, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import PostImage, User, RefreshToken, Post, PostLike, PostComment
import shutil, os
import os
from utils.files import save_upload_file, get_file_size, delete_file
from schemas import UserCreate, UserResponse, UserLogin, TokenResponse, RefreshRequest, AuthorizeTokenResponse
from utils.auth import hash_password, verify_password, create_access_token, create_refresh_token,valid_refresh_token,authenthicate_access_token
from routers import auth, users, posts

app = FastAPI()

app.include_router(users.router)
app.include_router(auth.router)
app.include_router(posts.router)
@app.get("/test-db/")
def test_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Database connection works!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


