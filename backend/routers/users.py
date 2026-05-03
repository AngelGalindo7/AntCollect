import os

from fastapi import Depends, HTTPException, APIRouter, Request, File, Form, UploadFile
from ..utils.rate_limit import limiter, get_real_ip, get_user_or_ip_key
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, func
from ..database import get_db
from backend.models import User, RefreshToken, Post, PostLike, PostImage, EngagementLog, MediaAsset
from ..schemas import UserCreate, UserResponse, UserLogin, TokenResponse, RefreshRequest, AuthorizeTokenResponse, SearchRequest, SearchResponse, UserProfileResponse, PostBase, UserPostLikesResponse, GetUserByIdRequest, UserSearch, GetUserByUsernameRequest, PostWithEngagement, UserResult, UserMeResponse, UpdateProfileRequest, AvatarUpdateResponse, BackgroundUpdateResponse, ChangePasswordRequest
from ..utils.auth import hash_password, verify_password, create_access_token, create_refresh_token, authenthicate_access_token
from ..utils.files import process_and_save_image, delete_file
from typing import List

ACCESS_TOKEN_MAX_AGE = 30 * 60  # 30 minutes — matches JWT expiry in create_access_token
REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60  # 30 days

router = APIRouter(
    prefix="/users",
    tags=["Users"]
    )


@router.get("/me", response_model=UserMeResponse)
def get_me(
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token)
):
    db_user = db.query(User).filter(User.id == user.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.patch("/me/profile", response_model=UserMeResponse)
def update_profile(
    updates: UpdateProfileRequest,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token)
):
    db_user = db.query(User).filter(User.id == user.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if updates.username is not None and updates.username != db_user.username:
        existing = db.query(User).filter(User.username == updates.username).first()
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        db_user.username = updates.username

    if updates.bio is not None:
        db_user.bio = updates.bio

    if updates.sticker_count is not None:
        db_user.sticker_count = updates.sticker_count

    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/me/avatar", response_model=AvatarUpdateResponse)
@limiter.limit("5/hour", key_func=get_user_or_ip_key)
def update_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token)
):
    db_user = db.query(User).filter(User.id == user.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    old_avatar_path = db_user.avatar_path
    result = process_and_save_image(file, user.user_id)
    new_avatar_path = result["paths"]["thumbnail"]

    db_user.avatar_path = new_avatar_path
    db.commit()

    if old_avatar_path and old_avatar_path != new_avatar_path:
        delete_file(old_avatar_path)

    return AvatarUpdateResponse(avatar_path=new_avatar_path)


@router.post("/me/background", response_model=BackgroundUpdateResponse)
@limiter.limit("5/hour", key_func=get_user_or_ip_key)
def update_background(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token)
):
    db_user = db.query(User).filter(User.id == user.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    old_background_path = db_user.background_path
    result = process_and_save_image(file, user.user_id)
    new_background_path = result["paths"]["original"]

    db_user.background_path = new_background_path
    db.commit()

    if old_background_path and old_background_path != new_background_path:
        delete_file(old_background_path)

    return BackgroundUpdateResponse(background_path=new_background_path)


@router.post("/me/password")
@limiter.limit("5/hour", key_func=get_user_or_ip_key)
def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token)
):
    db_user = db.query(User).filter(User.id == user.user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not db_user.password_hash:
        raise HTTPException(status_code=400, detail="This account uses Google sign-in and has no password to change.")

    if not verify_password(payload.current_password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters")

    db_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.post("/create-user", response_model = UserResponse)
@limiter.limit("3/hour", key_func=get_real_ip)
def create_user(
    request: Request,
    user:UserCreate,
    db: Session = Depends(get_db)
):  
    # print("Original password:", user.password)
    # print("Type:", type(user.password))
    # print("Length (chars):", len(user.password))
    
    #validate input 


    # Convert to bytes
    password_bytes = user.password.encode("utf-8")
    #print("Bytes:", password_bytes)
    #print("Length (bytes):", len(password_bytes))
    hashed_pw = hash_password(user.password)
    #print(hash_password("Passowrd@"))

    new_user = User(
        username = user.username,
        email = user.email,
        password_hash = hashed_pw
    )

    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username or email already registered")
    db.refresh(new_user)

    return new_user

@router.post("/login")
@limiter.limit("5/minute;20/hour", key_func=get_real_ip)
def login(request: Request, user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()


    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    if not db_user.password_hash:
        # Generic message — distinct error here would let attackers enumerate
        # which emails are registered and which use Google sign-in.
        raise HTTPException(status_code=400, detail="Invalid email or password")

    if not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    

    #"sub" field has to be a string not a int
    #TODO Look into making user.id to str
    access_token = create_access_token({
        "sub": str(db_user.id),
        "username": db_user.username,
        "email": db_user.email,
        "role": db_user.role
                    })
    
    refresh_token_data = create_refresh_token({
        "sub": str(db_user.id),
        "username": db_user.username,
        "email": db_user.email})

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

    content = {
        "user": {
            "id": db_user.id,
            "email": db_user.email,
            "username": db_user.username
        }
    }

    response = JSONResponse(content=content)

    secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    domain = os.getenv("COOKIE_DOMAIN") or None

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
        domain=domain,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token_data["token"],
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=REFRESH_TOKEN_MAX_AGE,
        path="/",
        domain=domain,
    )

    return response
    


@router.post("/search_user", response_model=SearchResponse)
def search_user(
    request: SearchRequest,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token)):
    
    if not request.query:
        return SearchResponse(
            query="",
            users=[],
            posts=None
        )
    

    user_results = _search_users(request.query, 10, db)
    post_results = None

    if request.search_type == "full":
        post_results = _search_posts(request.query, 10, db)

    #return SearchResponse(
    #query=q,
    #users = user_results,
    #posts = post_results
    #)
    #print(user_results[0])
    return SearchResponse(
    query=request.query,
    users=[UserResult(
        id=u.id,
        username=u.username,
        avatar_path=u.avatar_path

    ) for u in user_results],
    posts=post_results
)


def _search_users(query: str,limit: int,db: Session) -> List[User]:
    users = db.execute(
        select(User)
        .where(User.username.ilike(f"%{query}%"))
        .limit(limit)
    ).scalars().all()

    return users

def _search_posts(query: str, limit: int, db: Session) -> List[PostWithEngagement]:
    top_search_posts_subquery = (
        select(
            Post.id.label("id"),
            func.count(EngagementLog.id).label("engagement_count")
        )
        .outerjoin(EngagementLog, Post.id == EngagementLog.post_id)
        .where(
            Post.caption.ilike(f"%{query}%"),
            Post.public == True,
            Post.is_published == True
        )
        .group_by(Post.id)
        .order_by(func.count(EngagementLog.id).desc())
        .limit(limit)  # ← Apply limit early!
        .subquery()
    )
    
    likes_subquery = (
        select(func.count(PostLike.id))
        .where(PostLike.post_id == Post.id)
        .scalar_subquery()
    )

    
    posts = db.execute(
        select(
            Post.id.label("post_id"),
            Post.caption,
            Post.public,
            Post.is_published,
            Post.type,
            Post.updated_at,
            top_search_posts_subquery.c.engagement_count.label("total_engagement"),
            func.array_agg(MediaAsset.json_metadata, order_by=PostImage.order_index).label("images"),
            likes_subquery.label("total_likes"),
            User.id.label("user_user_id"),
            User.username.label("user_username"),
            User.avatar_path.label("user_avatar_path"),
        )
        .join(top_search_posts_subquery, Post.id == top_search_posts_subquery.c.id)
        .join(User, Post.user_id == User.id)
        .outerjoin(PostImage, Post.id == PostImage.post_id)
        .outerjoin(MediaAsset, PostImage.asset_id == MediaAsset.id)
        .group_by(Post.id, top_search_posts_subquery.c.engagement_count, User.id)
        .order_by(top_search_posts_subquery.c.engagement_count.desc())
    ).all()

    results = []
    for row in posts:
        row_dict = row._asdict()
        row_dict["user"] = {
            "user_id": row_dict.pop("user_user_id"),
            "username": row_dict.pop("user_username"),
            "avatar_path": row_dict.pop("user_avatar_path"),
        }
        results.append(PostWithEngagement.model_validate(row_dict))
    
    return results
#TODO Filter out private,non published posts in the query to avoid fetching invalid data
@router.post("/get_user_", response_model = UserProfileResponse)
def retrieve_user(
    target_username: GetUserByUsernameRequest,
    db: Session = Depends(get_db),
    user: UserSearch = Depends(authenthicate_access_token)
):
    
    target_user = db.execute(
        select(User).where(User.username == target_username.username)
    ).scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    


    existing_like_subquery = (
    select(func.count(PostLike.id))
    .where(
        PostLike.post_id == Post.id,
        PostLike.user_id == user.user_id  # current user from auth token
    )
    .scalar_subquery()
) 
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
                MediaAsset.json_metadata,
                order_by=PostImage.order_index
            ).label("images"),
            #func.array_agg(
            #    PostImage.json_metadata,
            #    order_by=PostImage.order_index
            #).label("images"),
            likes_subquery.label("total_likes"),
            existing_like_subquery.label("is_liked")
        )
        .outerjoin(PostImage, Post.id == PostImage.post_id)
        .outerjoin(MediaAsset, PostImage.asset_id == MediaAsset.id)
        .group_by(Post.id)
        .order_by(Post.updated_at.desc())
    )


    is_owner = (user.user_id == target_user.id)
    
    if is_owner:
        # Owner sees everything (public and private)
        posts_query = posts_query.where(Post.user_id == user.user_id)
    else:
        posts_query = posts_query.where(
        Post.user_id == target_user.id,
        Post.is_published == True,
        Post.public == True
    )

    results = db.execute(posts_query).all()
    post_user = {
        "user_id": target_user.id,
        "username": target_user.username,
        "avatar_path": target_user.avatar_path,
    }
    posts = []
    for row in results:
        row_dict = row._asdict()
        row_dict["user"] = post_user
        posts.append(PostBase.model_validate(row_dict))

    return UserProfileResponse(
        user_id=target_user.id,
        username=target_user.username,
        bio=target_user.bio,
        avatar_path=target_user.avatar_path,
        background_path=target_user.background_path,
        sticker_count=target_user.sticker_count,
        is_owner=is_owner,
        posts=posts,
    )

@router.post("/retrieve_user_likes", response_model=UserPostLikesResponse)
def retrieve_user_likes(
    db: Session = Depends(get_db),
    current_user: UserSearch = Depends(authenthicate_access_token)
):
    query = (
        select(
            Post.id.label("post_id"),
            Post.caption,
            Post.public,
            Post.is_published,
            Post.type,
            Post.updated_at,
            func.array_agg(
                MediaAsset.json_metadata,
                order_by=PostImage.order_index
            ).label("images"),
            User.id.label("user_user_id"),
            User.username.label("user_username"),
            User.avatar_path.label("user_avatar_path"),
        )
        .join(PostLike, Post.id == PostLike.post_id)
        .join(User, Post.user_id == User.id)
        .outerjoin(PostImage, Post.id == PostImage.post_id)
        .outerjoin(MediaAsset, MediaAsset.id == PostImage.asset_id)
        .group_by(Post.id, User.id)
    )

    posts_query = query.where(
        PostLike.user_id == current_user.user_id,
        Post.public == True,
    )

    results = db.execute(posts_query).all()

    posts = []
    for row in results:
        row_dict = row._asdict()
        row_dict["user"] = {
            "user_id": row_dict.pop("user_user_id"),
            "username": row_dict.pop("user_username"),
            "avatar_path": row_dict.pop("user_avatar_path"),
        }
        posts.append(PostBase.model_validate(row_dict))

    return UserPostLikesResponse(
        user_id=current_user.user_id,
        posts=posts
    )





