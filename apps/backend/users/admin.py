from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from users.models import Organization, User


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "created_by", "member_count", "created_at")
    search_fields = ("name", "created_by__email")

    @admin.display(description="Members")
    def member_count(self, obj):
        return obj.members.count()


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = (
        "email",
        "display_username",
        "organization_name",
        "contribution_count_display",
        "is_email_verified",
        "is_staff",
        "is_superuser",
        "created_at",
    )
    search_fields = ("email",)
    readonly_fields = ("contribution_count_display", "created_at", "updated_at", "last_login", "date_joined")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Profile",
            {"fields": ("organization", "contribution_count_display", "is_email_verified", "created_at", "updated_at")},
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
                "fields": ("email", "organization", "password1", "password2", "is_email_verified", "is_staff", "is_superuser"),
            },
        ),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).with_contributions()

    @admin.display(description="Username")
    def display_username(self, obj):
        return obj.email.split("@", 1)[0]

    @admin.display(description="Contribution Count", ordering="contribution_count")
    def contribution_count_display(self, obj):
        return getattr(obj, "contribution_count", 0)
