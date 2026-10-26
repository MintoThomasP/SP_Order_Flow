"""
Views for Shopfloor Workstation Terminals, Mobile Barcode/QR Scanner, and Instant Transitions.
"""
from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.shopfloor.models import ShopfloorStation, ScanEventLog
from apps.shopfloor.serializers import (
    ShopfloorStationSerializer,
    ScanEventLogSerializer,
    ScanStatusUpdateRequestSerializer,
)
from apps.shopfloor.services.scanner import process_barcode_scan


class ShopfloorUpdateStatusView(APIView):
    """
    PATCH /api/v1/shopfloor/update-status/
    POST  /api/v1/shopfloor/update-status/
    
    Processes real-time camera QR or Bluetooth hardware scanner scans.
    Executes instant workflow progression (Queued -> Printing -> Cutting -> Binding -> QC Passed).
    """
    def patch(self, request):
        return self._handle_scan(request)

    def post(self, request):
        return self._handle_scan(request)

    def _handle_scan(self, request):
        serializer = ScanStatusUpdateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        barcode = serializer.validated_data["barcode"]
        station = serializer.validated_data.get("station", "PRINT")
        status_code = serializer.validated_data.get("status_code")
        notes = serializer.validated_data.get("notes", "")

        client_ip = request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR")

        try:
            result = process_barcode_scan(
                raw_barcode=barcode,
                station_code=station,
                target_status_code=status_code,
                operator=request.user if request.user.is_authenticated else None,
                client_ip=client_ip,
                notes=notes,
            )
            return Response(result, status=status.HTTP_200_OK)

        except ValueError as val_err:
            return Response(
                {
                    "success": False,
                    "error": str(val_err),
                    "barcode_scanned": barcode,
                    "station": station,
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as exc:
            return Response(
                {
                    "success": False,
                    "error": f"Internal scan processing error: {str(exc)}",
                    "barcode_scanned": barcode,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ShopfloorStationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Lists active touch workstations on the POD production floor.
    """
    queryset = ShopfloorStation.objects.all()
    serializer_class = ShopfloorStationSerializer
    ordering = ["sort_order"]


class ScanEventLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Live stream of shopfloor barcode scan events.
    """
    queryset = ScanEventLog.objects.all()
    serializer_class = ScanEventLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["barcode_scanned", "entity_reference", "station", "operator_name_snapshot"]
    ordering_fields = ["created_at", "station"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        station = self.request.query_params.get("station")
        if station:
            qs = qs.filter(station__iexact=station)
        return qs

