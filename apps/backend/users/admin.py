from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from users.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "display_username",
        "contribution_count",
        "is_email_verified",
        "is_staff",
        "is_superuser",
        "created_at",
    )
    search_fields = ("email",)
    readonly_fields = ("contribution_count", "created_at", "updated_at", "last_login", "date_joined")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Profile",
            {"fields": ("contribution_count", "is_email_verified", "created_at", "updated_at")},
        ),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "is_email_verified", "is_staff", "is_superuser"),
            },
        ),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).with_contributions()

    @admin.display(description="Username")
    def display_username(self, obj):
        return obj.email.split("@", 1)[0]
