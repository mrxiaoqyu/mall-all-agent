from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mall"
    JWT_SECRET: str = "mall-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174"
    SILICONFLOW_API_KEY: str = ""
    SILICONFLOW_BASE_URL: str = "https://api.siliconflow.cn/v1"
    AI_MODEL: str = "Qwen/Qwen3.5-35B-A3B"
    AI_TIMEOUT: int = 30
    AI_MAX_RETRIES: int = 2

    # 智能客服记忆与压缩
    AI_SHORT_TERM_WINDOW: int = 20         # 短期记忆窗口：保留最近 N 条消息
    AI_SUMMARY_THRESHOLD: int = 30         # 摘要触发阈值：消息数超过 N 时触发摘要
    AI_LONG_TERM_MEMORY_LIMIT: int = 10    # 注入 system prompt 的长期记忆最大条数
    AI_MEMORY_EXTRACT_ENABLED: bool = True  # 是否在会话结束时自动提取长期记忆

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def checkpoint_dsn(self) -> str:
        # langgraph checkpointer 使用 psycopg，需要 postgresql:// 形式的 DSN
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


settings = Settings()
