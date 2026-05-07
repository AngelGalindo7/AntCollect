"""Backfill CLIP embeddings for every sticker that doesn't have one yet.

Usage:
    LIBRARY_EMBEDDINGS_ENABLED=true python -m backend.scripts.backfill_sticker_embeddings
    LIBRARY_EMBEDDINGS_ENABLED=true python -m backend.scripts.backfill_sticker_embeddings --limit 50
"""
import argparse
import logging
import sys

from sqlalchemy import select

from backend.database import SessionLocal
from backend.models import StickerLibrary, StickerLibraryImage, MediaAsset
from backend.utils import embeddings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("backfill_embeddings")


def _primary_image_url(db, sticker_id: int) -> str | None:
    metadata = db.execute(
        select(MediaAsset.json_metadata)
        .join(StickerLibraryImage, MediaAsset.id == StickerLibraryImage.asset_id)
        .where(StickerLibraryImage.sticker_id == sticker_id)
        .order_by(StickerLibraryImage.order_index.asc())
        .limit(1)
    ).scalar_one_or_none()

    if not metadata:
        return None
    return metadata.get("paths", {}).get("medium")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="max stickers to process")
    parser.add_argument("--batch-size", type=int, default=25, help="commit every N rows")
    args = parser.parse_args()

    if not embeddings.embeddings_enabled():
        logger.error(
            "LIBRARY_EMBEDDINGS_ENABLED is not 'true' — set it before running this script"
        )
        return 1

    processed = 0
    updated = 0
    skipped = 0

    with SessionLocal() as db:
        query = select(StickerLibrary).where(StickerLibrary.embedding.is_(None))
        if args.limit is not None:
            query = query.limit(args.limit)

        stickers = db.execute(query).scalars().all()
        total = len(stickers)
        logger.info("found %d stickers without embeddings", total)

        for sticker in stickers:
            processed += 1
            image_url = _primary_image_url(db, sticker.id)
            vector = embeddings.embed_sticker(image_url, sticker.title)

            if vector is None:
                skipped += 1
                logger.warning(
                    "sticker id=%s title=%r could not be embedded (no usable image or text)",
                    sticker.id, sticker.title,
                )
            else:
                sticker.embedding = vector
                updated += 1

            if processed % args.batch_size == 0:
                db.commit()
                logger.info("progress: %d/%d (updated=%d skipped=%d)",
                            processed, total, updated, skipped)

        db.commit()

    logger.info("done: processed=%d updated=%d skipped=%d", processed, updated, skipped)
    return 0


if __name__ == "__main__":
    sys.exit(main())
