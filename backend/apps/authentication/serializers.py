"""
Serializers for Staff Authentication, SimpleJWT Claims, User Management, and Audit Logs.
"""
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from apps.authentication.models import User, UserAuditLog
from apps.core.models.lookups import SystemRole
from apps.core.serializers.lookups import SystemRoleSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends SimpleJWT to inject staff role, permissions matrix, and metadata directly into JWT claims.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Custom claims
        token["email"] = user.email
        token["full_name"] = user.get_full_name() or user.email
        token["employee_id"] = user.employee_id or ""
        token["department"] = user.department
        token["role_code"] = user.role.code if user.role else "NO_ROLE"
        token["role_name"] = user.role.name if user.role else "Unassigned Role"
        token["permissions_matrix"] = user.role.permissions_matrix if user.role else {}
        token["is_staff"] = user.is_staff
        token["is_superuser"] = user.is_superuser

        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        # Return user object in response body along with JWT tokens
        data["user"] = {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": user.get_full_name() or user.email,
            "employee_id": user.employee_id,
            "department": user.department,
            "phone_number": user.phone_number,
            "avatar_url": user.avatar_url,
            "role": SystemRoleSerializer(user.role).data if user.role else None,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "created_at": user.created_at,
        }
        return data


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for listing and reading staff user details.
    """
    role_details = SystemRoleSerializer(source="role", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "employee_id",
            "department",
            "phone_number",
            "avatar_url",
            "role",
            "role_details",
            "is_active",
            "is_staff",
            "is_superuser",
            "last_activity_at",
            "last_login",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "last_activity_at", "last_login", "created_at", "updated_at"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email


class UserCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating staff accounts.
    """
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "password",
            "first_name",
            "last_name",
            "employee_id",
            "department",
            "phone_number",
            "avatar_url",
            "role",
            "is_active",
            "is_staff",
        ]

    def validate_role(self, value):
        from django.db.models import Q
        if value and value.code == "PEECHO_SERVICE":
            raise serializers.ValidationError(
                "The 'Peecho API Service Worker' role is reserved for automated system machine daemons and cannot be assigned to human staff accounts."
            )
        if value and value.code == "SUPER_ADMIN":
            existing_super = User.objects.filter(Q(is_superuser=True) | Q(role__code="SUPER_ADMIN"))
            if self.instance:
                existing_super = existing_super.exclude(id=self.instance.id)
            if existing_super.exists():
                raise serializers.ValidationError(
                    "Only one Super Admin is allowed in the system. The Super Admin role cannot be assigned to another user."
                )
        return value

    def validate(self, attrs):
        from django.db.models import Q
        # 1. Enforce single Super Admin on user creation
        if self.instance is None:
            role = attrs.get("role")
            if (role and role.code == "SUPER_ADMIN") or attrs.get("is_superuser"):
                if User.objects.filter(Q(is_superuser=True) | Q(role__code="SUPER_ADMIN")).exists():
                    raise serializers.ValidationError(
                        {"role": "Only one Super Admin is allowed in the system. You cannot create another Super Admin account."}
                    )

        # 2. Enforce immutable Super Admin profile on update (only password change allowed)
        if self.instance:
            is_super = self.instance.is_superuser or (self.instance.role and self.instance.role.code == "SUPER_ADMIN")
            if is_super:
                forbidden_fields = [
                    "first_name", "last_name", "email", "employee_id",
                    "department", "phone_number", "avatar_url", "role",
                    "is_active", "is_staff"
                ]
                has_forbidden_changes = False
                for field in forbidden_fields:
                    if field in attrs:
                        curr_val = getattr(self.instance, field)
                        new_val = attrs[field]
                        if field == "role":
                            curr_role_id = self.instance.role_id
                            new_role_id = getattr(new_val, "id", new_val)
                            if curr_role_id != new_role_id:
                                has_forbidden_changes = True
                                break
                        elif curr_val != new_val:
                            has_forbidden_changes = True
                            break
                if has_forbidden_changes:
                    raise serializers.ValidationError(
                        "The Super Admin account is permanently protected. Profile details, department, and role cannot be modified. Only password changes are permitted."
                    )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class RoleAssignmentSerializer(serializers.Serializer):
    """
    Serializer for assigning a system role to a staff member.
    """
    role_id = serializers.UUIDField(required=True)
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class UserAuditLogSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing immutable audit logs.
    """
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = UserAuditLog
        fields = [
            "id",
            "user",
            "user_name",
            "user_email_snapshot",
            "action",
            "resource_type",
            "resource_id",
            "details",
            "ip_address",
            "user_agent",
            "created_at",
        ]
        read_only_fields = fields

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.email
        return obj.user_email_snapshot or "System"
