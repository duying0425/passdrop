import os
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Former default title, still present in .env files copied from the old .env.example
LEGACY_DEFAULT_TITLE = "PassDrop - 压缩包临时密码发放"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Leave empty to use the localized title of each language; set to force one title for all
    SITE_TITLE: str = ""
    # Fallback UI/API language when neither ?lang=, cookie nor Accept-Language match (zh / en / ja)
    DEFAULT_LANG: str = "zh"
    BASE_URL: str = "https://passdrop.tmhcorps.cn"
    DEFAULT_EXPIRE_HOURS: int = 2
    DEFAULT_MAX_VIEWS: int = 1
    PASSWORD_LENGTH: int = 16
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "./data/passdrop.db")
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    @field_validator("SITE_TITLE")
    @classmethod
    def drop_legacy_default_title(cls, value: str) -> str:
        # Treat the old default as unset so upgraded installs get localized titles
        value = value.strip()
        return "" if value == LEGACY_DEFAULT_TITLE else value


settings = Settings()
