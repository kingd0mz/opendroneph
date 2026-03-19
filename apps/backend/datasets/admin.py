from django.contrib import admin

from datasets.models import (
    Dataset,
    DatasetAsset,
    PHBoundary,
    ValidationRecord,
)


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "uploader",
        "type",
        "status",
        "validation_status",
        "created_at",
    )
    list_filter = ("type", "status", "validation_status")
    search_fields = ("title", "uploader__email")
    readonly_fields = ("created_at", "updated_at", "published_at")


@admin.register(DatasetAsset)
class DatasetAssetAdmin(admin.ModelAdmin):
    list_display = ("id", "dataset", "asset_type", "size_bytes", "is_downloadable")
    list_filter = ("asset_type", "is_downloadable", "is_renderable_rgb")
    search_fields = ("dataset__title", "dataset__uploader__email", "object_key")
    readonly_fields = ("created_at",)


@admin.register(ValidationRecord)
class ValidationRecordAdmin(admin.ModelAdmin):
    list_display = ("dataset", "validation_type", "status", "created_at")
    list_filter = ("validation_type", "status")
    search_fields = ("dataset__title", "dataset__uploader__email")
    readonly_fields = ("dataset", "validation_type", "status", "details_json", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(PHBoundary)
class PHBoundaryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at", "updated_at")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")
