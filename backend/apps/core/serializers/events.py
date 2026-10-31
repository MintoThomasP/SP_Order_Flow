from rest_framework import serializers
from apps.core.models.events import LiveActivityEvent


class LiveActivityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = LiveActivityEvent
        fields = [
            "id",
            "event_type",
            "title",
            "message",
            "order_number",
            "order_id",
            "status_code",
            "status_name",
            "actor_name",
            "link",
            "metadata",
            "created_at",
        ]
        read_only_fields = fields
