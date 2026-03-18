from rest_framework.permissions import BasePermission


class IsVerifiedUser(BasePermission):
    message = "Verified account required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_email_verified)


class IsModerator(BasePermission):
    message = "Moderator access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff)
