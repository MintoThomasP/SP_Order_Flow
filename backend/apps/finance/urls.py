from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.finance.views import (
    DynamicPricingMatrixViewSet,
    CalculateQuoteView,
    GenerateInvoiceView,
    PeechoInvoiceViewSet,
)

router = DefaultRouter()
router.register(r"pricing-matrix", DynamicPricingMatrixViewSet, basename="pricing-matrix")
router.register(r"invoices", PeechoInvoiceViewSet, basename="invoice")

urlpatterns = [
    path("calculate-quote/", CalculateQuoteView.as_view(), name="calculate-quote"),
    path("generate-invoice/", GenerateInvoiceView.as_view(), name="generate-invoice"),
    path("", include(router.urls)),
]
