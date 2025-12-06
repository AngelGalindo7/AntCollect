from fastapi import Depends, HTTPException, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from backend.models import User, RefreshToken
from backend.schemas import UserCreate, UserResponse, UserLogin, TokenResponse, RefreshRequest, AuthorizeTokenResponse
from utils.auth import hash_password, verify_password, create_access_token, create_refresh_token,valid_refresh_token,authenthicate_access_token



router = APIRouter(
    prefix="/users",
    tags=["Users"]
    )


@router.post("/create-user", response_model = UserResponse)
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
@router.post("/login", response_model= TokenResponse)
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