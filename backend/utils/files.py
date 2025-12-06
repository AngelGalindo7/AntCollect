import os 
import shutil 
from fastapi import UploadFile, HTTPException

UPLOAD_DIR = "Uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_upload_file(file: UploadFile) -> str:

    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filname")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    #TODO: Add exception for large file

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
    
    return file_path

def get_file_size(file_path:str) -> int:
    """Return file size in bytes"""
    return os.path.getsize(file_path)

#TODO Complete function
def delete_file(file_path):
    
    return None
