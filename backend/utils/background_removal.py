import ipaddress
import os
import socket
import urllib.request
from urllib.parse import urlparse

from fastapi import HTTPException

_REMOVE_BG_FETCH_TIMEOUT = 15
_REMOVE_BG_HOST_ALLOWLIST_ENV = "REMOVE_BG_ALLOWED_HOSTS"

# Cached rembg session — loaded once on first use, reused for all subsequent requests.
# u2netp is ~4.7 MB vs ~170 MB for u2net and 3-4x faster on CPU at acceptable quality.
_rembg_session = None


def validate_external_image_url(url: str) -> None:
    """
    Reject SSRF vectors before fetching a user-supplied URL.
    Blocks non-http(s) schemes and hosts that resolve to private/loopback/
    link-local/reserved IPs (e.g. EC2 IMDS at 169.254.169.254). Hostnames
    listed in REMOVE_BG_ALLOWED_HOSTS bypass the IP check so LocalStack/dev
    setups using `localhost` still work.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Invalid image URL")

    host = parsed.hostname
    if not host:
        raise HTTPException(400, "Invalid image URL")

    allowlist_raw = os.getenv(_REMOVE_BG_HOST_ALLOWLIST_ENV, "")
    allowlist = {h.strip().lower() for h in allowlist_raw.split(",") if h.strip()}
    if host.lower() in allowlist:
        return

    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise HTTPException(400, "Could not resolve image host")

    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise HTTPException(400, "Image host is not allowed")


def get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        try:
            from rembg import new_session
            _rembg_session = new_session("u2netp")
        except BaseException as exc:
            raise RuntimeError("rembg unavailable") from exc
    return _rembg_session


def fetch_and_remove_background(image_url: str) -> bytes:
    """Validate the URL (SSRF guard), fetch the image, and return the cut-out PNG bytes.
    Raises HTTPException(400) on fetch/validation failure and HTTPException(500) if rembg fails."""
    validate_external_image_url(image_url)

    try:
        req = urllib.request.Request(image_url, headers={"User-Agent": "PetrCollect/1.0"})
        with urllib.request.urlopen(req, timeout=_REMOVE_BG_FETCH_TIMEOUT) as resp:
            image_bytes = resp.read()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Could not fetch image")

    try:
        from rembg import remove as rembg_remove
        return rembg_remove(image_bytes, session=get_rembg_session())
    except BaseException:
        raise HTTPException(500, "Background removal failed")
