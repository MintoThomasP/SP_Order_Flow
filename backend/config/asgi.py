"""
ASGI config for Silver Point POD backend.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory or project root
for env_candidate in [
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent / ".env.production",
]:
    if env_candidate.exists():
        load_dotenv(env_candidate, override=True)

settings_module = os.getenv("DJANGO_SETTINGS_MODULE", "config.settings.production")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", settings_module)

from django.core.asgi import get_asgi_application

application = get_asgi_application()
