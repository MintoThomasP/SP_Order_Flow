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
from apps.orders.views_provider import (
    ProviderOrderPushView,
    ProviderOrderStatusPushView,
    ProviderIngestionLogViewSet,
    ServiceProviderViewSet,
)

router = DefaultRouter()
router.register(r"orders", OrderViewSet, basename="orders")
router.register(r"peecho/logs", PeechoPayloadLogViewSet, basename="peecho-logs")
router.register(r"printify/logs", PrintifyPayloadLogViewSet, basename="printify-logs")
router.register(r"providers/logs", ProviderIngestionLogViewSet, basename="provider-logs")
router.register(r"providers/channels", ServiceProviderViewSet, basename="provider-channels")

urlpatterns = [
    # Common Service Provider Push API (Inbound Order & Status/Tracking Push)
    path("providers/orders/", ProviderOrderPushView.as_view(), name="provider-order-push"),
    path("providers/orders/status/", ProviderOrderStatusPushView.as_view(), name="provider-order-status-push"),
    path(
        "providers/orders/<str:external_order_id>/status/",
        ProviderOrderStatusPushView.as_view(),
        name="provider-order-status-push-by-id",
    ),
    # Printify Inbound Webhook Listener
    path("webhooks/printify/", PrintifyWebhookView.as_view(), name="printify-webhook"),

    # Printify Management & Automation Endpoints
    path("printify/config/", PrintifyConfigView.as_view(), name="printify-config"),
    path("printify/test-connection/", PrintifyTestConnectionView.as_view(), name="printify-test-connection"),
    path("printify/register-webhooks/", PrintifyRegisterWebhooksView.as_view(), name="printify-register-webhooks"),
    path("printify/simulate-webhook/", PrintifySimulateWebhookView.as_view(), name="printify-simulate-webhook"),

    # Peecho Centralized Integration & Webhook Ingestion (Production & Staging Subdomain Routing)
    path("peecho/webhook/", PeechoWebhookView.as_view(), name="peecho-webhook"),
    path("peecho/webhook/staging/", PeechoWebhookView.as_view(force_sandbox=True), name="peecho-webhook-staging"),
    path("peecho/simulate-webhook/", PeechoSimulateWebhookView.as_view(), name="peecho-simulate-webhook"),
    path("peecho/config/", PeechoConfigView.as_view(), name="peecho-config"),
    path("peecho/test-connection/", PeechoTestConnectionView.as_view(), name="peecho-test-connection"),

    # Orders Simulation (Multi-Channel)
    path("orders/simulate/", OrderSimulateView.as_view(), name="order-simulate"),

    # REST ViewSets
    path("", include(router.urls)),
]

