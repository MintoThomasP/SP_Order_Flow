"""
Views for JWT Authentication, Staff User Management, Role Assignments, and Audit Trails.
"""
from rest_framework import viewsets, status, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.models import User, UserAuditLog
from apps.authentication.serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    UserCreateUpdateSerializer,
    RoleAssignmentSerializer,
    UserAuditLogSerializer,
)
from apps.authentication.services.audit import log_staff_action
from apps.core.models.lookups import SystemRole


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    POST /api/v1/auth/token/
    Staff Login endpoint returning enriched JWT tokens and user payload.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            email = request.data.get("email")
            user = User.objects.filter(email=email).first()
            if user:
                log_staff_action(
                    user=user,
                    action="USER_LOGIN",
                    resource_type="USER",
                    resource_id=str(user.id),
                    details={"ip": request.META.get("REMOTE_ADDR")},
                    request=request,
                )
        return response


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Logs staff logout and invalidates JWT token session.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        refresh_token = request.data.get("refresh")
        
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        log_staff_action(
            user=user,
            action="USER_LOGOUT",
            resource_type="USER",
            resource_id=str(user.id),
            request=request,
        )

        return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    GET /api/v1/auth/me/
    Returns currently logged-in user profile, role, and capabilities.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    """
    Staff User Management ViewSet.
    Provides CRUD, role assignments, and user-specific audit logging.
    """
    queryset = User.objects.select_related("role").all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["email", "first_name", "last_name", "employee_id", "department"]
    ordering_fields = ["created_at", "email", "department", "last_login"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        ordering_param = self.request.query_params.get("ordering")
        if ordering_param:
            fields = [f.strip() for f in ordering_param.split(",") if f.strip()]
            return qs.order_by(*fields)
        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return UserCreateUpdateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        log_staff_action(
            user=self.request.user if self.request.user.is_authenticated else None,
            action="USER_CREATE",
            resource_type="USER",
            resource_id=str(user.id),
            details={
                "created_user_email": user.email,
                "role": user.role.name if user.role else "No Role",
                "department": user.department,
            },
            request=self.request,
        )

    def perform_update(self, serializer):
        user = serializer.save()
        log_staff_action(
            user=self.request.user if self.request.user.is_authenticated else None,
            action="USER_UPDATE",
            resource_type="USER",
            resource_id=str(user.id),
            details={"updated_fields": list(serializer.validated_data.keys())},
            request=self.request,
        )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.is_superuser or (user.role and user.role.code == "SUPER_ADMIN"):
            return Response(
                {"error": "The Super Admin account is protected and cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="change-password")
    def change_password(self, request, pk=None):
        """
        POST /api/v1/auth/users/{id}/change-password/
        Changes password for a user (specifically supported for protected Super Admin).
        """
        user = self.get_object()
        password = request.data.get("password")
        if not password or len(str(password).strip()) < 6:
            return Response(
                {"error": "Password must be at least 6 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(str(password).strip())
        user.save()

        log_staff_action(
            user=request.user if request.user.is_authenticated else None,
            action="PASSWORD_CHANGE",
            resource_type="USER",
            resource_id=str(user.id),
            details={
                "target_user": user.email,
                "is_super_admin": user.is_superuser or (user.role and user.role.code == "SUPER_ADMIN"),
            },
            request=request,
        )

        return Response(
            {"detail": f"Password for {user.email} updated successfully."},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="assign-role")
    def assign_role(self, request, pk=None):
        """
        POST /api/v1/auth/users/{id}/assign-role/
        Assigns a new SystemRole to a staff user and records an audit log.
        """
        from django.db.models import Q
        user = self.get_object()
        if user.is_superuser or (user.role and user.role.code == "SUPER_ADMIN"):
            return Response(
                {"error": "The Super Admin account role is permanent and cannot be modified."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RoleAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        role_id = serializer.validated_data["role_id"]
        reason = serializer.validated_data.get("reason", "")

        try:
            new_role = SystemRole.objects.get(id=role_id)
        except SystemRole.DoesNotExist:
            return Response({"error": "Specified SystemRole does not exist."}, status=status.HTTP_404_NOT_FOUND)

        if new_role.code == "PEECHO_SERVICE":
            return Response(
                {"error": "The 'Peecho API Service Worker' role is an automated machine daemon and cannot be assigned to human staff members."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_role.code == "SUPER_ADMIN":
            existing_super = User.objects.filter(
                Q(is_superuser=True) | Q(role__code="SUPER_ADMIN")
            ).exclude(id=user.id)
            if existing_super.exists():
                return Response(
                    {"error": "Only one Super Admin is allowed in the system. The Super Admin role cannot be assigned to another user."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        old_role_name = user.role.name if user.role else "None"
        user.role = new_role
        user.save()

        # Record audit log
        log_staff_action(
            user=request.user if request.user.is_authenticated else None,
            action="ROLE_ASSIGNMENT",
            resource_type="USER",
            resource_id=str(user.id),
            details={
                "target_user": user.email,
                "previous_role": old_role_name,
                "new_role": new_role.name,
                "new_role_code": new_role.code,
                "reason": reason,
            },
            request=request,
        )

        return Response(
            {
                "detail": f"Assigned role '{new_role.name}' to user {user.email}.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request, pk=None):
        """
        POST /api/v1/auth/users/{id}/toggle-status/
        Toggles staff active/suspended status.
        """
        user = self.get_object()
        if user.is_superuser or (user.role and user.role.code == "SUPER_ADMIN"):
            return Response(
                {"error": "The Super Admin account is permanent and cannot be deactivated or suspended."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = not user.is_active
        user.save()

        log_staff_action(
            user=request.user if request.user.is_authenticated else None,
            action="STATUS_CHANGE",
            resource_type="USER",
            resource_id=str(user.id),
            details={"is_active": user.is_active, "target_user": user.email},
            request=request,
        )

        return Response(
            {"detail": f"User status set to {'Active' if user.is_active else 'Suspended'}.", "is_active": user.is_active},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="audit-trail")
    def audit_trail(self, request, pk=None):
        """
        GET /api/v1/auth/users/{id}/audit-trail/
        Returns activity logs for this specific staff user.
        """
        user = self.get_object()
        logs = UserAuditLog.objects.filter(user=user).order_by("-created_at")[:50]
        serializer = UserAuditLogSerializer(logs, many=True)
        return Response(serializer.data)


class UserAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only Audit Log Trail ViewSet.
    Enables searching, filtering by action, resource type, or staff member.
    """
    queryset = UserAuditLog.objects.select_related("user").all()
    serializer_class = UserAuditLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["action", "resource_type", "resource_id", "user_email_snapshot", "user_agent"]
    ordering_fields = ["created_at", "action", "resource_type"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        action_type = self.request.query_params.get("action")
        resource_type = self.request.query_params.get("resource_type")
        user_id = self.request.query_params.get("user_id")

        if action_type:
            qs = qs.filter(action__iexact=action_type)
        if resource_type:
            qs = qs.filter(resource_type__iexact=resource_type)
        if user_id:
            qs = qs.filter(user_id=user_id)

        ordering_param = self.request.query_params.get("ordering")
        if ordering_param:
            fields = [f.strip() for f in ordering_param.split(",") if f.strip()]
            return qs.order_by(*fields)
        return qs.order_by("-created_at")
