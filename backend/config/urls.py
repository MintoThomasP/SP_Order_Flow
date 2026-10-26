"""
Main URL Configuration for Silver Point POD Operations Portal & Peecho API Gateway.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path("admin/", admin.site.urls),
    
    # OpenAPI 3 Schema & Swagger UI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/swagger/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/docs/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    
    # Core API endpoints (Roles & Statuses)
    path("api/v1/core/", include("apps.core.urls")),
    
    # Auth & Staff RBAC endpoints
    path("api/v1/auth/", include("apps.authentication.urls")),

    # Prepress & Artwork Inspection endpoints
    path("api/v1/prepress/", include("apps.prepress.urls")),

    # Production Batching & Job Tickets endpoints
    path("api/v1/production/", include("apps.production.urls")),

    # Shopfloor Workstations & Mobile Scanner endpoints
    path("api/v1/shopfloor/", include("apps.shopfloor.urls")),

    # Dispatch & Automated Peecho Callback endpoints
    path("api/v1/dispatch/", include("apps.dispatch.urls")),

    # Finance, Pricing & Invoicing Engine endpoints
    path("api/v1/finance/", include("apps.finance.urls")),

    # Operational Analytics, Re-prints, SLA Alerts & Odoo ERP endpoints
    path("api/v1/analytics/", include("apps.analytics.urls")),

    # Orders & Peecho Ingestion endpoints
    path("api/v1/", include("apps.orders.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
