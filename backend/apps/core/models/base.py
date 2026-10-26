"""
Abstract Base Model for Silver Point POD operations.
Provides primary key UUID, audit timestamps, and active state flags.
"""
import uuid
from django.db import models


class BaseModel(models.Model):
    """
    Core Abstract Model adhering to Enterprise DDD & Event-Driven Patterns.
    - Uses UUID v4 for unique non-enumerable primary keys.
    - Tracks creation and mutation timestamps.
    - Soft-deactivation state flag (is_active).
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Globally unique UUID identifier for the entity.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="UTC timestamp when the record was created.",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        db_index=True,
        help_text="UTC timestamp when the record was last modified.",
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Soft-state flag indicating if the record is active.",
    )

    class Meta:
        abstract = True
        ordering = ["-created_at"]
