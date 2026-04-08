import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from .routers import auth, users, posts, folders, trade_requests
from .utils.rate_limit import limiter

app = FastAPI()
app.state.limiter = limiter

async def _rate_limit_handler(request, exc):
    return JSONResponse({"detail": "Too many requests"}, status_code=429)

app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

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

@app.get("/health")
def health():
    return {"status": "ok"}
