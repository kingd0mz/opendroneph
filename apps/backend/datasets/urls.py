from rest_framework.routers import DefaultRouter

from datasets.views import DatasetViewSet, RawAccessRequestViewSet

router = DefaultRouter()
router.register("datasets", DatasetViewSet, basename="dataset")
router.register("raw-access-requests", RawAccessRequestViewSet, basename="raw-access-request")

urlpatterns = router.urls
