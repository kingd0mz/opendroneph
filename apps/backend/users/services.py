from users.models import User


def user_display_name(user: User) -> str:
    return user.email.split("@", 1)[0]
