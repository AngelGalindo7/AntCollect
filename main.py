from fastapi import FastAPI, UploadFile, File, Depends, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal
from models import Image, User
import shutil, os
import os
from utils.files import save_upload_file, get_file_size
from schemas import UserCreate, UserResponse, UserLogin, TokenResponse
from utils.auth import hash_password, verify_password, create_access_token

app = FastAPI()

UPLOAD_DIR = "Uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


@app.post("/login", response_model= TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    if not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_access_token({"sub" : db_user.id})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=db_user.id,
            email=db_user.email,
            username=db_user.username
        )
    )
@app.post("/upload-image")
def upload_image(
    user_id: int | None = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
    ):
    
    file_path = save_upload_file(file)
    size_bytes = get_file_size(file_path)

    new_image = Image(
        user_id=user_id,
        filename=file.filename,
        file_path=file_path,
        mime_type=file.content_type,
        size_bytes=size_bytes,
    )

    db.add(new_image)
    db.commit()
    db.refresh(new_image)

    return {
        "id": str(new_image.id),
        "message": "Upload successful"
    }