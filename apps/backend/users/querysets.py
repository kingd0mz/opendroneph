from django.db import models
from django.db.models import Count, IntegerField, Q, Value
from django.db.models.functions import Coalesce

from datasets.models import DatasetStatus, ValidationStatus


class UserQuerySet(models.QuerySet):
    def with_contributions(self):
        contribution_filter = Q(
            uploaded_datasets__status=DatasetStatus.PUBLISHED,
            uploaded_datasets__validation_status=ValidationStatus.VALID,
        )

        return self.annotate(
            contribution_count=Coalesce(
                Count("uploaded_datasets", filter=contribution_filter, distinct=True),
                Value(0),
                output_field=IntegerField(),
            ),
        )
