from fastapi import UploadFile
from sqlalchemy.orm import Session

from backend.models import MediaAsset, Post, PostImage
from backend.models.media_assets import AssetStatus

from .files import process_and_save_image


def create_post_with_images(
    db: Session,
    *,
    user_id: int,
    caption: str | None,
    post_type: str,
    is_published: bool,
    files: list[UploadFile],
    created_paths_sink: list[str],
) -> Post:
    post = Post(
        user_id=user_id,
        caption=caption.strip() if caption and caption.strip() else None,
        type=post_type,
        is_published=is_published,
    )
    db.add(post)
    db.flush()

    image_records: list[PostImage] = []
    for i, image in enumerate(files):
        image_data = process_and_save_image(image, user_id)
        created_paths_sink.extend(image_data["paths"].values())

        asset = MediaAsset(
            uploader_id=user_id,
            file_url=image_data["paths"]["original"],
            s3_key=f"posts/{user_id}/original/{image_data['filename']}",
            json_metadata={
                "paths": {
                    "thumbnail": image_data["paths"]["thumbnail"],
                    "medium": image_data["paths"]["medium"],
                    "original": image_data["paths"]["original"],
                },
                "original_width": image_data["dimensions"]["original"]["width"],
                "original_height": image_data["dimensions"]["original"]["height"],
            },
            status=AssetStatus.ATTACHED,
        )
        db.add(asset)
        db.flush()

        image_records.append(
            PostImage(post_id=post.id, order_index=i + 1, asset_id=asset.id)
        )

    db.add_all(image_records)
    db.flush()
    return post
