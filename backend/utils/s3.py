import os
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException

_s3_client = None


def _get_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION"),
        )
    return _s3_client


def upload_image_bytes(key: str, image_bytes: bytes, content_type: str) -> str:
    bucket = os.getenv("AWS_S3_BUCKET")
    region = os.getenv("AWS_REGION")
    try:
        _get_client().put_object(
            Bucket=bucket,
            Key=key,
            Body=image_bytes,
            ContentType=content_type,
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"S3 upload failed: {e}")
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def delete_s3_object(key: str) -> None:
    bucket = os.getenv("AWS_S3_BUCKET")
    try:
        _get_client().delete_object(Bucket=bucket, Key=key)
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "NoSuchKey":
            return
        raise HTTPException(status_code=500, detail=f"S3 delete failed: {e}")


def s3_key_from_url(url: str) -> str | None:
    if not url.startswith("https://"):
        return None
    parsed = urlparse(url)
    # path starts with '/', strip it to get the key
    key = parsed.path.lstrip("/")
    if not key:
        return None
    return key
