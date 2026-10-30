"""
Production Batching and Shopfloor URL Routing.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.production.views import (
    ProductionBatchViewSet,
    PrintMachineViewSet,
    BindingMethodViewSet,
)

router = DefaultRouter()
router.register(r"batches", ProductionBatchViewSet, basename="production-batches")
router.register(r"machines", PrintMachineViewSet, basename="production-machines")
router.register(r"binding-methods", BindingMethodViewSet, basename="production-binding-methods")

urlpatterns = [
    path("", include(router.urls)),
]
