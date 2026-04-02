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
    search_type: str = "quick"


class UserResult(BaseModel):
    id: int
    username: str
    avatar_path: Optional[str]

class PostResult(BaseModel):
    post_id: int


class PostType(str, Enum):
    collection = "collection"
    looking_for = "looking_for"
    trading = "trading"



class ImagePaths(BaseModel):
    medium: str
    original: str
    thumbnail: str

class ImageMetadata(BaseModel):
    paths: ImagePaths
    original_width: int
    original_height: int

class PostBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    post_id: int
    caption: str
    public: bool
    is_published: bool
    type: PostType
    updated_at: datetime
    images: List[Optional[ImageMetadata]] # List of strings from array_agg
    total_likes: int
    is_liked: Optional[bool] = None  # Only included if user is authenticated

class PostWithEngagement(PostBase):
    total_engagement: int


class  SearchResponse(BaseModel):
    query: str
    users: List[UserResult]
    posts: Optional[List[PostWithEngagement]] = None


class TopPostsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    total_returned: int
    k_value: int
    posts : List[PostWithEngagement]

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    avatar_path: Optional[str] = None
    is_owner: bool
    posts: List[PostBase]

class UserPostLikesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    posts: List[PostBase]

class GetUserByIdRequest(BaseModel):
    profile_id: int

class GetUserByUsernameRequest(BaseModel):
    username: str

class LikeImageRequest(BaseModel):
    post_id: int

class UserMeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_path: Optional[str] = None
    is_private: bool
    default_post_public: bool
