from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.analytics.views import (
    DashboardMetricsView,
    ReportDamageView,
    ReprintDamageLogViewSet,
    SLAAlertLogViewSet,
    OdooSyncLogViewSet,
    TriggerOdooSyncView,
    OdooSalesOrderFeedView,
    OdooDeliveryFeedView,
    OdooInvoiceFeedView,
)

router = DefaultRouter()
router.register(r"reprints", ReprintDamageLogViewSet, basename="reprint")
router.register(r"sla-alerts", SLAAlertLogViewSet, basename="sla-alert")
router.register(r"odoo-logs", OdooSyncLogViewSet, basename="odoo-log")

urlpatterns = [
    path("dashboard-metrics/", DashboardMetricsView.as_view(), name="dashboard-metrics"),
    path("report-damage/", ReportDamageView.as_view(), name="report-damage"),
    path("odoo-sync/", TriggerOdooSyncView.as_view(), name="odoo-sync-trigger"),
    
    # Clean Odoo ERP Ready REST Endpoints
    path("odoo/sale-orders/", OdooSalesOrderFeedView.as_view(), name="odoo-sale-orders"),
    path("odoo/pickings/", OdooDeliveryFeedView.as_view(), name="odoo-pickings"),
    path("odoo/invoices/", OdooInvoiceFeedView.as_view(), name="odoo-invoices"),
    
    path("", include(router.urls)),
]
