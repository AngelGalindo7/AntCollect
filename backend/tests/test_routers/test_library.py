import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session
from backend.models import StickerLibrary, StickerLibraryImage, MediaAsset

@pytest.mark.asyncio
async def test_upload_sticker_success(auth_client: AsyncClient, db: Session):
    files = [
        ("images", ("sticker.jpg", b"fake-sticker-content", "image/jpeg"))
    ]
    data = {
        "title": "Test Sticker",
        "petr_dropper": "Test Dropper",
        "drop_date": "Spring 2026",
        "description": "A very rare test sticker"
    }
    
    response = await auth_client.post("/library/upload", data=data, files=files)
    assert response.status_code == 200
    sticker_id = response.json()["id"]

    # Verify DB state
    sticker = db.get(StickerLibrary, sticker_id)
    assert sticker is not None
    assert sticker.title == "Test Sticker"
    assert len(sticker.images) == 1
    assert sticker.images[0].asset_id is not None

@pytest.mark.asyncio
async def test_get_library_empty(client: AsyncClient):
    response = await client.get("/library/")
    assert response.status_code == 200
    assert response.json() == []

@pytest.mark.asyncio
async def test_get_library_with_search(auth_client: AsyncClient, db: Session):
    # Setup: Add two stickers
    s1 = StickerLibrary(title="Blue Petr", petr_dropper="Alice")
    s2 = StickerLibrary(title="Red Petr", petr_dropper="Bob")
    db.add_all([s1, s2])
    db.commit()

    # Search for "Blue"
    response = await auth_client.get("/library/?search=Blue")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Blue Petr"

@pytest.mark.asyncio
async def test_get_sticker_details(auth_client: AsyncClient, db: Session):
    # 1. Upload a sticker first
    files = [
        ("images", ("sticker.jpg", b"content", "image/jpeg"))
    ]
    data = {"title": "Detail Test"}
    res = await auth_client.post("/library/upload", data=data, files=files)
    sticker_id = res.json()["id"]

    # 2. Get details
    response = await auth_client.get(f"/library/{sticker_id}")
    assert response.status_code == 200
    details = response.json()
    assert details["title"] == "Detail Test"
    assert len(details["images"]) == 1
    assert "paths" in details["images"][0]

@pytest.mark.asyncio
async def test_upload_sticker_unauthorized(client: AsyncClient):
    files = [("images", ("sticker.jpg", b"content", "image/jpeg"))]
    data = {"title": "Unauthorized Test"}
    response = await client.post("/library/upload", data=data, files=files)
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_sticker_not_found(client: AsyncClient):
    response = await client.get("/library/999999")
    assert response.status_code == 404
