"""
Custom Staff User Model linked to SystemRole and Enterprise UserAuditLog.
"""
import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class CustomUserManager(BaseUserManager):
    """
    Custom user manager where email is the primary identifier for authentication.
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set.")
        email = self.normalize_email(email)
        extra_fields.setdefault("username", email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Staff User entity linked directly to dynamic SystemRole.
    Uses UUID primary key and email authentication.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Globally unique UUID identifier for the staff member.",
    )
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text="Corporate email address used for login and notifications.",
    )
    username = models.CharField(
        max_length=150,
        unique=True,
        blank=True,
        null=True,
    )
    phone_number = models.CharField(
        max_length=32,
        blank=True,
        help_text="Work contact phone number.",
    )
    employee_id = models.CharField(
        max_length=32,
        blank=True,
        unique=True,
        null=True,
        help_text="Internal badge or employee identification code.",
    )
    department = models.CharField(
        max_length=64,
        default="Operations",
        help_text="Department (e.g., Prepress, Shopfloor Press, Bindery, Dispatch, Management, Finance).",
    )
    role = models.ForeignKey(
        "core.SystemRole",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_users",
        help_text="Assigned dynamic system role for RBAC authorization.",
    )
    avatar_url = models.URLField(
        blank=True,
        null=True,
        help_text="Avatar profile picture URL.",
    )
    last_activity_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of latest staff interaction.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    objects = CustomUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "Staff User"
        verbose_name_plural = "Staff Users"
        ordering = ["-created_at"]

    def __str__(self):
        role_label = self.role.name if self.role else "No Role"
        return f"{self.get_full_name() or self.email} ({role_label})"

    @property
    def role_code(self):
        return self.role.code if self.role else "NO_ROLE"

    @property
    def permissions_matrix(self):
        return self.role.permissions_matrix if self.role else {}


class UserAuditLog(models.Model):
    """
    Audit log record capturing all sensitive staff activities:
    - Downloading artwork
    - Changing order / job status
    - Entering tracking / carrier waybill codes
    - Changing system roles / permissions
    - Login and authentication events
    """
    ACTION_CHOICES = [
        ("ARTWORK_DOWNLOAD", "Downloaded Artwork PDF"),
        ("STATUS_CHANGE", "Changed Entity Status"),
        ("TRACKING_CODE_ENTRY", "Entered Carrier Tracking Code"),
        ("ROLE_ASSIGNMENT", "Updated Staff Role"),
        ("USER_CREATE", "Created Staff User"),
        ("USER_UPDATE", "Updated Staff User"),
        ("PASSWORD_CHANGE", "Changed User Password"),
        ("USER_LOGIN", "Staff Authenticated"),
        ("USER_LOGOUT", "Staff Logged Out"),
        ("PEECHO_SYNC_TRIGGERED", "Triggered Manual Peecho Sync"),
        ("PRINT_JOB_RERUN", "Triggered Press Reprint"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        help_text="Staff operator who performed the action.",
    )
    user_email_snapshot = models.EmailField(
        blank=True,
        help_text="Immutable email snapshot for auditing even if user is deleted.",
    )
    action = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Categorized staff action code.",
    )
    resource_type = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Target domain entity (e.g. ORDER, PRINT_JOB, SHIPMENT, USER).",
    )
    resource_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="Identifier of the resource affected.",
    )
    details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Audit metadata snapshot (previous state, new state, file hash, ip, tracking code, etc.).",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="Client IP address where the action originated.",
    )
    user_agent = models.TextField(
        blank=True,
        help_text="Client browser/device User Agent.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="UTC timestamp when the action occurred.",
    )

    class Meta:
        verbose_name = "User Audit Log"
        verbose_name_plural = "User Audit Logs"
        ordering = ["-created_at"]

    def __str__(self):
        user_str = self.user_email_snapshot or (self.user.email if self.user else "System/Anonymous")
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {user_str} -> {self.action} on {self.resource_type}:{self.resource_id}"

    def save(self, *args, **kwargs):
        if self.user and not self.user_email_snapshot:
            self.user_email_snapshot = self.user.email
        super().save(*args, **kwargs)
