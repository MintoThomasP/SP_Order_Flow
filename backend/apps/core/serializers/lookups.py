"""
Serializers for SystemRole and EntityStatus dynamic lookups.
"""
from rest_framework import serializers
from apps.core.models.lookups import SystemRole, EntityStatus


class SystemRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemRole
        fields = [
            "id",
            "code",
            "name",
            "description",
            "permissions_matrix",
            "is_system_default",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EntityStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = EntityStatus
        fields = [
            "id",
            "entity_type",
            "code",
            "name",
            "badge_color",
            "badge_bg",
            "badge_text",
            "sort_order",
            "is_terminal",
            "is_failure_state",
            "description",
            "allowed_transitions",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
