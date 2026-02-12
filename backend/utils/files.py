import os 
import shutil 
from fastapi import UploadFile, HTTPException

UPLOAD_BASE_DIR = "Uploads"

MAX_FILE_SIZE = 10 * 1024 * 1024

IMAGE_SIZES = {
    "thumbnail": (150, 150),
    "medium": (800,800)
}

ALLOWED_MIMES =  ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

ALLOWED_FILE_TYPE = ['jpeg', 'png', 'webp', 'gif']

os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_upload_file(file: UploadFile) -> str:

    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
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


def _get_file_path(size: str, user_id: int, filename: str) -> str:
    return os.path.join(UPLOAD_BASE_DIR, str(user_id), size, filename)


def _ensure_directory(file_path: str) -> None:
    
    directory = os.path.dirname(file_path)
    os.makedirs(directory, exist_ok=True)


def _cleanup_files(file_paths: List[str]) -> None:
    
    for path in file_paths:
        try:
            if os.path.exists(path):
                os.remove(path)
                print(f"Cleaned up: {path}")
        except Exception as e:
            print(f"Failed to cleanup {path}: {str(e)}")
    
    # Clean up empty directories
    for path in file_paths:
        try:
            directory = os.path.dirname(path)
            if os.path.exists(directory) and not os.listdir(directory):
                os.rmdir(directory)
                print(f"Cleaned up empty directory: {directory}")
        except Exception:
            pass


def check_file_size(file: UploadFile):

    file.file.seek(0,2)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE:
        raise HTTPException(413, "Payload too large")

    return size

def validate_image(file: UploadFile):

    content = file.file.read(2048)
    file.file.seek(0)

    mime = magic.from_buffer(content, mime=True)

    if mime not in ALLOWED_MIMES:
        raise HTTPException(400, f"Invalid image type: {mime}")


    file_type = imghdr.what(None,h=content)

    if file_type not in ALLOWED_FILE_TYPE:
        raise HTTPException(400, "File signature doesn't match image type")


    return mime

def handle_transparent_images(image):

    if image.mode in ('RGBA', 'LA', 'P'):
        background = Image.new('RGB', image.size, (255, 255, 255))

        
        if image.mode != 'RGBA':
            image = image.convert('RGBA')


        background.paste(image, mask=image.split()[-1])
        image = background

    elif image.mode!= 'RGB':
        image = image.convert('RGB')

    return image

def process_and_save_image(file: UploadFile, user_id: int) -> Dict:


    mime_type = validate_image(file)

    file_size = check_file_size(file)

    contents = file.file.read()

    filename = f"{uuid.uuid4()}.jpg"

    created_files = []


    try:

        image = Image.open(io.BytesIO(contents))

        original_width, original_height = image.size

        image = handle_transparent_images(image)

        
        original_path = _get_file_path("original", user_id, filename)
        _ensure_directory(original_path)
        image.save(original_path, "JPEG", quality=90, optimize=True)
        created_files.append(original_path)
        original_size = os.path.getsize(original_path)
        
        thumbnail = image.copy()
        thumbnail.thumbnail(IMAGE_SIZES["thumbnail"], Image.Resampling.LANCZOS)
        thumb_path = _get_file_path("thumbnail", user_id, filename)
        _ensure_directory(thumb_path)
        thumbnail.save(thumb_path, "JPEG", quality=80, optimize=True)
        created_files.append(thumb_path)
        thumb_size = os.path.getsize(thumb_path)
        thumb_width, thumb_height = thumbnail.size
        
        medium = image.copy()
        medium.thumbnail(IMAGE_SIZES["medium"], Image.Resampling.LANCZOS)
        medium_path = _get_file_path("medium", user_id, filename)
        _ensure_directory(medium_path)
        medium.save(medium_path, "JPEG", quality=85, optimize=True)
        created_files.append(medium_path)
        medium_size = os.path.getsize(medium_path)
        medium_width, medium_height = medium.size



        return {
            "filename": filename,
            "mime_type": "image/jpeg",
            
            "paths": {
                "original": original_path,
                "thumbnail": thumb_path,
                "medium": medium_path
            },
            "sizes": {
                "original": original_size,
                "thumbnail": thumb_size,
                "medium": medium_size
            },
            "dimensions": {
                "original": {"width": original_width, "height": original_height},
                "thumbnail": {"width": thumb_width, "height": thumb_height},
                "medium": {"width": medium_width, "height": medium_height}
            }
        }
        
    except Exception as e:
        # Clean up any files created before the error
        _cleanup_files(created_files)
        
        # Raise appropriate error
        if isinstance(e, (IOError, OSError)):
            raise HTTPException(400, "Corrupted or invalid image file")
        else:
            raise HTTPException(500, f"Image processing failed: {str(e)}")
        

