from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("datasets", "0004_remove_access_request_and_hidden_state"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="dataset",
            name="processor",
        ),
    ]
