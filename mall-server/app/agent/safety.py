"""输入/输出安全过滤与限流"""
import re
import time
from collections import defaultdict, deque

MAX_INPUT_LEN = 500
MAX_OUTPUT_LEN = 2000
RATE_LIMIT_PER_MINUTE = 20

# 提示词注入黑名单（命中即拒绝）
INJECTION_PATTERNS = [
    r"忽略(以上|之前|前面|所有)(的)?(指令|指示|命令|prompt)",
    r"ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)",
    r"system\s*prompt",
    r"你(现在)?是.{0,10}(管理员|root|系统)",
    r"越权|绕过(权限|校验|认证)",
    r"泄露|暴露.{0,6}(密钥|key|token|密码)",
    r"delete\s+from|drop\s+table|truncate\s+table",
]
_injection_re = re.compile("|".join(INJECTION_PATTERNS), re.IGNORECASE)

# 输出敏感词（简单示例，可按需扩展）
OUTPUT_BLOCKLIST = [r"sk-[a-z0-9]{10,}", r"system\s*prompt\s*[:：]", r"SILICONFLOW_API_KEY"]
_output_re = re.compile("|".join(OUTPUT_BLOCKLIST), re.IGNORECASE)

# 内存滑动窗口限流：user_id -> 时间戳队列
_rate_windows: dict[int, deque] = defaultdict(deque)


def check_input(text: str, user_id: int) -> str | None:
    """输入安全检查，返回拒绝原因；None 表示通过"""
    if not text.strip():
        return "消息不能为空"
    if len(text) > MAX_INPUT_LEN:
        return f"消息过长（上限 {MAX_INPUT_LEN} 字），请精简后再发"
    if _injection_re.search(text):
        return "消息包含不安全内容，已被拦截"
    now = time.time()
    window = _rate_windows[user_id]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= RATE_LIMIT_PER_MINUTE:
        return "发送太频繁，请稍后再试"
    window.append(now)
    return None


def filter_output(text: str) -> str:
    """输出过滤：敏感信息打码 + 长度截断"""
    text = _output_re.sub("[已隐藏]", text)
    if len(text) > MAX_OUTPUT_LEN:
        text = text[:MAX_OUTPUT_LEN] + "…"
    return text
