import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Optional
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from app.config import settings
from app.database import (
    init_db,
    get_record,
    save_password,
    increment_view,
    delete_record,
)
from app.scheduler import periodic_cleanup_task
from app.utils import normalize_filename, generate_random_password


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database schema
    init_db()
    # Start periodic background cleanup task
    cleanup_bg_task = asyncio.create_task(periodic_cleanup_task(interval_seconds=600))
    yield
    # Shutdown: Cancel background cleanup
    cleanup_bg_task.cancel()
    try:
        await cleanup_bg_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.SITE_TITLE,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Template and Static paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)


# --- Request & Response Models ---
class FetchRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=200)


class GenerateRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=200)
    force: bool = False
    custom_password: Optional[str] = Field(None, max_length=64)
    expire_hours: Optional[float] = Field(None, gt=0, le=720)
    max_views: Optional[int] = Field(None, ge=1, le=1000)


class ClearRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=200)


# --- Routes ---
@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request, f: Optional[str] = None, file: Optional[str] = None):
    initial_file = f or file or ""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "site_title": settings.SITE_TITLE,
            "base_url": settings.BASE_URL,
            "initial_file": initial_file,
            "default_expire_hours": settings.DEFAULT_EXPIRE_HOURS,
            "default_max_views": settings.DEFAULT_MAX_VIEWS,
        },
    )


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/api/config")
async def get_public_config():
    return {
        "site_title": settings.SITE_TITLE,
        "base_url": settings.BASE_URL,
        "default_expire_hours": settings.DEFAULT_EXPIRE_HOURS,
        "default_max_views": settings.DEFAULT_MAX_VIEWS,
        "password_length": settings.PASSWORD_LENGTH,
    }


@app.post("/api/fetch")
async def fetch_password(req: FetchRequest):
    """
    Fetches the password for a given filename. Consumes 1 view count.
    """
    key, display = normalize_filename(req.filename)
    if not key:
        return {"ok": False, "message": "请输入有效的文件名", "status": "invalid"}

    valid, record, msg = increment_view(key)
    if not valid or not record:
        return {"ok": False, "message": msg, "status": "expired_or_not_found"}

    now = int(time.time())
    views_left = max(0, record["max_views"] - record["view_count"])
    seconds_left = max(0, record["expires_at"] - now)

    return {
        "ok": True,
        "filename": record["filename_display"],
        "password": record["password"],
        "views_left": views_left,
        "view_count": record["view_count"],
        "max_views": record["max_views"],
        "seconds_left": seconds_left,
        "expires_at": record["expires_at"],
    }


@app.post("/api/generate")
async def generate_password_endpoint(req: GenerateRequest):
    """
    Generates a password for a filename.
    If the file exists and is active, and force=False, prompts confirmation.
    If force=True, clears the old record and creates a fresh one.
    """
    key, display = normalize_filename(req.filename)
    if not key:
        return {"ok": False, "message": "请输入有效的文件名"}

    now = int(time.time())
    existing = get_record(key)

    # If already exists and is active, and not forced, ask for confirmation
    if existing and not req.force:
        is_active = (
            existing["is_active"]
            and (now <= existing["expires_at"])
            and (existing["view_count"] < existing["max_views"])
        )
        if is_active:
            views_left = max(0, existing["max_views"] - existing["view_count"])
            seconds_left = max(0, existing["expires_at"] - now)
            return {
                "ok": False,
                "code": "EXISTS",
                "message": "该文件名已存在有效密码！",
                "existing": {
                    "filename": existing["filename_display"],
                    "created_at": existing["created_at"],
                    "expires_at": existing["expires_at"],
                    "views_left": views_left,
                    "max_views": existing["max_views"],
                    "seconds_left": seconds_left,
                },
            }

    # Prepare expiry and views
    expire_hours = req.expire_hours if req.expire_hours is not None else settings.DEFAULT_EXPIRE_HOURS
    max_views = req.max_views if req.max_views is not None else settings.DEFAULT_MAX_VIEWS
    expires_at = now + int(expire_hours * 3600)

    # Prepare password
    if req.custom_password and req.custom_password.strip():
        password = req.custom_password.strip()
    else:
        password = generate_random_password(length=settings.PASSWORD_LENGTH)

    # Save to database (will overwrite/clear old record)
    saved = save_password(
        filename_key=key,
        filename_display=display,
        password=password,
        expires_at=expires_at,
        max_views=max_views,
    )

    share_url = f"{settings.BASE_URL.rstrip('/')}/?f={quote(display)}"

    return {
        "ok": True,
        "filename": saved["filename_display"],
        "password": saved["password"],
        "expires_at": saved["expires_at"],
        "expire_hours": expire_hours,
        "max_views": saved["max_views"],
        "share_url": share_url,
        "is_overwrite": bool(existing),
    }


@app.post("/api/clear")
async def clear_endpoint(req: ClearRequest):
    """
    Explicitly removes a filename password record.
    """
    key, display = normalize_filename(req.filename)
    if not key:
        return {"ok": False, "message": "请输入有效的文件名"}

    deleted = delete_record(key)
    if deleted:
        return {"ok": True, "message": f"文件名【{display}】的密码记录已彻底清除"}
    else:
        return {"ok": False, "message": "未找到该文件名的记录，无需清除"}
