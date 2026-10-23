import json
import os
import re
from typing import Dict, Optional

from fastapi import Request

from app.config import settings

LOCALES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "locales")

# Supported languages: code -> native display name and value for <html lang>.
# To add a language, create app/locales/<code>.json and register it here.
LANGUAGES: Dict[str, Dict[str, str]] = {
    "zh": {"name": "简体中文", "html_lang": "zh-CN"},
    "en": {"name": "English", "html_lang": "en"},
    "ja": {"name": "日本語", "html_lang": "ja"},
}
SUPPORTED_LANGS = tuple(LANGUAGES)

# Source-of-truth locale: used for missing keys and when nothing else matches
FALLBACK_LANG = "zh"

LANG_COOKIE = "passdrop_lang"
LANG_COOKIE_MAX_AGE = 365 * 24 * 3600

_PLACEHOLDER = re.compile(r"\{(\w+)\}")


def _load_messages() -> Dict[str, Dict[str, str]]:
    messages = {}
    for code in SUPPORTED_LANGS:
        with open(os.path.join(LOCALES_DIR, f"{code}.json"), encoding="utf-8") as f:
            messages[code] = json.load(f)
    return messages


MESSAGES = _load_messages()


def normalize_lang(value: Optional[str]) -> Optional[str]:
    """
    Maps a language tag to a supported code, e.g. 'en-US' -> 'en', 'ja_JP' -> 'ja',
    'zh-Hant-TW' -> 'zh'. Returns None if the tag is empty or unsupported.
    """
    if not value:
        return None
    tag = value.strip().lower().replace("_", "-")
    if tag in LANGUAGES:
        return tag
    primary = tag.split("-", 1)[0]
    return primary if primary in LANGUAGES else None


def parse_accept_language(header: Optional[str]) -> Optional[str]:
    """
    Picks the best supported language from an Accept-Language header,
    honouring q-values (ties keep the header order).
    """
    if not header:
        return None

    candidates = []
    for index, part in enumerate(header.split(",")):
        tag, *params = part.strip().split(";")
        quality = 1.0
        for param in params:
            name, _, value = param.strip().partition("=")
            if name.strip().lower() == "q":
                try:
                    quality = float(value)
                except ValueError:
                    quality = 0.0
        if quality > 0:
            candidates.append((-quality, index, tag.strip()))

    for _, _, tag in sorted(candidates):
        lang = normalize_lang(tag)
        if lang:
            return lang
    return None


def default_lang() -> str:
    return normalize_lang(settings.DEFAULT_LANG) or FALLBACK_LANG


def resolve_lang(request: Request) -> str:
    """
    Resolves the request language.
    Priority: ?lang= query > language cookie > Accept-Language header > DEFAULT_LANG.
    """
    return (
        normalize_lang(request.query_params.get("lang"))
        or normalize_lang(request.cookies.get(LANG_COOKIE))
        or parse_accept_language(request.headers.get("accept-language"))
        or default_lang()
    )


def translate(lang: str, key: str, **params) -> str:
    """
    Looks up a message and fills {placeholders}. Falls back to the source
    locale, then to the key itself, so a missing translation never crashes.
    """
    text = MESSAGES.get(lang, {}).get(key) or MESSAGES[FALLBACK_LANG].get(key) or key
    if not params:
        return text
    return _PLACEHOLDER.sub(
        lambda m: str(params[m.group(1)]) if m.group(1) in params else m.group(0),
        text,
    )
