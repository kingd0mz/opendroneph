from django.db import models
from django.db.models import Count, F, IntegerField, Q, Value
from django.db.models.functions import Coalesce

from datasets.models import DatasetStatus, DatasetType, ValidationStatus


class UserQuerySet(models.QuerySet):
    def with_contributions(self):
        published_valid = Q(
            uploaded_datasets__status=DatasetStatus.PUBLISHED,
            uploaded_datasets__validation_status=ValidationStatus.VALID,
        )
        raw_filter = published_valid & Q(uploaded_datasets__type=DatasetType.RAW)
        ortho_filter = published_valid & Q(uploaded_datasets__type=DatasetType.ORTHOPHOTO)
        completed_jobs_filter = Q(
            uploaded_datasets__type=DatasetType.ORTHOPHOTO,
            uploaded_datasets__status=DatasetStatus.PUBLISHED,
            uploaded_datasets__validation_status=ValidationStatus.VALID,
            uploaded_datasets__job__isnull=False,
            uploaded_datasets__job__type=DatasetType.RAW,
            uploaded_datasets__job__status=DatasetStatus.PUBLISHED,
            uploaded_datasets__job__validation_status=ValidationStatus.VALID,
        )

        return self.annotate(
            raw_uploads_count=Coalesce(
                Count("uploaded_datasets", filter=raw_filter, distinct=True),
                Value(0),
                output_field=IntegerField(),
            ),
            ortho_uploads_count=Coalesce(
                Count("uploaded_datasets", filter=ortho_filter, distinct=True),
                Value(0),
                output_field=IntegerField(),
            ),
            jobs_completed_count=Coalesce(
                Count("uploaded_datasets__job", filter=completed_jobs_filter, distinct=True),
                Value(0),
                output_field=IntegerField(),
            ),
        ).annotate(
            contribution_count=F("raw_uploads_count") + F("ortho_uploads_count") + F("jobs_completed_count"),
        )
