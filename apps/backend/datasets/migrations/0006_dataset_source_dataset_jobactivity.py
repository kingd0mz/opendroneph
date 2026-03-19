import django.db.models.deletion
import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("datasets", "0005_remove_dataset_processor"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="dataset",
            name="source_dataset",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="derived_datasets",
                to="datasets.dataset",
            ),
        ),
        migrations.CreateModel(
            name="JobActivity",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("status", models.CharField(choices=[("active", "Active"), ("completed", "Completed")], max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("dataset", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="job_activities", to="datasets.dataset")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="job_activities", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name="jobactivity",
            index=models.Index(fields=["dataset", "status"], name="job_act_ds_status_idx"),
        ),
        migrations.AddConstraint(
            model_name="jobactivity",
            constraint=models.UniqueConstraint(fields=("dataset", "user"), name="job_activity_dataset_user_unique"),
        ),
    ]
