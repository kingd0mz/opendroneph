from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("datasets", "0003_downloadevent"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="dataset",
            name="hidden_at",
        ),
        migrations.AlterField(
            model_name="dataset",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("published", "Published"),
                    ("delisted", "Delisted"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
        migrations.DeleteModel(
            name="ModerationAction",
        ),
        migrations.DeleteModel(
            name="RawAccessRequest",
        ),
    ]
