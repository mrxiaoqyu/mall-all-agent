"""LLM 工厂 + 熔断器"""
import time
from collections import deque

from langchain_openai import ChatOpenAI

from app.core.config import settings

_llm: ChatOpenAI | None = None


def get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            model=settings.AI_MODEL,
            api_key=settings.SILICONFLOW_API_KEY,
            base_url=settings.SILICONFLOW_BASE_URL,
            streaming=True,
            timeout=settings.AI_TIMEOUT,
            max_retries=settings.AI_MAX_RETRIES,
            temperature=0.1,
        )
    return _llm


class CircuitBreaker:
    """内存熔断：1 分钟内失败 >= threshold 次 → 打开；cooldown 秒后半开允许一次试探"""

    def __init__(self, threshold: int = 5, window: int = 60, cooldown: int = 60):
        self.threshold = threshold
        self.window = window
        self.cooldown = cooldown
        self._failures: deque[float] = deque()
        self._opened_at: float | None = None

    def is_open(self) -> bool:
        if self._opened_at is None:
            return False
        # 冷却结束 → 半开，放行一次试探
        if time.time() - self._opened_at >= self.cooldown:
            return False
        return True

    def record_success(self):
        self._failures.clear()
        self._opened_at = None

    def record_failure(self):
        now = time.time()
        while self._failures and now - self._failures[0] > self.window:
            self._failures.popleft()
        self._failures.append(now)
        if len(self._failures) >= self.threshold:
            self._opened_at = now


breaker = CircuitBreaker()
