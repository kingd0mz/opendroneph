from django.contrib.gis.geos import MultiPolygon, Polygon
import django.contrib.gis.db.models.fields
from django.db import migrations, models


def seed_ph_boundary(apps, schema_editor):
    PHBoundary = apps.get_model("datasets", "PHBoundary")
    if PHBoundary.objects.filter(name="philippines").exists():
        return

    # Minimal static Phase 1 boundary envelope covering the Philippine extent.
    polygon = Polygon(
        (
            (116.0, 4.0),
            (127.0, 4.0),
            (127.0, 21.5),
            (116.0, 21.5),
            (116.0, 4.0),
        ),
        srid=4326,
    )
    PHBoundary.objects.create(name="philippines", geometry=MultiPolygon(polygon, srid=4326))


class Migration(migrations.Migration):
    dependencies = [
        ("datasets", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PHBoundary",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(default="philippines", max_length=64, unique=True)),
                ("geometry", django.contrib.gis.db.models.fields.MultiPolygonField(srid=4326)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.RunPython(seed_ph_boundary, migrations.RunPython.noop),
    ]
