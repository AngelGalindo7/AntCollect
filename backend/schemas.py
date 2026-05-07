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
    role: str = "user"

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
    caption: Optional[str] = None
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
    next_cursor: Optional[str] = None

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    bio: Optional[str] = None
    avatar_path: Optional[str] = None
    background_path: Optional[str] = None
    background_offset_x: float = 0.0
    background_offset_y: float = 0.0
    background_scale: float = 1.0
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
    role: str = "user"
    bio: Optional[str] = None
    avatar_path: Optional[str] = None
    background_path: Optional[str] = None
    background_offset_x: float = 0.0
    background_offset_y: float = 0.0
    background_scale: float = 1.0

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    bio: Optional[str] = Field(default=None, max_length=500)
    sticker_count: Optional[int] = Field(default=None, ge=0, le=10_000)

class AvatarUpdateResponse(BaseModel):
    avatar_path: str

class BackgroundUpdateResponse(BaseModel):
    background_path: str
    background_offset_x: float
    background_offset_y: float
    background_scale: float


class BackgroundPositionRequest(BaseModel):
    offset_x: float = Field(default=0.0)
    offset_y: float = Field(default=0.0)
    scale: float = Field(default=1.0, ge=1.0, le=3.0)


class BackgroundPositionResponse(BaseModel):
    background_offset_x: float
    background_offset_y: float
    background_scale: float

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
    preview_images: List[str] = []


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
    post_caption: Optional[str] = None
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


class PanelRect(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    w: int = Field(ge=280)
    h: int = Field(ge=220)


class PanelCreateRequest(BaseModel):
    rect: Optional[PanelRect] = None
    w: Optional[int] = Field(default=None, ge=280)
    h: Optional[int] = Field(default=None, ge=220)
    title: Optional[str] = Field(default=None, max_length=80)
    accent: Optional[str] = Field(default=None, max_length=16)
    placed: bool = True


class PanelMetaUpdate(BaseModel):
    x: Optional[int] = Field(default=None, ge=0)
    y: Optional[int] = Field(default=None, ge=0)
    w: Optional[int] = Field(default=None, ge=280)
    h: Optional[int] = Field(default=None, ge=220)
    z: Optional[int] = None
    locked: Optional[bool] = None
    placed: Optional[bool] = None
    title: Optional[str] = Field(default=None, max_length=80)
    accent: Optional[str] = Field(default=None, max_length=16)


class PanelCanvasUpdate(BaseModel):
    canvas_json: dict


class PanelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    x: int
    y: int
    w: int
    h: int
    z: int
    locked: bool
    placed: bool
    title: Optional[str] = None
    accent: Optional[str] = None
    canvas_json: Optional[dict] = None
    preview_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class WorkspaceMeta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    z_counter: int
    created_at: datetime
    updated_at: datetime


class WorkspaceResponse(BaseModel):
    workspace: WorkspaceMeta
    panels: List[PanelResponse]


class PanelPreviewResponse(BaseModel):
    preview_path: str
