from fastapi import Depends, HTTPException, APIRouter, Request, File, Form,UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, func
from ..database import get_db
from backend.models import User, RefreshToken, Post, PostLike, PostImage, EngagementLog
from ..schemas import UserCreate, UserResponse, UserLogin, TokenResponse, RefreshRequest, AuthorizeTokenResponse, SearchRequest, SearchResponse, UserProfileResponse, PostBase, UserPostLikesResponse, GetUserByIdRequest, UserSearch, GetUserByUsernameRequest, PostWithEngagement, UserResult
from ..utils.auth import hash_password, verify_password, create_access_token, create_refresh_token,authenthicate_access_token
from typing import List

ACCESS_TOKEN_MAX_AGE = 2 * 60  # 31 minutes
REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60  # 30 days

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
    db.commit()
    db.refresh(new_user)

    return new_user

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()


    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    verify_password(user.password, db_user.password_hash)

    #"sub" field has to be a string not a int
    #TODO Look into making user.id to str
    access_token = create_access_token({
        "sub": str(db_user.id),
        "username": db_user.username,
        "email": db_user.email
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

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token_data["token"],
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=REFRESH_TOKEN_MAX_AGE,
        path="/"
    )

    return response
    


@router.post("/search_user", response_model=SearchResponse)
def search_user(
    request: SearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(authenthicate_access_token)):
    
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
    print(f"inside")
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
            func.array_agg(PostImage.json_metadata).label("images"),
            likes_subquery.label("total_likes")
        )
        .join(top_search_posts_subquery, Post.id == top_search_posts_subquery.c.id)
        .outerjoin(PostImage, Post.id == PostImage.post_id)
        .group_by(Post.id, top_search_posts_subquery.c.engagement_count)
        .order_by(top_search_posts_subquery.c.engagement_count.desc())
    ).all()

    return [PostWithEngagement.model_validate(row) for row in posts]
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
                PostImage.json_metadata,
                order_by=PostImage.order_index
            ).label("images"),
            likes_subquery.label("total_likes")
        )
        .outerjoin(PostImage, Post.id == PostImage.post_id)
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
    return UserProfileResponse(
        user_id=target_user.id,
        posts=[PostBase.model_validate(row) for row in results]
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
                PostImage.file_metadata,
                order_by=PostImage.order_index
            ).label("images"),
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
        posts=[PostBase.model_validate(row) for row in results]
    )

@router.post("update-bio")
def update_bio(
        
        new_bio: str=Form(...),
        db: Session = Depends(get_db),
        user: UserSearch = Depends(authenthicate_access_token)

):



    user_id = current_user.user_id
    

    try:
        
        update_user = db.query(User).filter(User.id == user_id).update({"bio": new_bio})

        db.commit()

        return {
        "user_id": str(user_id),
        "message": "Update successful"
    }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during upload: {e}"
            )
"""
@router.post("update-bio")
def update_bio(
        
        new_bio: str=Form(...)
        db: Session = Depends(get_db)
        user: UserSearch = Depends(authenthicate_access_token)

    )



    user_id = current_user.user_id
    

    try:
        
        update_user = db.query(User).filter(User.id == user_id).update({"bio": new_bio})

        db.commit()

        return {
        "user_id": str(user_id),
        "message": "Update successful"
    }
    
    except Exception as e:
        db.rollback(        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during upload: {e}"
        )
"""

@router.post("/update-avatar")
def update_avatar(
        
        new_avatar: UploadFile=File(...),
        db: Session = Depends(get_db),
        user: UserSearch = Depends(authenthicate_access_token)

):



    user_id = current_user.user_id
    uploaded_avatar = None

    try:
        file_path = save_upload_file(new_avatar) 

        update_user = db.query(User).filter(User.id == user_id).update({"avatar_path": file_path})
        #TODO Delete old avatar_path in stored uploads
        db.commit()

        return {
        "user_id": str(user_id),
        "message": "Update successful"
    }
    
    except Exception as e:
        db.rollback()

                
        if file_path:
            try:
                delete_file(file_path)
            except Exception:
                pass
                raise HTTPException(
                    status_code=500,
                    detail=f"An error occurred during update: {e}"
        )




