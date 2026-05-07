import io
import logging
import os
from threading import Lock
from typing import Optional

import numpy as np
import requests
from PIL import Image

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 512
MODEL_NAME = "clip-ViT-B-32"
_HTTP_TIMEOUT_S = 15

_model = None
_model_lock = Lock()


def embeddings_enabled() -> bool:
    return os.getenv("LIBRARY_EMBEDDINGS_ENABLED", "false").lower() == "true"


def _load_model():
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is None:
            from sentence_transformers import SentenceTransformer
            logger.info("loading CLIP model: %s", MODEL_NAME)
            _model = SentenceTransformer(MODEL_NAME)
    return _model


def _normalize(vec: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm


def embed_text(text: str) -> list[float]:
    model = _load_model()
    vec = model.encode(text, convert_to_numpy=True)
    return _normalize(vec).astype(np.float32).tolist()


def embed_image_url(url: str) -> Optional[list[float]]:
    try:
        resp = requests.get(url, timeout=_HTTP_TIMEOUT_S)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning("image fetch failed url=%s err=%s", url, e)
        return None

    try:
        image = Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as e:
        logger.warning("image decode failed url=%s err=%s", url, e)
        return None

    model = _load_model()
    vec = model.encode(image, convert_to_numpy=True)
    return _normalize(vec).astype(np.float32).tolist()


def embed_sticker(image_url: Optional[str], title: Optional[str]) -> Optional[list[float]]:
    """Fused image+title embedding. Falls back to text-only if the image is unreachable
    or to image-only if title is empty. Returns None when neither is usable."""
    img_vec = embed_image_url(image_url) if image_url else None
    txt_vec = embed_text(title) if title else None

    if img_vec is None and txt_vec is None:
        return None
    if img_vec is None:
        return txt_vec
    if txt_vec is None:
        return img_vec

    fused = (np.asarray(img_vec) + np.asarray(txt_vec)) / 2.0
    return _normalize(fused).astype(np.float32).tolist()
