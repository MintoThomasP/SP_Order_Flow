"""
Shopfloor Workstations & Scanner URL Routing.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.shopfloor.views import (
    ShopfloorUpdateStatusView,
    ShopfloorStationViewSet,
    ScanEventLogViewSet,
)

router = DefaultRouter()
router.register(r"stations", ShopfloorStationViewSet, basename="shopfloor-stations")
router.register(r"recent-scans", ScanEventLogViewSet, basename="recent-scans")

urlpatterns = [
    # Barcode / QR Instant Status Update Endpoint
    path("update-status/", ShopfloorUpdateStatusView.as_view(), name="shopfloor-update-status"),

    # REST ViewSets
    path("", include(router.urls)),
]
