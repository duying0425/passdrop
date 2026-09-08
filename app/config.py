import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    SITE_TITLE: str = "PassDrop - 压缩包临时密码发放"
    BASE_URL: str = "https://passdrop.tmhcorps.cn"
    DEFAULT_EXPIRE_HOURS: int = 2
    DEFAULT_MAX_VIEWS: int = 1
    PASSWORD_LENGTH: int = 16
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "./data/passdrop.db")
    HOST: str = "0.0.0.0"
    PORT: int = 8000


settings = Settings()
