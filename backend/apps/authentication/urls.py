"""
Authentication and Staff Management URL routing.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from apps.authentication.views import (
    CustomTokenObtainPairView,
    LogoutView,
    CurrentUserView,
    UserViewSet,
    UserAuditLogViewSet,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="staff-users")
router.register(r"audit-logs", UserAuditLogViewSet, basename="audit-logs")

urlpatterns = [
    # JWT SimpleJWT endpoints
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="auth_logout"),
    path("me/", CurrentUserView.as_view(), name="auth_me"),

    # REST Viewsets (Users & Audit Logs)
    path("", include(router.urls)),
]
