from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


def migrate_user_organizations(apps, schema_editor):
    User = apps.get_model("users", "User")
    Organization = apps.get_model("users", "Organization")

    for organization_name in (
        User.objects.exclude(organization_name="")
        .values_list("organization_name", flat=True)
        .distinct()
    ):
        creator = User.objects.filter(organization_name=organization_name).order_by("date_joined", "created_at").first()
        organization = Organization.objects.create(
            name=organization_name,
            created_by=creator,
        )
        User.objects.filter(organization_name=organization_name).update(organization=organization)


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_user_organization_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=255, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_organizations",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="user",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="members",
                to="users.organization",
            ),
        ),
        migrations.RunPython(migrate_user_organizations, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="user",
            name="organization_name",
        ),
    ]
