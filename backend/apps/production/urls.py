"""
Production Batching and Shopfloor URL Routing.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.production.views import ProductionBatchViewSet

router = DefaultRouter()
router.register(r"batches", ProductionBatchViewSet, basename="production-batches")

urlpatterns = [
    path("", include(router.urls)),
]
