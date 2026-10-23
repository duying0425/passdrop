import json
import os
import re

import pytest
from fastapi.testclient import TestClient


from app.main import app
from app.database import init_db, get_connection
from app.i18n import (
    FALLBACK_LANG,
    LANG_COOKIE,
    MESSAGES,
    SUPPORTED_LANGS,
    normalize_lang,
    parse_accept_language,
    translate,
)

APP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app")
PLACEHOLDER = re.compile(r"\{(\w+)\}")
HTML_TAG = re.compile(r"</?([a-z]+)[^>]*>")


@pytest.fixture(autouse=True)
def clean_db():
    init_db()
    with get_connection() as conn:
        conn.execute("DELETE FROM passwords;")
        conn.commit()
    yield
    with get_connection() as conn:
        conn.execute("DELETE FROM passwords;")
        conn.commit()


@pytest.fixture
def client():
    # Fresh client per test so a language cookie never leaks between tests
    return TestClient(app)


def read_app_file(*parts):
    with open(os.path.join(APP_DIR, *parts), encoding="utf-8") as f:
        return f.read()


# --- Locale files ---
def test_all_locales_have_identical_keys():
    reference = set(MESSAGES[FALLBACK_LANG])
    for lang in SUPPORTED_LANGS:
        keys = set(MESSAGES[lang])
        assert keys == reference, (
            f"{lang}: missing {sorted(reference - keys)}, extra {sorted(keys - reference)}"
        )


def test_all_locales_have_matching_placeholders_and_markup():
    for key, source in MESSAGES[FALLBACK_LANG].items():
        for lang in SUPPORTED_LANGS:
            text = MESSAGES[lang][key]
            assert text.strip(), f"{lang}:{key} is empty"
            assert sorted(PLACEHOLDER.findall(text)) == sorted(PLACEHOLDER.findall(source)), (
                f"{lang}:{key} placeholders differ from {FALLBACK_LANG}"
            )
            assert sorted(HTML_TAG.findall(text)) == sorted(HTML_TAG.findall(source)), (
                f"{lang}:{key} HTML tags differ from {FALLBACK_LANG}"
            )


def test_every_key_used_in_template_and_js_exists():
    template = read_app_file("templates", "index.html")
    script = read_app_file("static", "app.js")

    used = set(re.findall(r"\bt\('([\w.]+)'", template))
    used |= set(re.findall(r'data-i18n(?:-placeholder|-title|-aria-label)?="([\w.]+)"', template))
    used |= set(re.findall(r'\bt\("([\w.]+)"', script))
    used |= set(re.findall(r'setI18n\([^,]+,\s*"([\w.]+)"', script))

    assert used, "key extraction found nothing"
    missing = sorted(k for k in used if k not in MESSAGES[FALLBACK_LANG])
    assert not missing, f"keys used but not defined: {missing}"


def test_error_codes_have_messages():
    for code in ("INVALID_FILENAME", "NOT_FOUND", "EXHAUSTED", "EXPIRED", "REVOKED", "EXISTS", "CLEAR_NOT_FOUND"):
        assert f"error.{code}" in MESSAGES[FALLBACK_LANG]


# --- Negotiation helpers ---
@pytest.mark.parametrize(
    "tag, expected",
    [
        ("zh", "zh"),
        ("zh-CN", "zh"),
        ("zh_TW", "zh"),
        ("zh-Hant-TW", "zh"),
        ("EN-us", "en"),
        ("ja-JP", "ja"),
        ("fr", None),
        ("", None),
        (None, None),
        ("*", None),
    ],
)
def test_normalize_lang(tag, expected):
    assert normalize_lang(tag) == expected


@pytest.mark.parametrize(
    "header, expected",
    [
        ("ja,en-US;q=0.9,en;q=0.8", "ja"),
        ("fr-FR,fr;q=0.9,en;q=0.8", "en"),
        ("en;q=0.5, ja;q=0.9", "ja"),
        ("de, ja;q=0", None),
        ("zh-TW,zh;q=0.9", "zh"),
        ("en;q=abc, ja;q=0.1", "ja"),
        ("", None),
        (None, None),
    ],
)
def test_parse_accept_language(header, expected):
    assert parse_accept_language(header) == expected


def test_translate_fills_placeholders_and_falls_back():
    assert translate("en", "common.file", name="a{b}") == "File: a{b}"
    assert translate("ja", "no.such.key") == "no.such.key"
    assert translate("xx", "tab.fetch") == MESSAGES[FALLBACK_LANG]["tab.fetch"]


# --- Page rendering ---
def html_lang_of(resp):
    match = re.search(r'<html lang="([^"]+)"', resp.text)
    return match.group(1) if match else None


def test_index_defaults_to_chinese(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert html_lang_of(resp) == "zh-CN"
    assert MESSAGES["zh"]["fetch.title"] in resp.text
    assert LANG_COOKIE not in resp.cookies
    assert "Accept-Language" in resp.headers["vary"]


@pytest.mark.parametrize("lang, html_lang", [("en", "en"), ("ja", "ja"), ("zh", "zh-CN")])
def test_index_query_param_selects_language_and_sets_cookie(client, lang, html_lang):
    resp = client.get(f"/?lang={lang}")
    assert html_lang_of(resp) == html_lang
    assert f"<title>{MESSAGES[lang]['meta.title']}</title>" in resp.text
    assert MESSAGES[lang]["fetch.title"] in resp.text
    assert resp.cookies.get(LANG_COOKIE) == lang


def test_index_uses_accept_language(client):
    resp = client.get("/", headers={"Accept-Language": "ja-JP,ja;q=0.9,en;q=0.8"})
    assert html_lang_of(resp) == "ja"
    assert LANG_COOKIE not in resp.cookies


def test_index_cookie_beats_accept_language_and_query_beats_cookie(client):
    client.cookies.set(LANG_COOKIE, "en")
    resp = client.get("/", headers={"Accept-Language": "ja"})
    assert html_lang_of(resp) == "en"
    resp = client.get("/?lang=ja", headers={"Accept-Language": "zh"})
    assert html_lang_of(resp) == "ja"


def test_index_ignores_unsupported_lang(client):
    resp = client.get("/?lang=xx", headers={"Accept-Language": "en"})
    assert html_lang_of(resp) == "en"
    assert LANG_COOKIE not in resp.cookies


def test_index_embeds_all_dictionaries(client):
    resp = client.get("/?lang=en")
    match = re.search(r'<script id="i18n-data" type="application/json">(.*?)</script>', resp.text, re.S)
    assert match
    data = json.loads(match.group(1))
    assert data["lang"] == "en"
    assert set(data["messages"]) == set(SUPPORTED_LANGS)
    assert data["messages"]["ja"]["tab.fetch"] == MESSAGES["ja"]["tab.fetch"]


def test_index_keeps_prefilled_filename_escaped(client):
    resp = client.get('/?f="><script>x</script>&lang=en')
    assert "<script>x</script>" not in resp.text
    assert 'value="&#34;&gt;&lt;script&gt;x&lt;/script&gt;"' in resp.text


def test_site_title_override(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "SITE_TITLE", "My Drop")
    resp = client.get("/?lang=ja")
    assert "<title>My Drop</title>" in resp.text
    assert client.get("/api/config").json()["site_title"] == "My Drop"


def test_legacy_default_title_is_treated_as_unset():
    from app.config import LEGACY_DEFAULT_TITLE, Settings

    assert Settings(SITE_TITLE=LEGACY_DEFAULT_TITLE).SITE_TITLE == ""
    assert Settings(SITE_TITLE=f"  {LEGACY_DEFAULT_TITLE} ").SITE_TITLE == ""
    assert Settings(SITE_TITLE="  My Drop ").SITE_TITLE == "My Drop"


# --- API localization ---
def test_api_defaults_to_chinese_for_script_clients(client):
    data = client.post("/api/fetch", json={"filename": "missing"}).json()
    assert data["ok"] is False
    assert data["code"] == "NOT_FOUND"
    assert data["message"] == MESSAGES["zh"]["error.NOT_FOUND"]


@pytest.mark.parametrize("lang", ["en", "ja"])
def test_api_messages_follow_query_lang(client, lang):
    data = client.post(f"/api/fetch?lang={lang}", json={"filename": "missing"}).json()
    assert data["code"] == "NOT_FOUND"
    assert data["message"] == MESSAGES[lang]["error.NOT_FOUND"]


def test_api_messages_follow_accept_language_and_cookie(client):
    data = client.post("/api/fetch", json={"filename": "missing"}, headers={"Accept-Language": "ja"}).json()
    assert data["message"] == MESSAGES["ja"]["error.NOT_FOUND"]

    client.cookies.set(LANG_COOKIE, "en")
    data = client.post("/api/fetch", json={"filename": "missing"}, headers={"Accept-Language": "ja"}).json()
    assert data["message"] == MESSAGES["en"]["error.NOT_FOUND"]


def test_api_error_codes_for_exhausted_and_expired(client):
    client.post("/api/generate", json={"filename": "BurnMe"})
    assert client.post("/api/fetch", json={"filename": "BurnMe"}).json()["ok"] is True
    data = client.post("/api/fetch?lang=en", json={"filename": "BurnMe"}).json()
    assert data["code"] == "EXHAUSTED"
    assert data["message"] == MESSAGES["en"]["error.EXHAUSTED"]

    client.post("/api/generate", json={"filename": "OldDoc"})
    with get_connection() as conn:
        conn.execute("UPDATE passwords SET expires_at = 1 WHERE filename_key = 'olddoc'")
        conn.commit()
    data = client.post("/api/fetch?lang=ja", json={"filename": "OldDoc"}).json()
    assert data["code"] == "EXPIRED"
    assert data["message"] == MESSAGES["ja"]["error.EXPIRED"]


def test_api_generate_exists_and_clear_are_localized(client):
    client.post("/api/generate", json={"filename": "Dup"})
    data = client.post("/api/generate?lang=en", json={"filename": "Dup"}).json()
    assert data["code"] == "EXISTS"
    assert data["message"] == MESSAGES["en"]["error.EXISTS"]

    data = client.post("/api/clear?lang=ja", json={"filename": "Dup.zip"}).json()
    assert data["ok"] is True
    assert data["message"] == translate("ja", "api.cleared", name="Dup")

    data = client.post("/api/clear?lang=en", json={"filename": "Dup"}).json()
    assert data["ok"] is False
    assert data["code"] == "NOT_FOUND"
    assert data["message"] == MESSAGES["en"]["error.CLEAR_NOT_FOUND"]


def test_api_invalid_filename_code(client):
    data = client.post("/api/fetch?lang=en", json={"filename": "   "}).json()
    assert data["code"] == "INVALID_FILENAME"
    assert data["message"] == MESSAGES["en"]["error.INVALID_FILENAME"]


def test_config_exposes_languages(client):
    data = client.get("/api/config?lang=en").json()
    assert data["supported_langs"] == list(SUPPORTED_LANGS)
    assert data["default_lang"] == "zh"
    assert data["site_title"] == MESSAGES["en"]["meta.title"]
