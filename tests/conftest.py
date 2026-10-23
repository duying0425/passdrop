import os

# Pin settings before the app is imported, so a developer's local .env cannot change test results
# (environment variables take precedence over values read from .env)
os.environ["DATABASE_PATH"] = "./data/test_passdrop.db"
os.environ["SITE_TITLE"] = ""
os.environ["DEFAULT_LANG"] = "zh"
