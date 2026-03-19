"""post_image to media_assets data_migration

Revision ID: fb213458d04c
Revises: 9a8c9e386289
Create Date: 2026-02-24 21:20:14.153003

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb213458d04c'
down_revision: Union[str, Sequence[str], None] = '9a8c9e386289'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    # ── Step 1: Copy post_images into media_assets ────────────────────────────
    # - uploader_id  : comes from posts.user_id via post_id FK
    # - file_url     : the original-size path stored in json_metadata,
    #                  NOT the bare filename column which has no path info
    # - json_metadata: carried over as-is (keeps all size variants intact)
    op.execute("""
        INSERT INTO media_assets (uploader_id, file_url, json_metadata, status, upload_time)
        SELECT
            p.user_id                                    AS uploader_id,
            pi.json_metadata->'paths'->>'original'       AS file_url,
            pi.json_metadata                             AS json_metadata,
            'ATTACHED'                                   AS status,
            pi.upload_time                               AS upload_time
        FROM post_images pi
        JOIN posts p ON p.id = pi.post_id
        WHERE pi.json_metadata->'paths'->>'original' IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM media_assets ma
              WHERE ma.file_url = pi.json_metadata->'paths'->>'original'
          );
    """)

    # ── Step 2: Back-fill asset_id on post_images ─────────────────────────────
    # Match on the original path since that's what we used as file_url above
    op.execute("""
        UPDATE post_images pi
        SET    asset_id = ma.id
        FROM   media_assets ma
        WHERE  ma.file_url = pi.json_metadata->'paths'->>'original'
          AND  pi.asset_id IS NULL;
    """)

    # ── Step 3: Verify inside the same transaction ────────────────────────────
    # Any failure raises a Postgres exception → full rollback automatically
    op.execute("""
        DO $$
        DECLARE
            unlinked     INT;
            no_uploader  INT;
            no_file_url  INT;
            bad_paths    INT;
        BEGIN
            -- post_images rows with no asset_id after back-fill
            SELECT COUNT(*) INTO unlinked
            FROM post_images
            WHERE asset_id IS NULL;

            -- media_assets rows missing uploader (should be zero)
            SELECT COUNT(*) INTO no_uploader
            FROM media_assets
            WHERE uploader_id IS NULL;

            -- media_assets rows missing file_url (should be zero)
            SELECT COUNT(*) INTO no_file_url
            FROM media_assets
            WHERE file_url IS NULL;

            -- post_images rows where json_metadata had no original path
            -- (these would have been silently skipped in step 1)
            SELECT COUNT(*) INTO bad_paths
            FROM post_images
            WHERE json_metadata->'paths'->>'original' IS NULL;

            IF bad_paths > 0 THEN
                RAISE EXCEPTION
                    'Migration warning: % post_images rows have no paths.original in json_metadata — inspect before proceeding',
                    bad_paths;
            END IF;
            IF unlinked > 0 THEN
                RAISE EXCEPTION
                    'Migration failed: % post_images rows still have NULL asset_id',
                    unlinked;
            END IF;
            IF no_uploader > 0 THEN
                RAISE EXCEPTION
                    'Migration failed: % media_assets rows have NULL uploader_id',
                    no_uploader;
            END IF;
            IF no_file_url > 0 THEN
                RAISE EXCEPTION
                    'Migration failed: % media_assets rows have NULL file_url',
                    no_file_url;
            END IF;

            RAISE NOTICE 'Phase 2 data migration verified successfully.';
        END $$;
    """)


def downgrade():
    op.execute("UPDATE post_images SET asset_id = NULL WHERE asset_id IS NOT NULL;")
    op.execute("DELETE FROM media_assets WHERE status = 'ATTACHED';")
