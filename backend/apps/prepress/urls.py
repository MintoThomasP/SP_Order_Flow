"""
Prepress URL routing.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.prepress.views import ArtworkVerificationViewSet

router = DefaultRouter()
router.register(r"verifications", ArtworkVerificationViewSet, basename="artwork-verifications")

urlpatterns = [
    path("", include(router.urls)),
]
