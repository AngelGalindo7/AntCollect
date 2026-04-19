import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session
from backend.models import Post, User

@pytest.mark.asyncio
async def test_delete_post_success(auth_client: AsyncClient, db: Session):
    # 1. Create a post
    # Note: upload-post requires multipart form data with files.
    # We can simplify by creating a Post record directly in the DB if we don't care about file processing in this test,
    # or we can use the endpoint. Let's try the endpoint.
    
    # We need to mock the image upload part if we use the endpoint,
    # but conftest.py already mocks s3.upload_image_bytes.
    
    files = [
        ("post_images", ("test.jpg", b"fake-image-content", "image/jpeg"))
    ]
    data = {
        "caption": "Test post for deletion",
        "post_type": "collection",
        "is_published": "true"
    }
    
    response = await auth_client.post("/posts/upload-post", data=data, files=files)
    assert response.status_code == 200
    post_id = response.json()["post_id"]

    # 2. Delete the post
    delete_response = await auth_client.delete(f"/posts/{post_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["message"] == "Post deleted successfully"

    # 3. Verify it's gone
    post_in_db = db.query(Post).filter(Post.id == int(post_id)).first()
    assert post_in_db is None

@pytest.mark.asyncio
async def test_delete_post_unauthorized(auth_client: AsyncClient, client: AsyncClient, db: Session):
    # 1. Create a post with User A (auth_client)
    files = [
        ("post_images", ("test.jpg", b"fake-image-content", "image/jpeg"))
    ]
    data = {
        "caption": "User A's post",
        "post_type": "collection",
        "is_published": "true"
    }
    response = await auth_client.post("/posts/upload-post", data=data, files=files)
    assert response.status_code == 200
    post_id = response.json()["post_id"]

    # 2. Create and Login with User B
    user_b_creds = {
        "username": "user_b",
        "email": "user_b@example.com",
        "password": "TestPass1234!"
    }
    await client.post("/users/create-user", json=user_b_creds)
    await client.post("/users/login", json={"email": user_b_creds["email"], "password": user_b_creds["password"]})
    # 'client' is now logged in as User B because httpx.AsyncClient stores cookies (if using them)
    # Wait, the auth_client fixture in conftest.py returns 'client'.
    # Actually, httpx.AsyncClient doesn't automatically handle session cookies unless you use httpx.Client/AsyncClient(cookies=...).
    # But wait, backend uses 'authenthicate_access_token' which probably looks at headers or cookies.
    # Let's check backend/utils/auth.py
    
    # Actually, let's just create another auth_client for User B.
    # Or just use the 'auth_client' for User A and another client for User B.
    
    # Re-login User B to get a token and set it in the client
    login_res = await client.post("/users/login", json={"email": user_b_creds["email"], "password": user_b_creds["password"]})
    token = login_res.cookies.get("access_token")
    # If the backend uses cookies for auth, 'client' will have them.
    
    # 3. Try to delete User A's post with User B's client
    delete_response = await client.delete(f"/posts/{post_id}")
    assert delete_response.status_code == 403
    assert "Not authorized" in delete_response.json()["detail"]

@pytest.mark.asyncio
async def test_delete_post_not_found(auth_client: AsyncClient):
    response = await auth_client.delete("/posts/999999")
    assert response.status_code == 404
    assert "Post not found" in response.json()["detail"]
