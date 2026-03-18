from django.contrib.auth import authenticate
from rest_framework import serializers

from users.services import user_display_name


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        request = self.context.get("request")
        user = authenticate(request=request, email=attrs["email"], password=attrs["password"])
        if user is None:
            raise serializers.ValidationError("Invalid email or password.")
        attrs["user"] = user
        return attrs


class UserProfileSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    username = serializers.SerializerMethodField()
    contribution_count = serializers.IntegerField(read_only=True)

    def get_username(self, obj):
        return user_display_name(obj)


class LeaderboardEntrySerializer(serializers.Serializer):
    user_id = serializers.UUIDField(source="id", read_only=True)
    username = serializers.SerializerMethodField()
    contribution_count = serializers.IntegerField(read_only=True)

    def get_username(self, obj):
        return user_display_name(obj)
