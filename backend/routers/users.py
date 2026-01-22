from fastapi import Depends, HTTPException, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, func
from ..database import get_db
from ..models import User, RefreshToken, Post, PostLike, PostImage
from ..schemas import UserCreate, UserResponse, UserLogin, TokenResponse, RefreshRequest, AuthorizeTokenResponse, SearchRequest, SearchResponse, UserProfileResponse, PostQueryResult, UserPostLikesResponse
from ..utils.auth import hash_password, verify_password, create_access_token, create_refresh_token,valid_refresh_token,authenthicate_access_token
from typing import List


router = APIRouter(
    prefix="/users",
    tags=["Users"]
    )


@router.post("/create-user", response_model = UserResponse)
def create_user(
    user:UserCreate,
    db: Session = Depends(get_db)
):  
    # print("Original password:", user.password)
    # print("Type:", type(user.password))
    # print("Length (chars):", len(user.password))
    
    #validate input 


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


@router.post("/search_user", response_model = List[SearchResponse])
def search_user(
    request: SearchRequest,
    db: Session = Depends(get_db),
    user_id: User = Depends(authenthicate_access_token)):

    if not request.query:
        return []
    

    users = db.query(User).filter(
        User.username.ilike(f"{request.query}%")
    ).limit(10).all()

    return users


#TODO Filter out private,non published posts in the query to avoid fetching invalid data
@router.post("/get_user_", response_model = UserProfileResponse)
def retrieve_user(
    profile_id: int,
    db: Session = Depends(get_db),
    user_id: User = Depends(authenthicate_access_token)
):

    likes_subquery = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id)
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
                PostImage.file_path,
                order_by=PostImage.order_index
            ).label("image_paths"),
            likes_subquery.label("total_likes")
        )
        .outerjoin(PostImage, Post.id == PostImage.post_id)
        .group_by(Post.id)
    )


    is_owner = (user_id == profile_id)
    
    if is_owner:
        # Owner sees everything (public and private)
        posts_query = posts_query.where(Post.user_id == user_id)
    else:
        posts_query = posts_query.where(
        Post.user_id == user_id,
        Post.is_published == True,
        Post.public == True
    )

    results = db.execute(posts_query).all()
    return UserProfileResponse(
        user_id=profile_id,
        posts=[PostQueryResult.model_validate(row) for row in results]
    )

@router.post("/retrieve_user_likes", response_model=UserPostLikesResponse)
def retrieve_user_likes(
    db: Session = Depends(get_db),
    user_id: User = Depends(authenthicate_access_token)
):
    
    likes_subquery = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id)
        .correlate(Post)
        .scalar_subquery()
    )

    query = (
        select(
            Post.id.label("post_id"),
            Post.caption,
            Post.public,
            Post.is_published,
            Post.type,
            Post.updated_at,
            func.array_agg(
                PostImage.file_path,
                order_by=PostImage.order_index
            ).label("image_paths"),
            likes_subquery.label("total_likes")
        )
        .join(PostLike, Post.id == PostLike.post_id)
        .outerjoin(PostImage, Post.id == PostImage.post_id)
        .group_by(Post.id)
    )

    posts_query = query.where(
        PostLike.user_id == user_id,
        Post.public == True
        )
    
    results = db.execute(posts_query).all()

    return UserPostLikesResponse(
        user_id=user_id,
        posts=[PostQueryResult.model_validate(row) for row in results]
    )
    