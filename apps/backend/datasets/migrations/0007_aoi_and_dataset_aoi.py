import django.contrib.gis.db.models.fields
import django.db.models.deletion
import uuid

from django.contrib.postgres.indexes import GistIndex
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("datasets", "0006_dataset_source_dataset_jobactivity"),
    ]

    operations = [
        migrations.CreateModel(
            name="AOI",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("geometry", django.contrib.gis.db.models.fields.MultiPolygonField(srid=4326, spatial_index=True)),
                ("purpose", models.CharField(choices=[("disaster", "Disaster Response"), ("landcover", "Land Cover Validation"), ("benthic", "Benthic Habitat Mapping")], max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.AddIndex(
            model_name="aoi",
            index=models.Index(fields=["is_active"], name="aoi_is_active_idx"),
        ),
        migrations.AddIndex(
            model_name="aoi",
            index=GistIndex(fields=["geometry"], name="aoi_geometry_gix"),
        ),
        migrations.AddField(
            model_name="dataset",
            name="aoi",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="datasets", to="datasets.aoi"),
        ),
    ]
