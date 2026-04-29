from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import List, Optional
from enum import Enum
from datetime import datetime
class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8)
    email: EmailStr

class UserSearch(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    role: str

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

class PostUserInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    avatar_path: Optional[str] = None


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
    user: Optional[PostUserInfo] = None

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
    username: str
    bio: Optional[str] = None
    avatar_path: Optional[str] = None
    background_path: Optional[str] = None
    sticker_count: int
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
    bio: Optional[str] = None
    avatar_path: Optional[str] = None
    background_path: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    bio: Optional[str] = Field(default=None, max_length=500)
    sticker_count: Optional[int] = Field(default=None, ge=0, le=10_000)

class AvatarUpdateResponse(BaseModel):
    avatar_path: str

class BackgroundUpdateResponse(BaseModel):
    background_path: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class CanvasSaveRequest(BaseModel):
    canvas_json: dict

class CanvasResponse(BaseModel):
    canvas_json: Optional[dict] = None
    preview_path: Optional[str] = None

class CanvasPreviewResponse(BaseModel):
    preview_path: str

class CanvasAssetUploadResponse(BaseModel):
    asset_url: str

class RemoveBgRequest(BaseModel):
    image_url: str

class RemoveBgResponse(BaseModel):
    processed_url: str


class FolderCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = True
    folder_type: str = 'collection'


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_post_id: Optional[int] = None
    is_public: Optional[bool] = None
    folder_type: Optional[str] = None


class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    cover_post_id: Optional[int] = None
    avatar_path: Optional[str] = None
    is_public: bool
    folder_type: str
    created_at: datetime
    updated_at: datetime
    post_count: int = 0


class AddPostToFolderRequest(BaseModel):
    post_id: int


class FolderWithPostsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    cover_post_id: Optional[int] = None
    avatar_path: Optional[str] = None
    is_public: bool
    folder_type: str
    posts: List[PostBase]


class TradeRequestType(str, Enum):
    WANT_TO_TRADE = "WANT_TO_TRADE"
    HAVE_WHAT_YOU_NEED = "HAVE_WHAT_YOU_NEED"


class TradeRequestStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"


class CreateTradeRequest(BaseModel):
    target_post_id: int
    recipient_id: int
    request_type: TradeRequestType
    offered_folder_id: Optional[int] = None
    offered_post_ids: Optional[List[int]] = None


class TradeRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    requester_id: int
    requester_username: str
    requester_avatar: Optional[str] = None
    recipient_id: int
    recipient_username: str
    recipient_avatar: Optional[str] = None
    target_post_id: int
    post_caption: str
    post_thumbnail: Optional[str] = None
    request_type: TradeRequestType
    offered_folder_id: Optional[int] = None
    offered_folder_name: Optional[str] = None
    offered_post_ids: Optional[List[int]] = None
    status: TradeRequestStatus
    created_at: datetime


class CompleteGoogleSignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_]+$')


class ReportTargetType(str, Enum):
    post = "post"
    user = "user"


class ReportReason(str, Enum):
    spam = "spam"
    inappropriate = "inappropriate"
    harassment = "harassment"
    copyright = "copyright"
    other = "other"


class CreateReportRequest(BaseModel):
    target_type: ReportTargetType
    target_id: int
    reason: ReportReason


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_type: str
    target_id: int
    reason: str
    status: str
    created_at: datetime
