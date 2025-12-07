from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    username: str
    password: str
    confirm_password: str
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