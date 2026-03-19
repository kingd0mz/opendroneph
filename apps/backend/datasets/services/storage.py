from __future__ import annotations

import boto3
from django.conf import settings
from urllib.parse import urlsplit, urlunsplit


def get_object_storage_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
    )


def upload_dataset_asset(*, file_obj, object_key: str, content_type: str) -> None:
    client = get_object_storage_client()
    client.upload_fileobj(
        file_obj,
        settings.AWS_STORAGE_BUCKET_NAME,
        object_key,
        ExtraArgs={"ContentType": content_type},
    )


def generate_dataset_asset_download_url(*, object_key: str, expires_in: int = 3600) -> str:
    client = get_object_storage_client()
    presigned_url = client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.AWS_STORAGE_BUCKET_NAME,
            "Key": object_key,
        },
        ExpiresIn=expires_in,
    )
    public_endpoint = settings.AWS_S3_PUBLIC_ENDPOINT_URL

    if not public_endpoint:
        return presigned_url

    presigned_parts = urlsplit(presigned_url)
    public_parts = urlsplit(public_endpoint)

    if not public_parts.scheme or not public_parts.netloc:
        return presigned_url

    return urlunsplit(
        (
            public_parts.scheme,
            public_parts.netloc,
            presigned_parts.path,
            presigned_parts.query,
            presigned_parts.fragment,
        )
    )
