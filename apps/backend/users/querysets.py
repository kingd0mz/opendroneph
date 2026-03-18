from django.db import models
from django.db.models import Count, F, IntegerField, Q, Value
from django.db.models.functions import Coalesce

from datasets.models import DatasetStatus, DatasetType, ValidationStatus


class UserQuerySet(models.QuerySet):
    def with_contributions(self):
        raw_filter = Q(
            uploaded_datasets__type=DatasetType.RAW,
            uploaded_datasets__validation_status=ValidationStatus.VALID,
        ) & ~Q(uploaded_datasets__status__in=[DatasetStatus.HIDDEN, DatasetStatus.DELISTED])

        orthophoto_filter = Q(
            uploaded_datasets__type=DatasetType.ORTHOPHOTO,
            uploaded_datasets__status=DatasetStatus.PUBLISHED,
            uploaded_datasets__validation_status=ValidationStatus.VALID,
        )

        return self.annotate(
            raw_contribution_count=Coalesce(
                Count("uploaded_datasets", filter=raw_filter, distinct=True),
                Value(0),
                output_field=IntegerField(),
            ),
            orthophoto_contribution_count=Coalesce(
                Count("uploaded_datasets", filter=orthophoto_filter, distinct=True),
                Value(0),
                output_field=IntegerField(),
            ),
        ).annotate(
            contribution_count=F("raw_contribution_count") + F("orthophoto_contribution_count"),
        )
