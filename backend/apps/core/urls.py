"""
Core URL routing for Lookups API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.core.views.lookups import SystemRoleViewSet, EntityStatusViewSet
from apps.core.views.health import HealthCheckView
from apps.core.views.events import EventsStreamView, EventsPollView, SimulateActivityEventView
from apps.core.views.search import GlobalSearchView

router = DefaultRouter()
router.register(r"roles", SystemRoleViewSet, basename="system-roles")
router.register(r"statuses", EntityStatusViewSet, basename="entity-statuses")

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="system-health"),
    path("search/", GlobalSearchView.as_view(), name="global-search"),
    path("events/stream/", EventsStreamView.as_view(), name="events-stream"),
    path("events/poll/", EventsPollView.as_view(), name="events-poll"),
    path("events/simulate/", SimulateActivityEventView.as_view(), name="events-simulate"),
    path("", include(router.urls)),
]
