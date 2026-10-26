import uuid
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.orders.models import Order
from apps.core.models.lookups import EntityStatus
from apps.authentication.services.audit import log_staff_action
from apps.dispatch.models import Shipment
from apps.dispatch.serializers import ShipmentSerializer, ConfirmDispatchSerializer
from apps.dispatch.services.peecho_callback import sync_shipment_to_peecho, generate_carrier_tracking_url
from apps.dispatch.services.courier_poller import poll_carrier_status, poll_all_active_shipments
from apps.dispatch.tasks import sync_shipment_to_peecho_task


class ConfirmDispatchView(APIView):
    """
    POST /api/v1/dispatch/confirm-shipment/
    
    Processes final parcel packaging, registers waybill tracking number,
    transitions Order to DISPATCHED, and queues automated Peecho callback.
    """
    def post(self, request):
        serializer = ConfirmDispatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        identifier = data["order_identifier"].strip()

        # Find order
        order = Order.objects.filter(
            order_number__iexact=identifier
        ).first() or Order.objects.filter(
            peecho_order_id__iexact=identifier
        ).first()

        if not order:
            try:
                order = Order.objects.filter(id=identifier).first()
            except Exception:
                pass

        if not order:
            return Response(
                {"success": False, "error": f"POD Order '{identifier}' not found in database."},
                status=status.HTTP_404_NOT_FOUND,
            )

        carrier_code = data.get("carrier_code", "DHL").upper()
        carrier_name = data.get("carrier_name")
        if not carrier_name or (carrier_name == "DHL Express Worldwide" and carrier_code != "DHL"):
            carrier_name = dict(Shipment.CARRIER_CHOICES).get(carrier_code, carrier_code)
        tracking_number = data["tracking_number"].strip()
        tracking_url = data.get("tracking_url") or generate_carrier_tracking_url(carrier_code, tracking_number)
        weight_kg = data.get("weight_kg", 0.500)
        package_type = data.get("package_type", "BUBBLE_MAILER")
        shipping_cost = data.get("shipping_cost", 0.00)
        currency = data.get("currency", "USD")
        awb_document_url = data.get("awb_document_url") or f"https://s3.amazonaws.com/silverpoint-pod-awb-store/{carrier_code}-{tracking_number}-label.pdf"
        notes = data.get("notes", "")
        trigger_sync = data.get("trigger_peecho_sync", True)

        with transaction.atomic():
            operator = request.user if (request.user and request.user.is_authenticated) else None
            operator_name = (operator.get_full_name() or operator.email) if operator else "Dispatch Station Operator"

            dispatched_status = EntityStatus.objects.filter(entity_type="ORDER", code="DISPATCHED").first()

            # Create or update Shipment
            shipment, created = Shipment.objects.update_or_create(
                order=order,
                defaults={
                    "carrier_name": carrier_name,
                    "carrier_code": carrier_code,
                    "tracking_number": tracking_number,
                    "tracking_url": tracking_url,
                    "awb_document_url": awb_document_url,
                    "weight_kg": weight_kg,
                    "package_type": package_type,
                    "shipping_cost": shipping_cost,
                    "currency": currency,
                    "status": dispatched_status,
                    "status_code": "DISPATCHED",
                    "dispatched_by": operator,
                    "dispatched_by_name": operator_name,
                    "dispatched_at": timezone.now(),
                    "notes": notes,
                },
            )

            # Update Order status & carrier preference
            order.carrier_preference = carrier_name
            if dispatched_status:
                order.status = dispatched_status
            order.save(update_fields=["carrier_preference", "status", "updated_at"])

            # Log audit trail
            log_staff_action(
                user=operator,
                action="CONFIRM_DISPATCH",
                resource_type="ORDER",
                resource_id=order.order_number,
                details={
                    "carrier": carrier_name,
                    "tracking_number": tracking_number,
                    "peecho_order_id": order.peecho_order_id,
                    "weight_kg": str(weight_kg),
                    "awb_url": awb_document_url,
                },
            )

        # Trigger Peecho callback async task or immediate execution
        peecho_result = None
        if trigger_sync:
            try:
                # Direct call with graceful Celery task trigger
                peecho_result = sync_shipment_to_peecho(str(shipment.id))
            except Exception as sync_err:
                # Queue for background retry
                try:
                    sync_shipment_to_peecho_task.delay(str(shipment.id))
                except Exception:
                    pass

        shipment.refresh_from_db()
        return Response(
            {
                "success": True,
                "message": f"Order {order.order_number} successfully dispatched with {carrier_name}.",
                "shipment": ShipmentSerializer(shipment).data,
                "peecho_sync": peecho_result,
            },
            status=status.HTTP_201_CREATED,
        )


class ShipmentViewSet(viewsets.ModelViewSet):
    """
    CRUD and actions for Shipment Logistics and Waybills.
    """
    queryset = Shipment.objects.select_related("order", "dispatched_by", "status").all()
    serializer_class = ShipmentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["tracking_number", "order__order_number", "order__peecho_order_id", "carrier_name", "dispatched_by_name"]
    ordering_fields = ["created_at", "dispatched_at", "weight_kg", "status_code"]
    ordering = ["-created_at"]

    @action(detail=True, methods=["post"], url_path="retry-peecho-sync")
    def retry_peecho_sync(self, request, pk=None):
        """
        POST /api/v1/dispatch/shipments/{id}/retry-peecho-sync/
        Manually retries Peecho API dispatch callback for this shipment.
        """
        shipment = self.get_object()
        try:
            result = sync_shipment_to_peecho(str(shipment.id))
            shipment.refresh_from_db()
            return Response({
                "success": True,
                "message": "Peecho tracking callback synchronized successfully.",
                "shipment": ShipmentSerializer(shipment).data,
                "details": result,
            }, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response({
                "success": False,
                "error": str(exc),
                "shipment_id": str(shipment.id),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="poll-tracking")
    def poll_tracking(self, request, pk=None):
        """
        POST /api/v1/dispatch/shipments/{id}/poll-tracking/
        Simulates / triggers carrier API polling checkpoint for this parcel.
        """
        shipment = self.get_object()
        try:
            result = poll_carrier_status(str(shipment.id))
            shipment.refresh_from_db()
            return Response({
                "success": True,
                "shipment": ShipmentSerializer(shipment).data,
                "result": result,
            }, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response({
                "success": False,
                "error": str(exc),
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"], url_path="update-milestone")
    def update_milestone(self, request, pk=None):
        """
        POST /api/v1/dispatch/shipments/{id}/update-milestone/
        Fulfillment milestone tracking: Ready for Dispatch, Out for Delivery, Delivered.
        Syncs live delivery status back to Peecho platform.
        """
        shipment = self.get_object()
        milestone = request.data.get("milestone_code", "").upper()
        notes = request.data.get("notes", "")

        valid_milestones = ["READY_FOR_DISPATCH", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]
        if milestone not in valid_milestones:
            return Response(
                {"error": f"Invalid milestone '{milestone}'. Must be one of: {valid_milestones}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        shipment.status_code = milestone
        if milestone == "DELIVERED":
            shipment.actual_delivered_at = now

        events = list(shipment.carrier_events_log or [])
        events.append({
            "timestamp": now.isoformat(),
            "status": milestone,
            "description": notes or f"Package milestone updated to {milestone.replace('_', ' ').title()}",
            "location": request.data.get("location", "Regional Courier Facility"),
            "carrier": shipment.carrier_name,
        })
        shipment.carrier_events_log = events

        # Find matching EntityStatus for shipment and order
        shipment_status = EntityStatus.objects.filter(entity_type="SHIPMENT", code__iexact=milestone).first()
        if not shipment_status:
            shipment_status = EntityStatus.objects.filter(code__iexact=milestone).first()
        if shipment_status:
            shipment.status = shipment_status

        shipment.save()

        order = shipment.order
        if order:
            order_status = EntityStatus.objects.filter(entity_type="ORDER", code__iexact=milestone).first() or shipment_status
            if order_status:
                order.status = order_status
                order.save(update_fields=["status", "updated_at"])

        from apps.orders.services.peecho_sync import sync_order_status_to_peecho
        peecho_sync = sync_order_status_to_peecho(
            order=order,
            status_code=milestone,
            notes=notes or f"Fulfillment milestone: {milestone}",
            operator=request.user if request.user.is_authenticated else None,
            extra_data={
                "carrier": shipment.carrier_name,
                "tracking_number": shipment.tracking_number,
                "tracking_url": shipment.tracking_url,
                "milestone": milestone,
            },
        )

        log_staff_action(
            user=request.user if request.user.is_authenticated else None,
            action="SHIPMENT_MILESTONE_UPDATE",
            resource_type="SHIPMENT",
            resource_id=shipment.tracking_number,
            details={
                "milestone": milestone,
                "order_number": order.order_number,
                "peecho_order_id": order.peecho_order_id,
                "peecho_sync": peecho_sync,
            },
            request=request,
        )

        return Response({
            "success": True,
            "milestone": milestone,
            "shipment": ShipmentSerializer(shipment).data,
            "peecho_sync": peecho_sync,
        }, status=status.HTTP_200_OK)



class CarrierChoicesView(APIView):
    """
    GET /api/v1/dispatch/carriers/
    Returns supported shipping carriers and standard rates.
    """
    def get(self, request):
        carriers = [
            {"code": "SELF_DELIVERY", "name": "Own Delivery Person (In-House Driver)", "transit_days": "Same Day / Local", "logo": "truck"},
            {"code": "DHL", "name": "DHL Express Worldwide", "transit_days": "1-3 days", "logo": "dhl"},
            {"code": "FEDEX", "name": "FedEx Priority", "transit_days": "2-4 days", "logo": "fedex"},
            {"code": "ARAMEX", "name": "Aramex International", "transit_days": "3-5 days", "logo": "aramex"},
            {"code": "UPS", "name": "UPS Worldwide Express", "transit_days": "2-4 days", "logo": "ups"},
            {"code": "BLUEDART", "name": "BlueDart Express", "transit_days": "1-2 days", "logo": "bluedart"},
            {"code": "DTDC", "name": "DTDC Express", "transit_days": "2-3 days", "logo": "dtdc"},
            {"code": "INDIA_POST", "name": "India Post Speed Post", "transit_days": "3-7 days", "logo": "indiapost"},
        ]
        return Response(carriers, status=status.HTTP_200_OK)
