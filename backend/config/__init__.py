"""Config package for Silver Point POD Operations Portal & Peecho API Gateway."""
from .celery import app as celery_app

__all__ = ("celery_app",)
