"""
Real-time Activity Broadcaster Service.
Records live activity events and broadcasts them across multi-user sessions.
"""
import json
import logging
from django.utils import timezone
from apps.core.models.events import LiveActivityEvent

logger = logging.getLogger(__name__)


def broadcast_event(
    event_type: str,
    title: str,
    message: str = "",
    order_number: str = "",
    order_id: str = "",
    status_code: str = "",
    status_name: str = "",
    actor_name: str = "System",
    link: str = "/orders",
    metadata: dict = None,
) -> LiveActivityEvent:
    """
    Creates an immutable live activity event record and publishes it to active subscribers.
    """
    try:
        event = LiveActivityEvent.objects.create(
            event_type=event_type,
            title=title,
            message=message,
            order_number=order_number,
            order_id=str(order_id) if order_id else "",
            status_code=status_code,
            status_name=status_name,
            actor_name=actor_name,
            link=link or "/orders",
            metadata=metadata or {},
        )

        # Publish to Redis channel if Redis is active
        try:
            import redis
            from django.conf import settings
            redis_url = getattr(settings, "CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
            r = redis.Redis.from_url(redis_url, socket_timeout=1)
            payload = {
                "id": str(event.id),
                "event_type": event.event_type,
                "title": event.title,
                "message": event.message,
                "order_number": event.order_number,
                "order_id": event.order_id,
                "status_code": event.status_code,
                "status_name": event.status_name,
                "actor_name": event.actor_name,
                "link": event.link,
                "metadata": event.metadata,
                "created_at": event.created_at.isoformat(),
            }
            r.publish("orderflow_live_events", json.dumps(payload))
        except Exception:
            # Redis pub/sub is an optional accelerator; DB polling guarantees delivery
            pass

        return event
    except Exception as exc:
        logger.error(f"Failed to record live activity event: {exc}")
        return None


def broadcast_order_created(order, actor_name: str = "Automated Ingestion"):
    """
    Broadcasts incoming new POD order notification with sound trigger.
    """
    if not order:
        return None

    status_code = order.status.code if order.status else "RECEIVED"
    status_name = order.status.name if order.status else "Order Received"
    source_label = order.get_order_source_display() if hasattr(order, "get_order_source_display") else order.order_source

    return broadcast_event(
        event_type="ORDER_CREATED",
        title=f"New Order Received: {order.order_number}",
        message=f"{order.customer_name} placed an order via {source_label} ({order.total_items_count} items).",
        order_number=order.order_number,
        order_id=str(order.id),
        status_code=status_code,
        status_name=status_name,
        actor_name=actor_name,
        link="/orders",
        metadata={
            "source": order.order_source,
            "customer": order.customer_name,
            "items_count": order.total_items_count,
            "total_amount": str(order.total_amount),
            "currency": order.currency,
        },
    )


def broadcast_status_change(order, old_status_name: str, new_status_code: str, new_status_name: str, actor_name: str = "System", comments: str = ""):
    """
    Broadcasts real-time order status transition to sync all active users.
    """
    if not order:
        return None

    comment_snippet = f" - \"{comments}\"" if comments else ""
    return broadcast_event(
        event_type="STATUS_CHANGED",
        title=f"Order {order.order_number} Updated",
        message=f"Status changed to {new_status_name} by {actor_name}{comment_snippet}.",
        order_number=order.order_number,
        order_id=str(order.id),
        status_code=new_status_code,
        status_name=new_status_name,
        actor_name=actor_name,
        link="/orders",
        metadata={
            "old_status": old_status_name,
            "new_status": new_status_name,
            "status_code": new_status_code,
            "comments": comments,
        },
    )
