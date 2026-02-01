from fastapi import Depends, HTTPException, APIRouter, Request
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponseon

from ..database import get_db
from backend.models import RefreshToken
from ..utils.auth import create_access_token, create_refresh_token, valid_refresh_token
from fastapi.responses import JSONResponse



router = APIRouter(
    prefix="/auth",
    tags=["Auth"],
)

ACCESS_TOKEN_MAX_AGE = 31 * 60 # 31 minutes
REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60  # 30 days



def _cookie_response(content: dict, access_token: str, refresh_token:str):
    
    """Build and return JSONResponse with httpOnly cookies for access/refresh tokens."""

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
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=REFRESH_TOKEN_MAX_AGE,
        path="/"
    )
    return response

# TODO Add token to httpcookie/local memory in the frontend
@router.post("/authorize-token")
def authorize_token(
    request: Request,
    db: Session = Depends(get_db),
):



    refresh_token_str = request.cookies.get("refresh_token")
    if not refresh_token_str:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token_str).first()
    if not db_token:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not valid_refresh_token(db_token):
        raise HTTPException(status_code=401, detail="Invalid token")


    new_acces_token = create_access_token({"sub": db_token.user_id})
    new_refresh_token_data = create_refresh_token({"sub": db_token.user_id})

    db_token.revoked = True

    new_refresh = RefreshToken(
        user_id=db_token.user_id,
        token=new_refresh_token_data["token"],
        issued_at=new_refresh_token_data["issued_at"],
        expires_at=new_refresh_token_data["expires_at"],
        revoked=False,
    )

    db.add(new_refresh)
    db.commit()
    db.refresh(new_refresh)

    return _cookie_response(
        content={"ok": True},
        access_token=new_acces_token,
        refresh_token=new_refresh_token_data["token"],
    )

"""
@router.post("/logout")
def logout():
    response = JSONResponse(content={"ok": True})
    for cookie_name in ["access_token", "refresh_token"]:
        response.delete_cookie(cookie_name, path="/")
    return response
    """