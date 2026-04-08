import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from .database import get_db
from .routers import auth, users, posts, folders, trade_requests

app = FastAPI()

_allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
origins = [o.strip() for o in _allowed.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(folders.router)
app.include_router(trade_requests.router)
@app.get("/test-db/")
def test_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Database connection works!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


