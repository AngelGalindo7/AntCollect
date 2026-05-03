import io
import os
import uuid

from fastapi import UploadFile, HTTPException
from PIL import Image
from typing import Dict

from .s3 import upload_image_bytes, delete_s3_object, s3_key_from_url
from .image_processing import handle_transparent_images, strip_metadata

MAX_FILE_SIZE = 10 * 1024 * 1024

IMAGE_SIZES = {
    "thumbnail": (150, 150),
    "medium": (800, 800),
}

ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
ALLOWED_FILE_TYPE = ['jpeg', 'png', 'webp', 'gif']


def get_file_size(file_path: str) -> int:
    """Return file size in bytes"""
    return os.path.getsize(file_path)


def delete_file(file_path_or_url: str) -> None:
    if not file_path_or_url:
        return
    if file_path_or_url.startswith("https://") or file_path_or_url.startswith("http://"):
        key = s3_key_from_url(file_path_or_url)
        if key:
            delete_s3_object(key)
    else:
        try:
            os.remove(file_path_or_url)
        except Exception:
            pass


def check_file_size(file: UploadFile):
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE:
        raise HTTPException(413, "Payload too large")
    return size


def validate_image(file: UploadFile):
    if file.content_type not in ALLOWED_MIMES:
        raise HTTPException(400, "Unsupported image type")
    try:
        file.file.seek(0)
        img = Image.open(file.file)
        # `format` is set on open() before verify() invalidates the image
        fmt = (img.format or "").lower()
        img.verify()
        file.file.seek(0)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Invalid or corrupted image file")
    if fmt not in ALLOWED_FILE_TYPE:
        raise HTTPException(400, "Unsupported image format")
    return True


def process_and_save_image(file: UploadFile, user_id: int, folder_prefix: str = "posts") -> Dict:
    check_file_size(file)
    validate_image(file)

    contents = file.file.read()
    filename = f"{uuid.uuid4()}.jpg"

    uploaded_keys = []

    try:
        image = Image.open(io.BytesIO(contents))
        original_width, original_height = image.size
        image = handle_transparent_images(image)
        image = strip_metadata(image)

        # original
        buf = io.BytesIO()
        image.save(buf, "JPEG", quality=90, optimize=True)
        original_bytes = buf.getvalue()
        original_key = f"{folder_prefix}/{user_id}/original/{filename}"
        original_url = upload_image_bytes(original_key, original_bytes, "image/jpeg")
        uploaded_keys.append(original_key)

        # thumbnail
        thumbnail = image.copy()
        thumbnail.thumbnail(IMAGE_SIZES["thumbnail"], Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        thumbnail.save(buf, "JPEG", quality=80, optimize=True)
        thumb_bytes = buf.getvalue()
        thumb_width, thumb_height = thumbnail.size
        thumb_key = f"{folder_prefix}/{user_id}/thumbnail/{filename}"
        thumb_url = upload_image_bytes(thumb_key, thumb_bytes, "image/jpeg")
        uploaded_keys.append(thumb_key)

        # medium
        medium = image.copy()
        medium.thumbnail(IMAGE_SIZES["medium"], Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        medium.save(buf, "JPEG", quality=85, optimize=True)
        medium_bytes = buf.getvalue()
        medium_width, medium_height = medium.size
        medium_key = f"{folder_prefix}/{user_id}/medium/{filename}"
        medium_url = upload_image_bytes(medium_key, medium_bytes, "image/jpeg")
        uploaded_keys.append(medium_key)

        return {
            "filename": filename,
            "mime_type": "image/jpeg",
            "paths": {
                "original": original_url,
                "thumbnail": thumb_url,
                "medium": medium_url,
            },
            "sizes": {
                "original": len(original_bytes),
                "thumbnail": len(thumb_bytes),
                "medium": len(medium_bytes),
            },
            "dimensions": {
                "original": {"width": original_width, "height": original_height},
                "thumbnail": {"width": thumb_width, "height": thumb_height},
                "medium": {"width": medium_width, "height": medium_height},
            },
        }

    except Exception as e:
        for key in uploaded_keys:
            try:
                delete_s3_object(key)
            except Exception:
                pass
        if isinstance(e, (IOError, OSError)):
            raise HTTPException(400, "Corrupted or invalid image file")
        raise HTTPException(500, f"Image processing failed: {str(e)}")
