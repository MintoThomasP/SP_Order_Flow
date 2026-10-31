"""
Real-time Server-Sent Events (SSE) and Live Polling Views for Activity Auto-Sync.
"""
import json
import time
from datetime import datetime
from django.http import StreamingHttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from apps.core.models.events import LiveActivityEvent
from apps.core.serializers.events import LiveActivityEventSerializer
from apps.core.services.broadcaster import broadcast_event


class EventsStreamView(APIView):
    """
    GET /api/v1/core/events/stream/
    Server-Sent Events (SSE) streaming endpoint for live multi-user updates.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        last_id = request.query_params.get("last_id")
        start_time = timezone.now()

        def event_stream():
            current_last_time = start_time
            # Initial connection acknowledgement
            yield f"data: {json.dumps({'type': 'CONNECTED', 'timestamp': start_time.isoformat()})}\n\n"

            heartbeat_counter = 0

            while True:
                time.sleep(1.0)
                heartbeat_counter += 1

                # Query new events created since last timestamp
                new_events = list(
                    LiveActivityEvent.objects.filter(created_at__gt=current_last_time)
                    .order_by("created_at")[:20]
                )

                if new_events:
                    for ev in new_events:
                        payload = LiveActivityEventSerializer(ev).data
                        yield f"data: {json.dumps(payload)}\n\n"
                    current_last_time = new_events[-1].created_at

                # Send keep-alive heartbeat every 15 seconds to prevent Nginx/Cloudflare timeouts
                if heartbeat_counter >= 15:
                    heartbeat_counter = 0
                    yield ": heartbeat\n\n"

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"  # Disable Nginx proxy buffering
        return response


class EventsPollView(APIView):
    """
    GET /api/v1/core/events/poll/?since=<iso_timestamp>&limit=20
    High-reliability polling fallback for browsers/proxies that drop long-lived SSE connections.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        since_param = request.query_params.get("since")
        limit = min(int(request.query_params.get("limit", 25)), 50)

        qs = LiveActivityEvent.objects.all().order_by("-created_at")

        if since_param:
            dt = parse_datetime(since_param)
            if dt:
                qs = qs.filter(created_at__gt=dt)

        events = qs[:limit]
        serializer = LiveActivityEventSerializer(events, many=True)

        return Response({
            "count": len(events),
            "events": serializer.data,
            "server_time": timezone.now().isoformat(),
        })


class SimulateActivityEventView(APIView):
    """
    POST /api/v1/core/events/simulate/
    Manually triggers an activity event (e.g. Test notification, audio chime test).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        event_type = request.data.get("event_type", "ORDER_CREATED")
        title = request.data.get("title", "Test Live Event")
        message = request.data.get("message", "Live event broadcast verification.")
        order_number = request.data.get("order_number", "SP-2026-TEST")

        ev = broadcast_event(
            event_type=event_type,
            title=title,
            message=message,
            order_number=order_number,
            actor_name="Test Operator",
            link="/orders",
            metadata={"test": True},
        )

        return Response({
            "message": "Activity event broadcasted successfully.",
            "event": LiveActivityEventSerializer(ev).data if ev else None,
        }, status=status.HTTP_201_CREATED)
