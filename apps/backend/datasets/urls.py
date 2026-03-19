from django.urls import path
from rest_framework.routers import DefaultRouter

from datasets.views import DatasetViewSet, MyDatasetListView, RawAccessRequestViewSet

router = DefaultRouter()
router.register("datasets", DatasetViewSet, basename="dataset")
router.register("raw-access-requests", RawAccessRequestViewSet, basename="raw-access-request")

urlpatterns = [
    path("my-datasets/", MyDatasetListView.as_view(), name="my-dataset-list"),
] + router.urls
