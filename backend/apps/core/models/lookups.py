"""
Dynamic Lookup Models for System Roles and Entity Statuses.
Ensures zero hardcoded status choices across the POD Operations Portal.
"""
from django.db import models
from .base import BaseModel


class SystemRole(BaseModel):
    """
    Dynamic System Role definition for role-based access control and operator assignments.
    """
    code = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Unique programmatic slug/key for the role (e.g., SUPER_ADMIN, PREPRESS_LEAD).",
    )
    name = models.CharField(
        max_length=128,
        help_text="Human-readable title of the role.",
    )
    description = models.TextField(
        blank=True,
        help_text="Functional responsibilities and scope of this role.",
    )
    permissions_matrix = models.JSONField(
        default=dict,
        blank=True,
        help_text="Granular capability tokens and module permission mappings.",
    )
    is_system_default = models.BooleanField(
        default=False,
        help_text="True if this is a built-in immutable system role.",
    )

    class Meta:
        verbose_name = "System Role"
        verbose_name_plural = "System Roles"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class EntityStatus(BaseModel):
    """
    Dynamic Entity Status lookup system.
    Supports zero hardcoded status choices with state-machine transition validation and UI badge tokens.
    """
    entity_type = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Target entity category (e.g., ORDER, PRINT_JOB, BATCH, DISPATCH, PEECHO_SYNC).",
    )
    code = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Programmatic status code (e.g., PENDING_PREPRESS, PRINTING, DISPATCHED).",
    )
    name = models.CharField(
        max_length=128,
        help_text="Human-readable status label displayed on portal dashboards.",
    )
    badge_color = models.CharField(
        max_length=32,
        default="indigo",
        help_text="Visual badge theme token (e.g. purple, emerald, amber, rose, sky, slate).",
    )
    badge_bg = models.CharField(
        max_length=32,
        default="#EEF2FF",
        help_text="Soft background hex code or theme token for Flux UI badges.",
    )
    badge_text = models.CharField(
        max_length=32,
        default="#4F46E5",
        help_text="Foreground text hex code for badge styling.",
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Logical progression index in the lifecycle pipeline.",
    )
    is_terminal = models.BooleanField(
        default=False,
        help_text="True if this status concludes the lifecycle (e.g. DELIVERED, VOIDED).",
    )
    is_failure_state = models.BooleanField(
        default=False,
        help_text="True if this indicates an error requiring manual intervention/retry.",
    )
    description = models.TextField(
        blank=True,
        help_text="Operational explanation of what this status represents.",
    )
    allowed_transitions = models.JSONField(
        default=list,
        blank=True,
        help_text="List of status codes that can be transitioned to from this state.",
    )

    class Meta:
        verbose_name = "Entity Status"
        verbose_name_plural = "Entity Statuses"
        unique_together = ("entity_type", "code")
        ordering = ["entity_type", "sort_order", "code"]

    def __str__(self):
        return f"[{self.entity_type}] {self.name} ({self.code})"
