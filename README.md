# 多商家商城系统

基于 React 19 + Ant Design 与 FastAPI 的多商家（Multi-vendor）商城系统，包含用户端商城、平台/商家双角色后台和后端服务，内置 AI 智能客服。

## 项目结构

```
ownagent/
├── mall-server/   # 后端：FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL + Alembic，端口 8000
├── mall-web/      # 用户端商城：React 19 + Vite + TS + AntD + zustand，端口 5173
└── mall-admin/    # 管理后台：平台管理员 + 商家双角色，端口 5174
```

## 核心功能

- **多商家模式**：商家独立账号登录后台，仅管理本店数据（shop_id 强制过滤）；平台管理员负责店铺审核（pending → approved/rejected）、全局分类维护与监管
- **用户端**：商品浏览/搜索、购物车、下单（按店铺拆单、共享 batch_no、模拟整批支付）、优惠券（仅抵扣应付最高的一张订单）、订单管理、收货地址、双通道客服
- **客服系统**：平台客服（admin）+ 店铺客服（merchant）双通道 WebSocket 即时通讯
- **AI 智能客服**：基于 SiliconFlow 大模型的智能回复，支持短期记忆窗口、会话摘要压缩与长期记忆提取（langgraph checkpointer 持久化）
- **安全**：JWT 认证（含 role 与 shop_id claim）、bcrypt 密码加密、条件更新扣库存防超卖

## 环境要求

- Python 3.11+
- Node.js 20+
- PostgreSQL 11+

## 快速开始

### 1. 初始化数据库

创建 PostgreSQL 数据库 `mall`，然后配置 `mall-server/.env`：

```env
DATABASE_URL=postgresql+asyncpg://postgres:<密码>@localhost:5432/mall
JWT_SECRET=<你的密钥>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
SILICONFLOW_API_KEY=<SiliconFlow API Key，用于 AI 客服>
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
AI_MODEL=Qwen/Qwen3.5-35B-A3B
```

### 2. 启动后端

```powershell
cd mall-server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 初始化表结构并写入种子数据
.\.venv\Scripts\python.exe scripts\init_db.py
.\.venv\Scripts\python.exe scripts\seed.py

# 启动服务（注意：必须用 run_server.py，不能直接 python -m uvicorn）
.\.venv\Scripts\python.exe scripts\run_server.py
```

> Windows 下 uvicorn 强制 ProactorEventLoop，而 psycopg/langgraph checkpointer 需要 Selector，`scripts/run_server.py` 已处理事件循环配置。

### 3. 启动前端

```powershell
# 用户端（端口 5173）
cd mall-web
npm install
npm run dev

# 管理后台（端口 5174）
cd mall-admin
npm install
npm run dev
```

## 演示账号

| 角色 | 账号 | 密码 | 说明 |
|------|------|------|------|
| 平台管理员 | admin | admin123 | 店铺审核、分类、全局监管 |
| 商家 | merchant1 / merchant2 / merchant3 | 123456 | 对应 3 家已审核店铺 |
| 用户 | user1 | 123456 | 用户端商城 |

## 冒烟测试脚本

```powershell
cd mall-server
.\.venv\Scripts\python.exe scripts\smoke_test.py      # REST 接口冒烟
.\.venv\Scripts\python.exe scripts\ws_smoke_test.py   # WebSocket 客服冒烟
.\.venv\Scripts\python.exe scripts\ai_smoke_test.py   # AI 客服冒烟
```

## 技术栈

| 端 | 技术 |
|----|------|
| 后端 | FastAPI、SQLAlchemy 2.0 (async)、PostgreSQL、Alembic、WebSocket、langgraph、SiliconFlow |
| 用户端 | React 19、Vite、TypeScript、Ant Design 5、zustand、axios、react-router 7 |
| 管理后台 | React 19、Vite、TypeScript、Ant Design、zustand、oxlint |
