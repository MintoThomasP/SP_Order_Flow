from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.dispatch.views import ShipmentViewSet, ConfirmDispatchView, CarrierChoicesView

router = DefaultRouter()
router.register(r"shipments", ShipmentViewSet, basename="shipment")

urlpatterns = [
    path("confirm-shipment/", ConfirmDispatchView.as_view(), name="confirm-shipment"),
    path("carriers/", CarrierChoicesView.as_view(), name="carrier-choices"),
    path("", include(router.urls)),
]
