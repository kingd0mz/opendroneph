import django.db.models.deletion
import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("datasets", "0007_aoi_and_dataset_aoi"),
        ("users", "0002_user_organization_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="Mission",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("event_type", models.CharField(max_length=100)),
                ("status", models.CharField(choices=[("active", "Active"), ("closed", "Closed")], default="active", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("aoi", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="missions", to="datasets.aoi")),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_missions", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name="mission",
            index=models.Index(fields=["status"], name="mission_status_idx"),
        ),
        migrations.RenameField(
            model_name="dataset",
            old_name="source_dataset",
            new_name="job",
        ),
        migrations.AlterField(
            model_name="dataset",
            name="job",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="outputs",
                to="datasets.dataset",
            ),
        ),
        migrations.AddField(
            model_name="dataset",
            name="mission",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="datasets",
                to="datasets.mission",
            ),
        ),
        migrations.CreateModel(
            name="DatasetFlag",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("reason", models.TextField()),
                ("status", models.CharField(choices=[("pending", "Pending"), ("ignored", "Ignored")], default="pending", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="dataset_flags", to=settings.AUTH_USER_MODEL)),
                ("dataset", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="flags", to="datasets.dataset")),
            ],
        ),
        migrations.AddIndex(
            model_name="datasetflag",
            index=models.Index(fields=["status", "created_at"], name="dataset_flag_status_idx"),
        ),
        migrations.DeleteModel(
            name="JobActivity",
        ),
    ]
