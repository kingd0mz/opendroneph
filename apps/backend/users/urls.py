from django.urls import path

from users.views import (
    LeaderboardView,
    LoginView,
    LogoutView,
    MeView,
    UserMeProfileView,
    UserProfileView,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("users/me/", UserMeProfileView.as_view(), name="user-me"),
    path("users/<uuid:user_id>/", UserProfileView.as_view(), name="user-profile"),
    path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
]
