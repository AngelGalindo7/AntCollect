from fastapi import FastAPI, UploadFile, File, Depends, Form, HTTPException, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from..database import get_db
from backend.models import PostImage, User, RefreshToken, Post, PostLike, PostComment
import shutil, os
import os
from ..utils.files import save_upload_file, get_file_size, delete_file
from backend.schemas import UserCreate, UserResponse, UserLogin, TokenResponse, RefreshRequest, AuthorizeTokenResponse
from ..utils.auth import hash_password, verify_password, create_access_token, create_refresh_token,valid_refresh_token,authenthicate_access_token


router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)

#TODO Add token to httpcookie/local memory in the frontend
@router.post("/authorize-token")
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