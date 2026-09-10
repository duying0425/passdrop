import os
import sqlite3
import time
from typing import Optional, Dict, Any, Tuple
from app.config import settings


def get_db_path() -> str:
    path = settings.DATABASE_PATH
    dir_name = os.path.dirname(path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    return path


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn


def init_db():
    """Initializes the database schema."""
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS passwords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename_key TEXT UNIQUE NOT NULL,
                filename_display TEXT NOT NULL,
                password TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                max_views INTEGER NOT NULL,
                view_count INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1
            );
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_filename_key ON passwords(filename_key);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_expires_at ON passwords(expires_at);"
        )
        conn.commit()


def get_record(filename_key: str) -> Optional[Dict[str, Any]]:
    """Retrieves record by normalized key."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM passwords WHERE filename_key = ?",
            (filename_key,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)


def save_password(
    filename_key: str,
    filename_display: str,
    password: str,
    expires_at: int,
    max_views: int,
) -> Dict[str, Any]:
    """
    Saves a password record.
    If an existing record with the same filename_key exists, it deletes/replaces it completely.
    """
    now = int(time.time())
    with get_connection() as conn:
        # Delete existing record to ensure complete reset
        conn.execute("DELETE FROM passwords WHERE filename_key = ?", (filename_key,))
        conn.execute(
            """
            INSERT INTO passwords (
                filename_key,
                filename_display,
                password,
                created_at,
                expires_at,
                max_views,
                view_count,
                is_active
            ) VALUES (?, ?, ?, ?, ?, ?, 0, 1);
            """,
            (
                filename_key,
                filename_display,
                password,
                now,
                expires_at,
                max_views,
            ),
        )
        conn.commit()

    return get_record(filename_key)  # type: ignore


def increment_view(filename_key: str) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """
    Attempts to fetch the password and increments view count atomically.
    Returns: (is_valid, record_or_none, error_message)
    """
    now = int(time.time())
    with get_connection() as conn:
        # Atomic conditional increment: succeeds only if the record exists,
        # is active, is not expired, and still has views left. This prevents
        # concurrent requests from both passing the check (race condition).
        cursor = conn.execute(
            """
            UPDATE passwords
            SET view_count = view_count + 1,
                is_active = CASE
                    WHEN view_count + 1 >= max_views OR ? > expires_at THEN 0
                    ELSE 1
                END
            WHERE filename_key = ?
              AND is_active = 1
              AND view_count < max_views
              AND ? <= expires_at
            """,
            (now, filename_key, now),
        )
        if cursor.rowcount > 0:
            conn.commit()
            row = conn.execute(
                "SELECT * FROM passwords WHERE filename_key = ?",
                (filename_key,),
            ).fetchone()
            return True, dict(row), ""

        # Update failed: determine the reason
        row = conn.execute(
            "SELECT * FROM passwords WHERE filename_key = ?",
            (filename_key,),
        ).fetchone()
        if not row:
            return False, None, "未找到该文件名的密码记录"

        record = dict(row)
        if not record["is_active"]:
            # Marked inactive by a previous fetch that exhausted views or expired
            if record["view_count"] >= record["max_views"]:
                return False, None, "该密码提取次数已达上限，无法再次获取"
            return False, None, "该密码已失效或已被销毁"

        if now > record["expires_at"]:
            conn.execute(
                "UPDATE passwords SET is_active = 0 WHERE filename_key = ?",
                (filename_key,),
            )
            conn.commit()
            return False, None, "该密码已超过有效期（已过期）"

        if record["view_count"] >= record["max_views"]:
            conn.execute(
                "UPDATE passwords SET is_active = 0 WHERE filename_key = ?",
                (filename_key,),
            )
            conn.commit()
            return False, None, "该密码提取次数已达上限，无法再次获取"

        return False, None, "该密码已失效或已被销毁"


def delete_record(filename_key: str) -> bool:
    """Explicitly deletes a record from the database."""
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM passwords WHERE filename_key = ?", (filename_key,)
        )
        conn.commit()
        return cursor.rowcount > 0


def cleanup_expired() -> int:
    """
    Deletes records that are expired by time or exhausted by view count.
    """
    now = int(time.time())
    with get_connection() as conn:
        cursor = conn.execute(
            """
            DELETE FROM passwords
            WHERE expires_at < ? OR view_count >= max_views OR is_active = 0
            """,
            (now,),
        )
        conn.commit()
        return cursor.rowcount

