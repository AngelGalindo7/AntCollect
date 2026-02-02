from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional
from enum import Enum
from datetime import datetime 
class UserCreate(BaseModel):
    username: str
    password: str
    email: EmailStr

class UserSearch(BaseModel):
    user_id: int
    username: str
    email: EmailStr

class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr

class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse

class RefreshRequest(BaseModel):
    refresh_token: str
    
class AuthorizeTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class AccessRequest(BaseModel):
    access_token: str

class SearchRequest(BaseModel):
    query: str


class  SearchResponse(BaseModel):
    id: int
    username: str

class PostType(str, Enum):
    collection = "collection"
    looking_for = "looking_for"
    trading = "trading"

class PostQueryResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    post_id: int
    caption: str
    public: bool
    is_published: bool
    type: PostType
    updated_at: datetime
    image_paths: List[Optional[str]] # List of strings from array_agg
    total_likes: int

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    posts: List[PostQueryResult]

class UserPostLikesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    posts: List[PostQueryResult]


class GetUserByUsernameRequest(BaseModel):
    username: str