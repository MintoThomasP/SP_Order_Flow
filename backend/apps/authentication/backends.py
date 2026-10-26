import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed

logger = logging.getLogger(__name__)


class GracefulJWTAuthentication(JWTAuthentication):
    """
    JWT Authentication backend that gracefully falls back to AnonymousUser
    if the provided token is invalid or expired, instead of raising 401 on views
    that allow unauthenticated access (AllowAny).
    Views that require authentication (IsAuthenticated) will still reject AnonymousUser.
    """
    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, AuthenticationFailed) as exc:
            logger.info("Invalid or expired JWT token received: %s. Falling back to anonymous.", exc)
            return None
