import re
import secrets
import string
from typing import Tuple

# Common archive extensions to automatically strip
ARCHIVE_EXTENSIONS = (
    ".tar.gz",
    ".tar.bz2",
    ".tar.xz",
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz",
    ".bz2",
    ".xz",
    ".z",
)


def normalize_filename(raw: str) -> Tuple[str, str]:
    """
    Normalizes a filename input:
    1. Trims whitespace.
    2. Strips common archive extensions (.zip, .rar, .7z, etc.).
    3. Returns (normalized_key, display_name) where normalized_key is lowercased.
    """
    if not raw:
        return "", ""

    cleaned = raw.strip()
    # Check extensions case-insensitively
    lower_cleaned = cleaned.lower()
    for ext in ARCHIVE_EXTENSIONS:
        if lower_cleaned.endswith(ext):
            cleaned = cleaned[: -len(ext)].strip()
            break

    # If the user typed only an extension (e.g. ".zip"), fallback to raw stripped
    if not cleaned:
        cleaned = raw.strip()

    normalized_key = cleaned.lower()
    return normalized_key, cleaned


def generate_random_password(length: int = 10) -> str:
    """
    Generates a cryptographically strong, clean alphanumeric password.
    Ensures a balanced mix of uppercase, lowercase, and digits.
    """
    length = max(6, min(64, length))
    
    # Character pools
    upper = string.ascii_uppercase
    lower = string.ascii_lowercase
    digits = string.digits
    all_chars = upper + lower + digits

    # Ensure at least 1 uppercase, 1 lowercase, and 1 digit
    password_chars = [
        secrets.choice(upper),
        secrets.choice(lower),
        secrets.choice(digits),
    ]

    # Fill the rest randomly
    for _ in range(length - 3):
        password_chars.append(secrets.choice(all_chars))

    # Shuffle securely
    # Fisher-Yates shuffle with secrets
    for i in range(len(password_chars) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        password_chars[i], password_chars[j] = password_chars[j], password_chars[i]

    return "".join(password_chars)
