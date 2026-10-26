"""
REST ViewSets for System Roles and Dynamic Entity Statuses.
"""
from rest_framework import viewsets, filters
from apps.core.models.lookups import SystemRole, EntityStatus
from apps.core.serializers.lookups import SystemRoleSerializer, EntityStatusSerializer


class SystemRoleViewSet(viewsets.ModelViewSet):
    """
    CRUD API for dynamic system roles.
    """
    queryset = SystemRole.objects.all()
    serializer_class = SystemRoleSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "name", "description"]
    ordering_fields = ["name", "code", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = self.request.query_params.get("active_only")
        if active_only and active_only.lower() in ("true", "1"):
            qs = qs.filter(is_active=True)
        return qs


class EntityStatusViewSet(viewsets.ModelViewSet):
    """
    CRUD and lookup API for dynamic entity statuses.
    Enables zero hardcoded status choices and dynamic client badge resolution.
    """
    queryset = EntityStatus.objects.all()
    serializer_class = EntityStatusSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["code", "name", "entity_type", "description"]
    ordering_fields = ["entity_type", "sort_order", "code", "created_at"]
    ordering = ["entity_type", "sort_order", "code"]

    def get_queryset(self):
        qs = super().get_queryset()
        entity_type = self.request.query_params.get("entity_type")
        if entity_type:
            qs = qs.filter(entity_type__iexact=entity_type)
        active_only = self.request.query_params.get("active_only")
        if active_only and active_only.lower() in ("true", "1"):
            qs = qs.filter(is_active=True)
        return qs
