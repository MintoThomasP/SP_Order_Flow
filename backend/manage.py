#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the backend directory or project root
for env_candidate in [
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path(__file__).resolve().parent / ".env.production",
    Path(__file__).resolve().parent.parent / ".env.production",
]:
    if env_candidate.exists():
        load_dotenv(env_candidate, override=True)


def main():
    """Run administrative tasks."""
    settings_module = os.getenv("DJANGO_SETTINGS_MODULE", "config.settings.local")
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", settings_module)
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
