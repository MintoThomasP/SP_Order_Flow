"""
Core URL routing for Lookups API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.core.views.lookups import SystemRoleViewSet, EntityStatusViewSet
from apps.core.views.health import HealthCheckView

router = DefaultRouter()
router.register(r"roles", SystemRoleViewSet, basename="system-roles")
router.register(r"statuses", EntityStatusViewSet, basename="entity-statuses")

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="system-health"),
    path("", include(router.urls)),
]
