import time
from collections import defaultdict
from fastapi import HTTPException, status

_attempts: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, max_attempts: int = 5, window_seconds: int = 300) -> None:
    now = time.monotonic()
    timestamps = [t for t in _attempts[key] if now - t < window_seconds]
    if len(timestamps) >= max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Aguarde antes de tentar novamente.",
        )
    timestamps.append(now)
    _attempts[key] = timestamps
