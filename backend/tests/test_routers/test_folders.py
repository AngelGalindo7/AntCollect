import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models import Folder, FolderPost, Post, PostImage


async def _create_folder(client: AsyncClient, *, name: str = "Test Folder", folder_type: str = "collection") -> int:
    res = await client.post(
        "/folders",
        json={
            "name": name,
            "description": None,
            "is_public": True,
            "folder_type": folder_type,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["id"]


@pytest.mark.asyncio
async def test_folder_upload_creates_posts_and_attaches(auth_client: AsyncClient, db: Session):
    folder_id = await _create_folder(auth_client, folder_type="trading")

    files = [
        ("files", (f"sticker_{i}.jpg", b"fake-bytes", "image/jpeg"))
        for i in range(3)
    ]
    res = await auth_client.post(
        f"/folders/{folder_id}/upload",
        data={"is_published": "true"},
        files=files,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["folder_id"] == folder_id
    assert body["image_count"] == 3
    post_id = body["post_id"]

    post = db.query(Post).filter(Post.id == post_id).one()
    assert post.type == "trading"

    image_count = db.query(PostImage).filter(PostImage.post_id == post_id).count()
    assert image_count == 3

    fp_rows = (
        db.query(FolderPost)
        .filter(FolderPost.folder_id == folder_id)
        .order_by(FolderPost.order_index)
        .all()
    )
    assert [fp.post_id for fp in fp_rows] == [post_id]
    assert [fp.order_index for fp in fp_rows] == [1]


@pytest.mark.asyncio
async def test_folder_upload_appends_after_existing_posts(auth_client: AsyncClient, db: Session):
    folder_id = await _create_folder(auth_client)

    # Pre-existing post attached at order_index = 7
    pre_post = Post(user_id=db.query(Folder).get(folder_id).user_id, type="collection", is_published=True)
    db.add(pre_post)
    db.flush()
    db.add(FolderPost(folder_id=folder_id, post_id=pre_post.id, order_index=7))
    db.commit()

    files = [("files", ("a.jpg", b"x", "image/jpeg"))]
    res = await auth_client.post(f"/folders/{folder_id}/upload", files=files)
    assert res.status_code == 201

    new_id = res.json()["post_id"]
    new_fp = (
        db.query(FolderPost)
        .filter(FolderPost.folder_id == folder_id, FolderPost.post_id == new_id)
        .one()
    )
    assert new_fp.order_index == 8


@pytest.mark.asyncio
async def test_folder_upload_rejects_non_owner(auth_client: AsyncClient, client: AsyncClient):
    folder_id = await _create_folder(auth_client)

    other = {"username": "other_user", "email": "other@example.com", "password": "TestPass1234!"}
    await client.post("/users/create-user", json=other)
    await client.post("/users/login", json={"email": other["email"], "password": other["password"]})

    files = [("files", ("a.jpg", b"x", "image/jpeg"))]
    res = await client.post(f"/folders/{folder_id}/upload", files=files)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_folder_upload_folder_not_found(auth_client: AsyncClient):
    files = [("files", ("a.jpg", b"x", "image/jpeg"))]
    res = await auth_client.post("/folders/999999/upload", files=files)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_folder_upload_too_many_files(auth_client: AsyncClient):
    folder_id = await _create_folder(auth_client)
    files = [("files", (f"a{i}.jpg", b"x", "image/jpeg")) for i in range(21)]
    res = await auth_client.post(f"/folders/{folder_id}/upload", files=files)
    assert res.status_code == 400
    assert "max" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_folder_upload_unauthenticated(client: AsyncClient):
    files = [("files", ("a.jpg", b"x", "image/jpeg"))]
    res = await client.post("/folders/1/upload", files=files)
    assert res.status_code == 401
