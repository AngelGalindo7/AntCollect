from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from .database import get_db
from .routers import auth, users, posts

#. relative import current package .. import from parent package
#packages make relative imports reliable

app = FastAPI()

app.include_router(users.router)
app.include_router(auth.router)
app.include_router(posts.router)
@app.get("/test-db/")
def test_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Database connection works!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


