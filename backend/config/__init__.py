"""Config package for Silver Point POD Operations Portal & Peecho API Gateway."""
from .celery import app as celery_app

try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

__all__ = ("celery_app",)
