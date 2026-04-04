import os

import pytest
import pytest_asyncio
from dotenv import load_dotenv
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

load_dotenv()

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")

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


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient):
    await client.post(
        "/users/login",
        json={
            "email": os.getenv("TEST_USER_EMAIL"),
            "password": os.getenv("TEST_USER_PASSWORD"),
        },
    )
    return client
