import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from users.models import User


@pytest.mark.django_db
def test_login_creates_session():
    user = User.objects.create_user(
        email="user@example.com",
        password="testpass123",
        is_email_verified=True,
    )
    client = APIClient(enforce_csrf_checks=False)

    response = client.post(
        reverse("auth-login"),
        {"email": user.email, "password": "testpass123"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == user.email


@pytest.mark.django_db
def test_me_requires_authenticated_session():
    client = APIClient()

    response = client.get(reverse("auth-me"))

    assert response.status_code == status.HTTP_403_FORBIDDEN
