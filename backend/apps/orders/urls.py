"""
Orders and Peecho Gateway URL Routing.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.orders.views import (
    OrderViewSet,
    PeechoWebhookView,
    PeechoSimulateWebhookView,
    PeechoPayloadLogViewSet,
    PeechoConfigView,
    PeechoTestConnectionView,
)

router = DefaultRouter()
router.register(r"orders", OrderViewSet, basename="orders")
router.register(r"peecho/logs", PeechoPayloadLogViewSet, basename="peecho-logs")

urlpatterns = [
    # Peecho Centralized Integration & Webhook Ingestion
    path("peecho/webhook/", PeechoWebhookView.as_view(), name="peecho-webhook"),
    path("peecho/simulate-webhook/", PeechoSimulateWebhookView.as_view(), name="peecho-simulate-webhook"),
    path("peecho/config/", PeechoConfigView.as_view(), name="peecho-config"),
    path("peecho/test-connection/", PeechoTestConnectionView.as_view(), name="peecho-test-connection"),

    # REST ViewSets
    path("", include(router.urls)),
]

