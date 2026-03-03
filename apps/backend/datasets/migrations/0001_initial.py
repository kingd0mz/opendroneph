import uuid

import django.contrib.gis.db.models.fields
import django.contrib.postgres.indexes
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Dataset",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("footprint", django.contrib.gis.db.models.fields.MultiPolygonField(srid=4326)),
                ("type", models.CharField(choices=[("raw", "Raw"), ("orthophoto", "Orthophoto")], max_length=20)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("published", "Published"), ("hidden", "Hidden"), ("delisted", "Delisted")], default="draft", max_length=20)),
                ("validation_status", models.CharField(choices=[("pending", "Pending"), ("valid", "Valid"), ("invalid", "Invalid")], default="pending", max_length=20)),
                ("capture_date", models.DateField()),
                ("platform_type", models.CharField(choices=[("drone", "Drone"), ("fixed_wing", "Fixed Wing"), ("other", "Other")], max_length=20)),
                ("camera_model", models.CharField(max_length=255)),
                ("license_type", models.CharField(choices=[("cc_by", "CC BY 4.0"), ("cc_by_nc", "CC BY-NC 4.0")], max_length=20)),
                ("gsd_cm", models.FloatField(blank=True, null=True)),
                ("crs_epsg", models.IntegerField(blank=True, null=True)),
                ("processing_software", models.CharField(blank=True, max_length=255, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("hidden_at", models.DateTimeField(blank=True, null=True)),
                ("processor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="processed_datasets", to=settings.AUTH_USER_MODEL)),
                ("uploader", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="uploaded_datasets", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "indexes": [
                    django.contrib.postgres.indexes.GistIndex(fields=["footprint"], name="dataset_footprint_gix"),
                    models.Index(fields=["status"], name="dataset_status_idx"),
                    models.Index(fields=["validation_status"], name="dataset_valid_status_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ModerationAction",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("action_type", models.CharField(choices=[("flag", "Flag"), ("hide", "Hide"), ("reinstate", "Reinstate")], max_length=20)),
                ("reason", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="moderation_actions", to=settings.AUTH_USER_MODEL)),
                ("dataset", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="moderation_actions", to="datasets.dataset")),
            ],
        ),
        migrations.CreateModel(
            name="RawAccessRequest",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("reason", models.TextField()),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("denied", "Denied"), ("revoked", "Revoked")], default="pending", max_length=20)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("dataset", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="raw_access_requests", to="datasets.dataset")),
                ("requester", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="raw_access_requests", to=settings.AUTH_USER_MODEL)),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="reviewed_raw_access_requests", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(condition=models.Q(("status", "pending")), fields=("dataset", "requester"), name="uniq_pending_raw_access_request"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ValidationRecord",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("validation_type", models.CharField(choices=[("cog_strict", "COG Strict"), ("ph_boundary_intersection", "PH Boundary Intersection")], max_length=30)),
                ("status", models.CharField(choices=[("pass", "Pass"), ("fail", "Fail")], max_length=10)),
                ("details_json", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("dataset", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="validation_records", to="datasets.dataset")),
            ],
        ),
        migrations.CreateModel(
            name="DatasetAsset",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("asset_type", models.CharField(choices=[("raw_archive", "Raw Archive"), ("orthophoto_cog", "Orthophoto COG"), ("multispectral_archive", "Multispectral Archive")], max_length=30)),
                ("object_key", models.CharField(max_length=512)),
                ("content_type", models.CharField(max_length=255)),
                ("size_bytes", models.BigIntegerField()),
                ("checksum_sha256", models.CharField(max_length=64)),
                ("is_downloadable", models.BooleanField(default=True)),
                ("is_renderable_rgb", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("dataset", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assets", to="datasets.dataset")),
            ],
            options={
                "indexes": [
                    models.Index(fields=["dataset", "asset_type"], name="dataset_asset_type_idx"),
                ],
            },
        ),
    ]
