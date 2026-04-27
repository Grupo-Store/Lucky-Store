from fastapi import HTTPException, status


class OrderlyHubException(Exception):
    """Base exception for Orderly Hub."""
    pass


class AuthenticationException(OrderlyHubException):
    """Authentication error."""
    
    def __init__(self, detail: str = "Invalid credentials"):
        self.detail = detail
        self.status_code = status.HTTP_401_UNAUTHORIZED


class AuthorizationException(OrderlyHubException):
    """Authorization error."""
    
    def __init__(self, detail: str = "Insufficient permissions"):
        self.detail = detail
        self.status_code = status.HTTP_403_FORBIDDEN


class NotFoundException(OrderlyHubException):
    """Resource not found."""
    
    def __init__(self, detail: str = "Resource not found"):
        self.detail = detail
        self.status_code = status.HTTP_404_NOT_FOUND


class ValidationException(OrderlyHubException):
    """Validation error."""
    
    def __init__(self, detail: str = "Validation failed"):
        self.detail = detail
        self.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY


class BusinessLogicException(OrderlyHubException):
    """Business logic violation."""
    
    def __init__(self, detail: str = "Business logic violation"):
        self.detail = detail
        self.status_code = status.HTTP_400_BAD_REQUEST


def to_http_exception(exc: OrderlyHubException) -> HTTPException:
    """Convert OrderlyHubException to HTTPException."""
    return HTTPException(
        status_code=exc.status_code,
        detail=exc.detail
    )
