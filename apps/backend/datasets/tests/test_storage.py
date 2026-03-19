import pytest

from datasets.services.storage import generate_dataset_asset_download_url


@pytest.mark.django_db
def test_generate_dataset_asset_download_url_uses_public_endpoint(settings, monkeypatch):
    settings.AWS_STORAGE_BUCKET_NAME = "datasets"
    settings.AWS_S3_PUBLIC_ENDPOINT_URL = "http://localhost:9000"

    class FakeClient:
        def generate_presigned_url(self, operation_name, Params, ExpiresIn):
            assert operation_name == "get_object"
            assert Params == {
                "Bucket": "datasets",
                "Key": "datasets/test/file.tif",
            }
            assert ExpiresIn == 3600
            return "http://minio:9000/datasets/datasets/test/file.tif?AWSAccessKeyId=minio&Signature=abc&Expires=123"

    monkeypatch.setattr("datasets.services.storage.get_object_storage_client", lambda: FakeClient())

    download_url = generate_dataset_asset_download_url(object_key="datasets/test/file.tif")

    assert download_url == "http://localhost:9000/datasets/datasets/test/file.tif?AWSAccessKeyId=minio&Signature=abc&Expires=123"
