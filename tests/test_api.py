import os
import time
import pytest
from fastapi.testclient import TestClient

# Set temporary database path for tests
os.environ["DATABASE_PATH"] = "./data/test_passdrop.db"
os.environ["DEFAULT_EXPIRE_HOURS"] = "2"
os.environ["DEFAULT_MAX_VIEWS"] = "3"
os.environ["PASSWORD_LENGTH"] = "16"

from app.main import app
from app.utils import normalize_filename, generate_random_password
from app.database import init_db, get_connection


@pytest.fixture(autouse=True)
def setup_and_teardown():
    # Setup test DB
    init_db()
    with get_connection() as conn:
        conn.execute("DELETE FROM passwords;")
        conn.commit()
    yield
    # Teardown
    with get_connection() as conn:
        conn.execute("DELETE FROM passwords;")
        conn.commit()


client = TestClient(app)


def test_normalize_filename():
    key, display = normalize_filename("  MyArchive.zip  ")
    assert key == "myarchive"
    assert display == "MyArchive"

    key, display = normalize_filename("Backup_2026.tar.gz")
    assert key == "backup_2026"
    assert display == "Backup_2026"

    key, display = normalize_filename("SecretData.7z")
    assert key == "secretdata"
    assert display == "SecretData"


def test_generate_random_password():
    pwd1 = generate_random_password(16)
    assert len(pwd1) == 16
    assert any(c.isupper() for c in pwd1)
    assert any(c.islower() for c in pwd1)
    assert any(c.isdigit() for c in pwd1)


def test_generate_and_fetch_password():
    # 1. Generate password for 'ProjectAlpha'
    resp = client.post(
        "/api/generate",
        json={"filename": "ProjectAlpha", "force": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["filename"] == "ProjectAlpha"
    generated_pwd = data["password"]
    assert len(generated_pwd) == 16

    # 2. Recipient fetches password using 'projectalpha.zip' (case + extension tolerance)
    resp_fetch1 = client.post("/api/fetch", json={"filename": "projectalpha.zip"})
    assert resp_fetch1.status_code == 200
    fetch1 = resp_fetch1.json()
    assert fetch1["ok"] is True
    assert fetch1["password"] == generated_pwd
    assert fetch1["views_left"] == 2
    assert fetch1["view_count"] == 1

    # 3. Recipient fetches again (2nd view)
    resp_fetch2 = client.post("/api/fetch", json={"filename": "ProjectAlpha"})
    assert resp_fetch2.json()["views_left"] == 1

    # 4. Recipient fetches again (3rd view, reaching limit of 3)
    resp_fetch3 = client.post("/api/fetch", json={"filename": "ProjectAlpha"})
    assert resp_fetch3.json()["views_left"] == 0

    # 5. 4th view should fail (exhausted)
    resp_fetch4 = client.post("/api/fetch", json={"filename": "ProjectAlpha"})
    fetch4 = resp_fetch4.json()
    assert fetch4["ok"] is False
    assert "上限" in fetch4["message"] or "失效" in fetch4["message"]


def test_overwrite_requires_confirmation_and_clears_old():
    # Generate initial password
    resp1 = client.post(
        "/api/generate",
        json={"filename": "Report2026", "force": False},
    )
    assert resp1.json()["ok"] is True
    old_pwd = resp1.json()["password"]
    assert len(old_pwd) == 16

    # Attempt to generate again without force -> should report EXISTS
    resp2 = client.post(
        "/api/generate",
        json={"filename": "Report2026.zip", "force": False},
    )
    data2 = resp2.json()
    assert data2["ok"] is False
    assert data2["code"] == "EXISTS"
    assert "existing" in data2

    # Now confirm overwrite with force=True
    resp3 = client.post(
        "/api/generate",
        json={"filename": "Report2026", "force": True},
    )
    data3 = resp3.json()
    assert data3["ok"] is True
    new_pwd = data3["password"]
    assert new_pwd != old_pwd  # New password generated
    assert len(new_pwd) == 16
    assert data3["is_overwrite"] is True

    # Check that view count is completely reset to 0/3
    fetch_resp = client.post("/api/fetch", json={"filename": "Report2026"})
    assert fetch_resp.json()["ok"] is True
    assert fetch_resp.json()["password"] == new_pwd
    assert fetch_resp.json()["views_left"] == 2  # 1 consumed out of 3


def test_time_expiration():
    # Generate a password
    client.post("/api/generate", json={"filename": "ExpiredDoc", "force": False})

    # Manually expire it in database
    past_time = int(time.time()) - 100
    with get_connection() as conn:
        conn.execute(
            "UPDATE passwords SET expires_at = ? WHERE filename_key = 'expireddoc'",
            (past_time,),
        )
        conn.commit()

    # Fetch should fail with expiration message
    resp = client.post("/api/fetch", json={"filename": "ExpiredDoc"})
    data = resp.json()
    assert data["ok"] is False
    assert "过期" in data["message"]


def test_manual_clear_endpoint():
    client.post("/api/generate", json={"filename": "ToDelete", "force": False})
    
    # Clear it
    resp_clear = client.post("/api/clear", json={"filename": "ToDelete.rar"})
    assert resp_clear.json()["ok"] is True

    # Should not exist now
    resp_fetch = client.post("/api/fetch", json={"filename": "ToDelete"})
    assert resp_fetch.json()["ok"] is False
