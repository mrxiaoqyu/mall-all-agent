"""开发启动入口：psycopg（langgraph checkpointer）在 Windows 需要 SelectorEventLoop，
必须在 uvicorn 创建事件循环之前设置策略，故用脚本替代 python -m uvicorn。

用法: .\\.venv\\Scripts\\python.exe scripts\\run_server.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    # loop="none"：跳过 uvicorn 在 Windows 下强制 ProactorEventLoop 的行为（psycopg 需要 Selector）
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, loop="none")
