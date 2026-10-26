"""
Orders and Peecho Gateway URL Routing.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.orders.views import (
    OrderViewSet,
    OrderSimulateView,
    PeechoWebhookView,
    PeechoSimulateWebhookView,
    PeechoPayloadLogViewSet,
    PeechoConfigView,
    PeechoTestConnectionView,
)

from apps.orders.views_printify import (
    PrintifyWebhookView,
    PrintifyPayloadLogViewSet,
    PrintifyConfigView,
    PrintifyTestConnectionView,
    PrintifyRegisterWebhooksView,
    PrintifySimulateWebhookView,
)

router = DefaultRouter()
router.register(r"orders", OrderViewSet, basename="orders")
router.register(r"peecho/logs", PeechoPayloadLogViewSet, basename="peecho-logs")
router.register(r"printify/logs", PrintifyPayloadLogViewSet, basename="printify-logs")

urlpatterns = [
    # Printify Inbound Webhook Listener
    path("webhooks/printify/", PrintifyWebhookView.as_view(), name="printify-webhook"),

    # Printify Management & Automation Endpoints
    path("printify/config/", PrintifyConfigView.as_view(), name="printify-config"),
    path("printify/test-connection/", PrintifyTestConnectionView.as_view(), name="printify-test-connection"),
    path("printify/register-webhooks/", PrintifyRegisterWebhooksView.as_view(), name="printify-register-webhooks"),
    path("printify/simulate-webhook/", PrintifySimulateWebhookView.as_view(), name="printify-simulate-webhook"),

    # Peecho Centralized Integration & Webhook Ingestion
    path("peecho/webhook/", PeechoWebhookView.as_view(), name="peecho-webhook"),
    path("peecho/simulate-webhook/", PeechoSimulateWebhookView.as_view(), name="peecho-simulate-webhook"),
    path("peecho/config/", PeechoConfigView.as_view(), name="peecho-config"),
    path("peecho/test-connection/", PeechoTestConnectionView.as_view(), name="peecho-test-connection"),

    # Orders Simulation (Multi-Channel)
    path("orders/simulate/", OrderSimulateView.as_view(), name="order-simulate"),

    # REST ViewSets
    path("", include(router.urls)),
]

