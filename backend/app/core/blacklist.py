# In-memory token blacklist. Cleared on server restart — acceptable for this project.
# Production: replace with Redis (SET with TTL matching token expiry).
_blacklisted: set[str] = set()


def blacklist_token(token: str) -> None:
    _blacklisted.add(token)


def is_blacklisted(token: str) -> bool:
    return token in _blacklisted
