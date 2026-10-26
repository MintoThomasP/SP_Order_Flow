"""
Core URL routing for Lookups API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.core.views.lookups import SystemRoleViewSet, EntityStatusViewSet

router = DefaultRouter()
router.register(r"roles", SystemRoleViewSet, basename="system-roles")
router.register(r"statuses", EntityStatusViewSet, basename="entity-statuses")

urlpatterns = [
    path("", include(router.urls)),
]
