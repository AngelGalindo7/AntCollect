import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from backend.models import User
from backend.models.workspace import Panel, Workspace


@pytest.mark.asyncio
async def test_get_me_auto_creates_empty_workspace(auth_client: AsyncClient, db: Session):
    res = await auth_client.get("/workspace/me")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["panels"] == []
    assert body["workspace"]["z_counter"] == 0
    assert isinstance(body["workspace"]["id"], int)


@pytest.mark.asyncio
async def test_get_me_is_idempotent(auth_client: AsyncClient):
    first = await auth_client.get("/workspace/me")
    second = await auth_client.get("/workspace/me")
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["workspace"]["id"] == second.json()["workspace"]["id"]


@pytest.mark.asyncio
async def test_create_panel_without_rect_picks_default_spot(auth_client: AsyncClient):
    res = await auth_client.post("/workspace/me/panels", json={})
    assert res.status_code == 200, res.text
    panel = res.json()
    assert panel["w"] >= 280 and panel["h"] >= 220
    assert panel["x"] >= 0 and panel["y"] >= 0
    assert panel["z"] == 1


@pytest.mark.asyncio
async def test_create_panel_with_explicit_rect(auth_client: AsyncClient):
    res = await auth_client.post(
        "/workspace/me/panels",
        json={"rect": {"x": 100, "y": 200, "w": 400, "h": 300}, "title": "My Panel"},
    )
    assert res.status_code == 200, res.text
    panel = res.json()
    assert panel["x"] == 100 and panel["y"] == 200
    assert panel["w"] == 400 and panel["h"] == 300
    assert panel["title"] == "My Panel"


@pytest.mark.asyncio
async def test_create_panel_rejects_undersized_rect(auth_client: AsyncClient):
    res = await auth_client.post(
        "/workspace/me/panels",
        json={"rect": {"x": 0, "y": 0, "w": 200, "h": 100}},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_patch_panel_partial_update_persists(auth_client: AsyncClient, db: Session):
    create = await auth_client.post("/workspace/me/panels", json={})
    panel_id = create.json()["id"]

    res = await auth_client.patch(
        f"/workspace/me/panels/{panel_id}",
        json={"title": "Renamed", "locked": True},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "Renamed"
    assert body["locked"] is True
    assert body["accent"] is None

    db.expire_all()
    row = db.get(Panel, panel_id)
    assert row.title == "Renamed"
    assert row.locked is True


@pytest.mark.asyncio
async def test_put_panel_canvas_stores_json(auth_client: AsyncClient):
    create = await auth_client.post("/workspace/me/panels", json={})
    panel_id = create.json()["id"]

    canvas_state = {"nodes": [{"id": "n1", "type": "image", "x": 10, "y": 10}]}
    res = await auth_client.put(
        f"/workspace/me/panels/{panel_id}/canvas",
        json={"canvas_json": canvas_state},
    )
    assert res.status_code == 200, res.text
    assert res.json()["canvas_json"] == canvas_state


@pytest.mark.asyncio
async def test_delete_panel_cascades(auth_client: AsyncClient, db: Session):
    create = await auth_client.post("/workspace/me/panels", json={})
    panel_id = create.json()["id"]

    res = await auth_client.delete(f"/workspace/me/panels/{panel_id}")
    assert res.status_code == 204

    db.expire_all()
    assert db.get(Panel, panel_id) is None


@pytest.mark.asyncio
async def test_delete_foreign_panel_returns_404(
    auth_client: AsyncClient, client: AsyncClient
):
    create = await auth_client.post("/workspace/me/panels", json={})
    panel_id = create.json()["id"]

    other = {"username": "ws_other", "email": "ws_other@example.com", "password": "TestPass1234!"}
    await client.post("/users/create-user", json=other)
    await client.post(
        "/users/login",
        json={"identifier": other["email"], "password": other["password"]},
    )

    res = await client.delete(f"/workspace/me/panels/{panel_id}")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_public_workspace_returns_data_without_auth(
    auth_client: AsyncClient, client: AsyncClient, db: Session, test_credentials: dict
):
    create = await auth_client.post(
        "/workspace/me/panels",
        json={"rect": {"x": 0, "y": 0, "w": 320, "h": 240}, "title": "Public"},
    )
    assert create.status_code == 200
    username = test_credentials["username"]

    fresh = AsyncClient(transport=client._transport, base_url=client.base_url)
    try:
        res = await fresh.get(f"/workspace/{username}")
    finally:
        await fresh.aclose()

    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["panels"]) == 1
    assert body["panels"][0]["title"] == "Public"


@pytest.mark.asyncio
async def test_public_workspace_unknown_user_returns_404(client: AsyncClient):
    res = await client.get("/workspace/no_such_user_xyz")
    assert res.status_code == 404
