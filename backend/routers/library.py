import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from backend.database import get_db
from backend.models import StickerLibrary, StickerLibraryImage, MediaAsset, User
from backend.models.media_assets import AssetStatus
from backend.schemas import UserSearch
from backend.utils.auth import authenthicate_access_token, RoleChecker
from backend.utils.files import process_and_save_image, delete_file

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/library",
    tags=["Sticker Library"]
)

@router.get("/")
def get_library(
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = select(StickerLibrary)
    if search:
        query = query.where(StickerLibrary.title.ilike(f"%{search}%"))
    
    results = db.execute(query).scalars().all()
    
    library_data = []
    for sticker in results:
        # Get primary image (order_index=1)
        primary_image = db.execute(
            select(MediaAsset.json_metadata)
            .join(StickerLibraryImage, MediaAsset.id == StickerLibraryImage.asset_id)
            .where(StickerLibraryImage.sticker_id == sticker.id)
            .order_by(StickerLibraryImage.order_index.asc())            .limit(1)
        ).scalar_one_or_none()

        library_data.append({
            "id": sticker.id,
            "title": sticker.title,
            "petr_dropper": sticker.petr_dropper,
            "drop_date": sticker.drop_date,
            "thumbnail": primary_image["paths"]["thumbnail"] if primary_image else None
        })
    
    return library_data

@router.get("/{sticker_id}")
def get_sticker_details(sticker_id: int, db: Session = Depends(get_db)):
    sticker = db.get(StickerLibrary, sticker_id)
    if not sticker:
        raise HTTPException(status_code=404, detail="Sticker not found")
    
    # Get all images for this sticker
    images = db.execute(
        select(MediaAsset.json_metadata)
        .join(StickerLibraryImage, MediaAsset.id == StickerLibraryImage.asset_id)
        .where(StickerLibraryImage.sticker_id == sticker_id)
        .order_by(StickerLibraryImage.order_index.asc())
    ).scalars().all()

    return {
        "id": sticker.id,
        "title": sticker.title,
        "petr_dropper": sticker.petr_dropper,
        "drop_date": sticker.drop_date,
        "description": sticker.description,
        "images": images,
        "created_at": sticker.created_at,
        "added_by": sticker.added_by.username if sticker.added_by else "System"
    }

@router.post("/upload")
def upload_sticker(
    request: Request,
    title: str = Form(...),
    petr_dropper: Optional[str] = Form(None),
    drop_date: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    images: List[UploadFile] = File(...),
    current_user: UserSearch = Depends(authenthicate_access_token),
    db: Session = Depends(get_db)
):
    user_id = current_user.user_id
    all_created_files = []
    
    try:
        sticker = StickerLibrary(
            title=title,
            petr_dropper=petr_dropper,
            drop_date=drop_date,
            description=description,
            added_by_user_id=user_id
        )
        db.add(sticker)
        db.flush()

        for i, image_file in enumerate(images):
            # Reuse process_and_save_image with 'library' prefix
            image_data = process_and_save_image(image_file, user_id, folder_prefix="library")
            all_created_files.extend(image_data["paths"].values())

            asset = MediaAsset(
                uploader_id=user_id,
                file_url=image_data["paths"]["original"],
                s3_key=f"library/{user_id}/original/{image_data['filename']}",
                json_metadata={
                    "paths": image_data["paths"],
                    "dimensions": image_data["dimensions"]
                },
                status=AssetStatus.ATTACHED
            )
            db.add(asset)
            db.flush()

            sticker_image = StickerLibraryImage(
                sticker_id=sticker.id,
                asset_id=asset.id,
                order_index=i + 1
            )
            db.add(sticker_image)

        db.commit()
        return {"id": sticker.id, "message": "Sticker added to library"}

    except HTTPException:
        db.rollback()
        for path in all_created_files:
            try:
                delete_file(path)
            except Exception:
                pass
        raise
    except Exception as e:
        db.rollback()
        for path in all_created_files:
            try:
                delete_file(path)
            except Exception:
                pass
        logger.error(f"Library upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
