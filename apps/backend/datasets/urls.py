from django.urls import path
from rest_framework.routers import DefaultRouter

from datasets.views import (
    AOIDatasetsView,
    AOIListView,
    DatasetFlagIgnoreView,
    DatasetViewSet,
    FlaggedDatasetListView,
    JobListView,
    MissionViewSet,
)

router = DefaultRouter()
router.register("datasets", DatasetViewSet, basename="dataset")
router.register("missions", MissionViewSet, basename="mission")

urlpatterns = [
    path("aois/", AOIListView.as_view(), name="aoi-list"),
    path("aois/<uuid:aoi_id>/datasets/", AOIDatasetsView.as_view(), name="aoi-datasets"),
    path("jobs/", JobListView.as_view(), name="job-list"),
    path("flags/", FlaggedDatasetListView.as_view(), name="flag-list"),
    path("flags/<uuid:flag_id>/ignore/", DatasetFlagIgnoreView.as_view(), name="flag-ignore"),
] + router.urls
