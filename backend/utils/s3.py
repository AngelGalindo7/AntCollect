import logging
import os
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException

logger = logging.getLogger(__name__)

_s3_client = None


def _get_client():
    global _s3_client
    if _s3_client is None:
        endpoint_url = os.getenv("AWS_ENDPOINT_URL")
        # For LocalStack, we often need to provide dummy credentials
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            endpoint_url=endpoint_url,
        )
    return _s3_client


def upload_image_bytes(key: str, image_bytes: bytes, content_type: str) -> str:
    bucket = os.getenv("AWS_S3_BUCKET")
    region = os.getenv("AWS_REGION", "us-east-1")
    internal_endpoint = os.getenv("AWS_ENDPOINT_URL")
    cf_domain = os.getenv("CLOUDFRONT_DOMAIN")

    try:
        _get_client().put_object(
            Bucket=bucket,
            Key=key,
            Body=image_bytes,
            ContentType=content_type,
        )
    except ClientError:
        logger.error("S3 upload failed", exc_info=True)
        raise HTTPException(status_code=500, detail="S3 upload failed")

    # Use a separate public-facing URL for local dev if configured,
    # otherwise fall back to the internal endpoint.
    public_endpoint = os.getenv("AWS_S3_PUBLIC_ENDPOINT_URL", internal_endpoint)

    # LocalStack / custom endpoint — path-style URL, no CloudFront
    if public_endpoint:
        return f"{public_endpoint.rstrip('/')}/{bucket}/{key}"

    # Production: prefer CloudFront when configured; S3 bucket is not public
    if cf_domain:
        return f"https://{cf_domain}/{key}"

    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def delete_s3_object(key: str) -> None:
    bucket = os.getenv("AWS_S3_BUCKET")
    try:
        _get_client().delete_object(Bucket=bucket, Key=key)
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "NoSuchKey":
            return
        logger.error("S3 delete failed", exc_info=True)
        raise HTTPException(status_code=500, detail="S3 delete failed")


def s3_key_from_url(url: str) -> str | None:
    if not url:
        return None

    # If it doesn't look like a URL, assume it's already a key.
    # This makes deletion more robust.
    if not url.startswith("https://") and not url.startswith("http://"):
        return url

    parsed = urlparse(url)
    endpoint_url = os.getenv("AWS_ENDPOINT_URL")
    public_endpoint = os.getenv("AWS_S3_PUBLIC_ENDPOINT_URL")
    cf_domain = os.getenv("CLOUDFRONT_DOMAIN")
    bucket = os.getenv("AWS_S3_BUCKET")

    # LocalStack URL (internal or public-facing): http://localhost:4566/bucket/key
    for ep in (endpoint_url, public_endpoint):
        if ep and url.startswith(ep):
            path = parsed.path.lstrip("/")
            if path.startswith(f"{bucket}/"):
                return path[len(bucket) + 1:]
            return path

    # CloudFront URL: https://cf-domain/key
    if cf_domain and parsed.netloc == cf_domain:
        key = parsed.path.lstrip("/")
        return key if key else None

    # Standard AWS S3 URL: https://bucket.s3.region.amazonaws.com/key
    key = parsed.path.lstrip("/")
    if not key:
        return None
    return key
