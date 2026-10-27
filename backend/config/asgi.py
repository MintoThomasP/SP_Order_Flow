"""
ASGI config for Silver Point POD backend.
"""
from pathlib import Path
from dotenv import load_dotenv
from django.core.asgi import get_asgi_application

env_file = Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

settings_module = os.getenv("DJANGO_SETTINGS_MODULE", "config.settings.production")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", settings_module)

application = get_asgi_application()
