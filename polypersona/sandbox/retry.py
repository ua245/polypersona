import asyncio
import logging
import random
from collections.abc import Awaitable, Callable

import modal.exception as me

log = logging.getLogger(__name__)

TRANSIENT_ERRORS: tuple[type[BaseException], ...] = (
    me.ConnectionError,
    me.InternalError,
    me.ServiceError,
    me.ResourceExhaustedError,
    ConnectionError,
)


async def with_retry[T](
    op: Callable[[], Awaitable[T]],
    *,
    what: str,
    attempts: int = 3,
    base_delay_s: float = 1.0,
    max_delay_s: float = 10.0,
) -> T:
    """Retry an idempotent async operation on transient Modal/network errors."""
    for attempt in range(1, attempts + 1):
        try:
            return await op()
        except TRANSIENT_ERRORS as exc:
            if attempt == attempts:
                raise
            delay = min(max_delay_s, base_delay_s * 2 ** (attempt - 1)) * (0.5 + random.random())
            log.warning("%s failed (%r), retry %d/%d in %.1fs", what, exc, attempt, attempts - 1, delay)
            await asyncio.sleep(delay)
    raise AssertionError("unreachable")
