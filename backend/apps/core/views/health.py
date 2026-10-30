"""
Health check and diagnostic API endpoint.
Provides system diagnostics, database connection state, and migration status.
"""
import traceback
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status


class HealthCheckView(APIView):
    """
    GET /api/v1/core/health/
    Public health check endpoint providing diagnostic details on DB connectivity.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        db_status = "UNKNOWN"
        db_error = None
        db_traceback = None
        db_name = connection.settings_dict.get("NAME")
        db_engine = connection.settings_dict.get("ENGINE")
        db_host = connection.settings_dict.get("HOST")
        pending_migrations = []
        counts = {}

        try:
            connection.ensure_connection()
            db_status = "CONNECTED"

            # Check migrations
            try:
                executor = MigrationExecutor(connection)
                targets = executor.loader.graph.leaf_nodes()
                plan = executor.migration_plan(targets)
                pending_migrations = [f"{m[0].app}:{m[0].name}" for m in plan]
            except Exception as mig_err:
                pending_migrations = [f"Migration check error: {str(mig_err)}"]

            # Check tables
            try:
                from apps.core.models.lookups import EntityStatus
                counts["statuses"] = EntityStatus.objects.count()
            except Exception as e:
                counts["statuses_error"] = str(e)

            try:
                from apps.orders.models import Order
                counts["orders"] = Order.objects.count()
            except Exception as e:
                counts["orders_error"] = str(e)

        except Exception as exc:
            db_status = "FAILED"
            db_error = str(exc)
            db_traceback = traceback.format_exc()

        payload = {
            "status": "HEALTHY" if db_status == "CONNECTED" and not pending_migrations else "DEGRADED",
            "database": {
                "status": db_status,
                "engine": db_engine,
                "name": db_name,
                "host": db_host,
                "error": db_error,
                "traceback": db_traceback,
            },
            "pending_migrations": pending_migrations,
            "counts": counts,
        }

        http_code = status.HTTP_200_OK if db_status == "CONNECTED" else status.HTTP_500_INTERNAL_SERVER_ERROR
        return Response(payload, status=http_code)
