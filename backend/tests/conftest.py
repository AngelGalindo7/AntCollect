import os
import uuid
from unittest.mock import patch

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

load_dotenv()

os.environ["TESTING"] = "true"

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

_FAKE_S3_URL = "https://test-bucket.s3.us-east-1.amazonaws.com/posts/1/original/test.jpg"


@pytest.fixture(autouse=True, scope="session")
def mock_s3():
    """
    Replace the boto3 S3 client with a mock for all tests.
    upload_image_bytes returns a deterministic fake S3 URL.
    delete_s3_object is a no-op.
    This prevents any test from requiring real AWS credentials.
    """
    with patch("backend.utils.s3.upload_image_bytes", return_value=_FAKE_S3_URL) as mock_upload, \
         patch("backend.utils.s3.delete_s3_object", return_value=None) as mock_delete:
        yield {"upload": mock_upload, "delete": mock_delete}


@pytest.fixture(autouse=True, scope="session")
def mock_image_processing():
    """
    Mock process_and_save_image to return a fake result dict.
    This avoids real Pillow processing and speeds up tests.
    """
    fake_result = {
        "filename": "test.jpg",
        "mime_type": "image/jpeg",
        "paths": {
            "original": _FAKE_S3_URL,
            "thumbnail": _FAKE_S3_URL,
            "medium": _FAKE_S3_URL,
        },
        "sizes": {
            "original": 100,
            "thumbnail": 50,
            "medium": 75,
        },
        "dimensions": {
            "original": {"width": 800, "height": 600},
            "thumbnail": {"width": 150, "height": 112},
            "medium": {"width": 800, "height": 600},
        },
    }
    with patch("backend.routers.library.process_and_save_image", return_value=fake_result), \
         patch("backend.routers.posts.process_and_save_image", return_value=fake_result), \
         patch("backend.routers.users.process_and_save_image", return_value=fake_result), \
         patch("backend.routers.folders.process_and_save_image", return_value=fake_result), \
         patch("backend.utils.posts_creation.process_and_save_image", return_value=fake_result):
        yield

from backend.database import get_db  # noqa: E402
from backend.main import app  # noqa: E402

test_engine = create_engine(TEST_DATABASE_URL)


@pytest.fixture
def db():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest_asyncio.fixture
async def client(db: Session):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def test_credentials() -> dict:
    """Fresh credentials for each test — rolled back by the db fixture."""
    suffix = uuid.uuid4().hex[:8]
    return {
        "username": f"testauth_{suffix}",
        "email": f"testauth_{suffix}@example.com",
        "password": "TestPass1234!",
    }


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient, test_credentials: dict):
    """Create a unique test user, log in, and return the authenticated client."""
    await client.post("/users/create-user", json=test_credentials)
    await client.post(
        "/users/login",
        json={
            "email": test_credentials["email"],
            "password": test_credentials["password"],
        },
    )
    return client
