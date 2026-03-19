from django.urls import path
from rest_framework.routers import DefaultRouter

from datasets.views import DatasetViewSet, JobActivityView, JobCompleteView, JobListView, JobStartView

router = DefaultRouter()
router.register("datasets", DatasetViewSet, basename="dataset")

urlpatterns = [
    path("jobs/", JobListView.as_view(), name="job-list"),
    path("jobs/<uuid:dataset_id>/start/", JobStartView.as_view(), name="job-start"),
    path("jobs/<uuid:dataset_id>/complete/", JobCompleteView.as_view(), name="job-complete"),
    path("jobs/<uuid:dataset_id>/activity/", JobActivityView.as_view(), name="job-activity"),
] + router.urls
