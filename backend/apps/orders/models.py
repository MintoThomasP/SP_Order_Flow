"""
POD Orders, Items, SLA Deadlines, and Peecho Webhook Ingestion Log Models.
"""
import uuid
from decimal import Decimal
from django.db import models
from apps.core.models.base import BaseModel
from apps.core.models.lookups import EntityStatus


class PeechoPayloadLog(models.Model):
    """
    Immutable log of all incoming Peecho webhook payloads.
    Guarantees raw data auditability and payload deduplication.
    """
    STATUS_CHOICES = [
        ("RECEIVED", "Received"),
        ("PROCESSED", "Processed & Ingested"),
        ("DUPLICATE", "Duplicate Skipped"),
        ("INVALID_AUTH", "Invalid API Auth"),
        ("FAILED", "Ingestion Failed"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    peecho_order_id = models.CharField(
        max_length=128,
        db_index=True,
        blank=True,
        help_text="Peecho Order Reference extracted from payload.",
    )
    event_type = models.CharField(
        max_length=64,
        default="order.created",
        help_text="Peecho event type (e.g. order.created, order.updated, order.cancelled).",
    )
    payload_hash = models.CharField(
        max_length=64,
        db_index=True,
        blank=True,
        help_text="SHA-256 fingerprint of raw payload for deduplication.",
    )
    raw_payload = models.JSONField(
        default=dict,
        help_text="Exact raw JSON payload received from Peecho.",
    )
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default="RECEIVED",
        db_index=True,
    )
    error_message = models.TextField(
        blank=True,
        help_text="Details if ingestion failed or validation threw error.",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )
    is_sandbox = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True if webhook was ingested via staging subdomain or sandbox secret key.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    class Meta:
        verbose_name = "Peecho Payload Log"
        verbose_name_plural = "Peecho Payload Logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Peecho Log [{self.peecho_order_id or 'UNKNOWN'}] - {self.status} at {self.created_at}"


class Order(BaseModel):
    """
    Central POD Order entity ingested from Peecho or internal enterprise sources.
    Linked to dynamic EntityStatus and tracks SLA deadlines.
    """
    SLA_PRIORITY_CHOICES = [
        ("RUSH_8H", "Rush Same-Day (8 Hours SLA)"),
        ("EXPRESS_24H", "Express (24 Hours SLA)"),
        ("STANDARD_72H", "Standard (72 Hours SLA)"),
    ]

    order_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Internal human-friendly Silver Point POD order identifier (e.g., SP-2026-88219).",
    )
    peecho_order_id = models.CharField(
        max_length=128,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Unique external Peecho Order Reference ID.",
    )
    ORDER_SOURCE_CHOICES = [
        ("peecho", "Peecho POD"),
        ("printify", "Printify POD"),
        ("custom_api", "Custom POD / REST API"),
        ("manual", "Internal / Manual"),
    ]
    order_source = models.CharField(
        max_length=32,
        choices=ORDER_SOURCE_CHOICES,
        default="peecho",
        db_index=True,
        help_text="Origin channel or external POD vendor for this order.",
    )
    is_external_pod = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Flag indicating if the order is routed to an external POD partner.",
    )
    is_sandbox = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True if order arrived via staging subdomain or sandbox secret key (test order excluded from live press & billing).",
    )
    external_pod_order_id = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        db_index=True,
        help_text="External POD order identifier from vendor (e.g. Printify order ID).",
    )
    tracking_number = models.CharField(
        max_length=128,
        blank=True,
        default="",
        db_index=True,
        help_text="Carrier parcel tracking number code.",
    )
    customer_name = models.CharField(
        max_length=255,
        help_text="Recipient customer full name.",
    )
    customer_email = models.EmailField(
        blank=True,
        help_text="Customer notification email.",
    )
    customer_phone = models.CharField(
        max_length=64,
        blank=True,
    )
    shipping_address = models.JSONField(
        default=dict,
        help_text="Structured destination shipping address (recipient, street, city, state, postal_code, country).",
    )
    carrier_preference = models.CharField(
        max_length=64,
        default="DHL Express",
        help_text="Selected courier provider (e.g. DHL Express, FedEx, Standard Postal).",
    )
    status = models.ForeignKey(
        EntityStatus,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="orders",
        help_text="Dynamic lifecycle status resolved from EntityStatus lookup.",
    )
    sla_deadline = models.DateTimeField(
        db_index=True,
        help_text="Hard target UTC timestamp before SLA is breached.",
    )
    sla_priority = models.CharField(
        max_length=32,
        choices=SLA_PRIORITY_CHOICES,
        default="STANDARD_72H",
        db_index=True,
    )
    total_items_count = models.PositiveIntegerField(
        default=1,
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    currency = models.CharField(
        max_length=8,
        default="EUR",
    )
    peecho_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Raw Peecho order metadata and webhook headers.",
    )

    class Meta:
        verbose_name = "POD Order"
        verbose_name_plural = "POD Orders"
        ordering = ["-created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._initial_status_id = self.status_id
        self._initial_status_name = self.status.name if self.status else ""

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)

        try:
            from apps.core.services.broadcaster import broadcast_order_created, broadcast_status_change
            if is_new:
                broadcast_order_created(self, actor_name=f"{self.get_order_source_display()} Gateway")
            elif hasattr(self, "_initial_status_id") and self._initial_status_id and self._initial_status_id != self.status_id:
                old_name = getattr(self, "_initial_status_name", "") or "Previous Status"
                new_code = self.status.code if self.status else "UNKNOWN"
                new_name = self.status.name if self.status else "Updated Status"
                broadcast_status_change(
                    order=self,
                    old_status_name=old_name,
                    new_status_code=new_code,
                    new_status_name=new_name,
                    actor_name="Operations Staff",
                )
                self._initial_status_id = self.status_id
                self._initial_status_name = new_name
        except Exception:
            pass

    def __str__(self):
        status_name = self.status.name if self.status else "Unassigned"
        return f"{self.order_number} [Peecho: {self.peecho_order_id}] - {status_name}"


class OrderItem(BaseModel):
    """
    Individual print product line item within a POD Order.
    Tracks product specifications, page count, spine width, and artwork PDF asset URLs.
    """
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
        help_text="Parent POD Order.",
    )
    peecho_item_id = models.CharField(
        max_length=128,
        blank=True,
        help_text="Peecho line item identifier.",
    )
    external_item_id = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="External line item ID from POD partner.",
    )
    printify_product_id = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Printify catalog product ID.",
    )
    printify_variant_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="Printify Variant ID.",
    )
    printify_print_provider_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="Printify Print Provider ID.",
    )
    printify_blueprint_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="Printify Blueprint Catalog ID.",
    )
    product_type = models.CharField(
        max_length=128,
        help_text="Print product title (e.g., Hardcover Photo Book A4, Softcover Booklet, Canvas 40x60).",
    )
    quantity = models.PositiveIntegerField(
        default=1,
    )
    page_count = models.PositiveIntegerField(
        default=24,
        help_text="Total number of book / booklet pages.",
    )
    spine_width_mm = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("8.50"),
        help_text="Calculated spine thickness in millimeters based on page count and paper caliper.",
    )
    paper_stock = models.CharField(
        max_length=128,
        default="200gsm Silk Inner + 350gsm Gloss Cover",
        help_text="Physical paper stock and finishing specification.",
    )
    pdf_artwork_url = models.TextField(
        blank=True,
        help_text="Direct URL to downloadable high-resolution content PDF.",
    )
    pdf_cover_url = models.TextField(
        blank=True,
        help_text="Direct URL to downloadable high-resolution cover PDF.",
    )
    item_status = models.ForeignKey(
        EntityStatus,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
    )
    preflight_passed = models.BooleanField(
        default=False,
        help_text="True if automated preflight check verified trim, bleed, and DPI resolution.",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    class Meta:
        verbose_name = "POD Order Item"
        verbose_name_plural = "POD Order Items"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product_type} (Qty: {self.quantity}) in {self.order.order_number}"


class PeechoIntegrationConfig(BaseModel):
    """
    Centralized Integration Settings for Peecho API & Webhook Gateway.
    Stores merchant credentials, authorization tokens, and webhook endpoints securely.
    """
    api_base_url = models.URLField(
        max_length=255,
        default="https://api.peecho.com",
        help_text="Peecho API Base URL (e.g. https://api.peecho.com or sandbox).",
    )
    button_key = models.CharField(
        max_length=128,
        default="17903659506881470",
        help_text="Peecho Button Key for embedded widget and client authorization.",
    )
    api_key = models.CharField(
        max_length=255,
        default="d26a4bc185ddd453844d2ef3d868543c58a723a8",
        help_text="Peecho Merchant REST API Key.",
    )
    secret_key = models.CharField(
        max_length=255,
        default="62115a908bc3de41628dde0642f1c6590595996b",
        help_text="Peecho Secret Key for API authentication.",
    )
    webhook_secret = models.CharField(
        max_length=255,
        default="62115a908bc3de41628dde0642f1c6590595996b",
        help_text="Secret token for HMAC SHA-256 webhook signature validation.",
    )
    production_secret_key = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="PEECHO_PRODUCTION_SECRET_KEY used to validate live webhooks on orderflow.silverpointprint.com.",
    )
    staging_secret_key = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="PEECHO_STAGING_SECRET_KEY used to validate sandbox webhooks on staging.orderflow.silverpointprint.com.",
    )
    secret_key_source = models.CharField(
        max_length=32,
        default="SILVERPOINT_GENERATED",
        choices=[
            ("SILVERPOINT_GENERATED", "Generated by Silver Point (Auto-saved to .env)"),
            ("PEECHO_ADMIN", "Provided by Peecho (Saved via Admin Panel)"),
        ],
        help_text="Indicates whether keys were auto-generated by Silver Point (.env) or entered from Peecho via Admin.",
    )
    webhook_endpoint_path = models.CharField(
        max_length=255,
        default="/api/v1/peecho/webhook/",
        help_text="Inbound webhook endpoint path on Silver Point POD gateway.",
    )
    is_sandbox = models.BooleanField(
        default=True,
        help_text="Toggle between Peecho Sandbox (mock) and Live Production mode.",
    )
    auto_sync_status_changes = models.BooleanField(
        default=True,
        help_text="Automatically push internal status changes back to Peecho in real-time.",
    )
    last_connection_test_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    last_connection_status = models.CharField(
        max_length=64,
        default="CONNECTED",
    )

    class Meta:
        verbose_name = "Peecho Integration Config"
        verbose_name_plural = "Peecho Integration Configs"

    @staticmethod
    def sync_keys_to_env_files(production_key: str, staging_key: str) -> list[str]:
        """
        Automatically writes PEECHO_PRODUCTION_SECRET_KEY and PEECHO_STAGING_SECRET_KEY
        into backend/.env and backend/.env.production.server, and updates django.conf.settings.
        """
        import os
        import re
        from pathlib import Path
        from django.conf import settings

        if production_key:
            setattr(settings, "PEECHO_PRODUCTION_SECRET_KEY", production_key)
            os.environ["PEECHO_PRODUCTION_SECRET_KEY"] = production_key
        if staging_key:
            setattr(settings, "PEECHO_STAGING_SECRET_KEY", staging_key)
            os.environ["PEECHO_STAGING_SECRET_KEY"] = staging_key

        base_dir = Path(getattr(settings, "BASE_DIR", Path(__file__).resolve().parent.parent.parent))
        candidate_files = [
            base_dir / ".env",
            base_dir / ".env.production.server",
        ]
        updated_files: list[str] = []

        for env_path in candidate_files:
            if not env_path.exists():
                continue
            try:
                content = env_path.read_text(encoding="utf-8")
                if production_key:
                    if re.search(r"^PEECHO_PRODUCTION_SECRET_KEY=.*$", content, flags=re.MULTILINE):
                        content = re.sub(
                            r"^PEECHO_PRODUCTION_SECRET_KEY=.*$",
                            f"PEECHO_PRODUCTION_SECRET_KEY={production_key}",
                            content,
                            flags=re.MULTILINE,
                        )
                    else:
                        content = content.rstrip() + f"\nPEECHO_PRODUCTION_SECRET_KEY={production_key}\n"

                if staging_key:
                    if re.search(r"^PEECHO_STAGING_SECRET_KEY=.*$", content, flags=re.MULTILINE):
                        content = re.sub(
                            r"^PEECHO_STAGING_SECRET_KEY=.*$",
                            f"PEECHO_STAGING_SECRET_KEY={staging_key}",
                            content,
                            flags=re.MULTILINE,
                        )
                    else:
                        content = content.rstrip() + f"\nPEECHO_STAGING_SECRET_KEY={staging_key}\n"

                env_path.write_text(content, encoding="utf-8")
                updated_files.append(env_path.name)
            except Exception:
                pass

        return updated_files

    def generate_keys_from_our_end(self, sync_env: bool = True) -> dict:
        """
        Generates cryptographically secure 256-bit Production & Staging secret keys
        from Silver Point's end, saves them in the database, and writes them to .env.
        """
        import secrets

        prod_key = f"sp_live_{secrets.token_hex(32)}"
        stg_key = f"sp_stg_{secrets.token_hex(32)}"

        self.production_secret_key = prod_key
        self.staging_secret_key = stg_key
        self.webhook_secret = prod_key
        self.secret_key_source = "SILVERPOINT_GENERATED"
        self.save(
            update_fields=[
                "production_secret_key",
                "staging_secret_key",
                "webhook_secret",
                "secret_key_source",
                "updated_at",
            ]
        )

        updated_files = []
        if sync_env:
            updated_files = self.sync_keys_to_env_files(prod_key, stg_key)

        return {
            "production_secret_key": prod_key,
            "staging_secret_key": stg_key,
            "secret_key_source": self.secret_key_source,
            "updated_env_files": updated_files,
        }

    @classmethod
    def get_active(cls):
        """
        Retrieves or initializes the active Peecho configuration singleton.
        If secret keys are missing, auto-populates from .env or generates & saves them to .env.
        """
        import secrets
        from django.conf import settings

        env_prod_key = getattr(settings, "PEECHO_PRODUCTION_SECRET_KEY", "") or ""
        env_stg_key = getattr(settings, "PEECHO_STAGING_SECRET_KEY", "") or ""

        placeholder_values = {
            "",
            "prod_peecho_hmac_sha256_secret_2026",
            "staging_peecho_hmac_sha256_secret_2026",
            "CHANGE_ME_PRODUCTION_PEECHO_HMAC_SHA256_SECRET",
            "CHANGE_ME_STAGING_PEECHO_HMAC_SHA256_SECRET",
        }

        config = cls.objects.first()
        if not config:
            prod_key = env_prod_key if env_prod_key not in placeholder_values else f"sp_live_{secrets.token_hex(32)}"
            stg_key = env_stg_key if env_stg_key not in placeholder_values else f"sp_stg_{secrets.token_hex(32)}"
            config = cls.objects.create(
                api_base_url=getattr(settings, "PEECHO_API_BASE_URL", "https://api.peecho.com"),
                button_key=getattr(settings, "PEECHO_BUTTON_KEY", "17903659506881470"),
                api_key=getattr(settings, "PEECHO_API_KEY", "d26a4bc185ddd453844d2ef3d868543c58a723a8"),
                secret_key=getattr(settings, "PEECHO_SECRET_KEY", "62115a908bc3de41628dde0642f1c6590595996b"),
                webhook_secret=prod_key,
                production_secret_key=prod_key,
                staging_secret_key=stg_key,
                secret_key_source="SILVERPOINT_GENERATED",
                is_sandbox=True,
                auto_sync_status_changes=True,
                last_connection_status="CONNECTED",
            )
            cls.sync_keys_to_env_files(prod_key, stg_key)
        else:
            needs_save = False
            if not config.production_secret_key:
                config.production_secret_key = (
                    env_prod_key if env_prod_key not in placeholder_values else f"sp_live_{secrets.token_hex(32)}"
                )
                needs_save = True
            if not config.staging_secret_key:
                config.staging_secret_key = (
                    env_stg_key if env_stg_key not in placeholder_values else f"sp_stg_{secrets.token_hex(32)}"
                )
                needs_save = True
            if needs_save:
                config.save(update_fields=["production_secret_key", "staging_secret_key", "updated_at"])
                if env_prod_key in placeholder_values or env_stg_key in placeholder_values:
                    cls.sync_keys_to_env_files(config.production_secret_key, config.staging_secret_key)
        return config

    def __str__(self):
        return f"Peecho Config ({self.api_base_url}) - {'Sandbox' if self.is_sandbox else 'Production'}"


class PrintifyPayloadLog(models.Model):
    """
    Immutable audit log of all incoming Printify webhook event notifications.
    """
    STATUS_CHOICES = [
        ("RECEIVED", "Received"),
        ("PROCESSED", "Processed & Ingested"),
        ("IGNORED", "Event Ignored"),
        ("INVALID_SIGNATURE", "Invalid Webhook Signature"),
        ("FAILED", "Processing Failed"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    printify_order_id = models.CharField(
        max_length=128,
        db_index=True,
        blank=True,
        help_text="Printify Order Reference extracted from webhook.",
    )
    event_type = models.CharField(
        max_length=128,
        db_index=True,
        help_text="Printify event topic (e.g. order:shipment:created, order:updated, order:sent-to-production).",
    )
    raw_payload = models.JSONField(
        default=dict,
        help_text="Exact raw JSON payload received from Printify.",
    )
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default="RECEIVED",
        db_index=True,
    )
    error_message = models.TextField(
        blank=True,
        help_text="Details if webhook processing failed.",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )
    is_sandbox = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True if webhook was ingested via staging subdomain or sandbox secret key.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    class Meta:
        verbose_name = "Printify Payload Log"
        verbose_name_plural = "Printify Payload Logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Printify Log [{self.event_type} - {self.printify_order_id or 'N/A'}] - {self.status} at {self.created_at}"


