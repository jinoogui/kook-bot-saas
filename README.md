# Kook Bot SaaS 平台

多租户 Kook 机器人 SaaS 平台 — 用户提供自己的 Bot Token，平台自动部署独立 Bot 实例，功能以插件形式按需购买/启用。

## 架构概览

```
平台主进程 (:5000)
├── 平台 API（/api/auth, /api/tenants, /api/plugins, ...）
├── Webhook 反代 → 按 token 路由到对应实例端口
├── 实例管理器（fork/kill/restart 子进程）
├── 健康监控（30s 心跳检查，异常自动重启）
│
├── Bot 实例 A (:6001) — child_process fork
│   ├── KookApi(tokenA)
│   ├── 已加载插件: [points, welcome, filter]
│   └── Webhook 接收 /khl-wh
│
├── Bot 实例 B (:6002) — child_process fork
│   ├── KookApi(tokenB)
│   ├── 已加载插件: [points, levels, moderation]
│   └── ...
│
└── Bot 实例 C (:6003) — ...
```

## 技术栈

| 层级 | 技术 |
|------|------|
| **Runtime** | Node.js 20+ / TypeScript 5.4+ |
| **Monorepo** | pnpm workspace |
| **Backend** | Fastify 4 |
| **ORM** | drizzle-orm (MySQL) |
| **Cache** | ioredis (Redis) |
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **进程管理** | Node child_process.fork |
| **构建** | tsup / tsc |

## 项目结构

```
kook-bot-saas/
├── packages/
│   ├── shared/          # @kook-saas/shared — 共享类型 + 工具函数
│   ├── bot-engine/      # @kook-saas/bot-engine — 每租户一个进程的 Bot 引擎
│   ├── platform/        # @kook-saas/platform — 控制平面（API + 实例管理）
│   └── plugins/         # @kook-saas/plugins — 11 个功能插件
│
├── apps/
│   └── web/             # React 前端用户面板
│
├── scripts/
│   ├── seed-plugin-catalog.ts    # 初始化插件目录
│   └── migrate-from-killadbot.ts # 数据迁移脚本
│
├── docker-compose.yml
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## 插件列表

平台共包含 **11 个插件**，从 killadbot-node 单体应用提取重构为 SaaS 多租户架构：

### 免费插件

| 插件 | ID | 描述 |
|------|----|------|
| 欢迎系统 | `welcome` | 自动发送欢迎/欢送消息，支持 KMarkdown 和卡片模式 |
| 积分系统 | `points` | 签到、积分商店、宝箱、排行榜 |
| 内容过滤 | `content-filter` | AC 自动机多模式匹配，URL检测，违规记录 |
| 定时提醒 | `reminders` | 支持相对/绝对时间的提醒系统 |

### 付费插件

| 插件 | ID | 描述 |
|------|----|------|
| 语音积分 | `voice-points` | 语音频道挂机积分，5分钟周期结算（依赖 points） |
| 等级系统 | `levels` | 消息经验值、等级计算、升级通知 |
| 关键词回复 | `keyword-reply` | 精确/前缀/后缀/包含四种匹配的自动回复 |
| 管理工具 | `moderation` | 封禁、禁言、广告词管理 |
| 身份组领取 | `role-claim` | 按钮点击自助领取/取消身份组 |
| 活跃统计 | `statistics` | 消息统计、在线追踪、活跃排行榜 |
| 音频播放 | `audio-player` | FFmpeg RTP 推流到 Kook 语音频道 |

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 8
- MySQL 8.0
- Redis 7

### 安装

```bash
# 克隆仓库
git clone <repo-url> kook-bot-saas
cd kook-bot-saas

# 安装依赖
pnpm install

# 复制环境配置
cp .env.example .env
# 编辑 .env 填入数据库、Redis、JWT 等配置
```

### 使用 Docker Compose

```bash
# 启动 MySQL + Redis + 平台
docker-compose up -d
```

### 手动启动

```bash
# 1. 构建共享包
pnpm --filter @kook-saas/shared build

# 2. 数据库迁移
pnpm run db:generate
pnpm run db:migrate

# 3. 初始化插件目录
pnpm exec tsx scripts/seed-plugin-catalog.ts

# 4. 启动平台
pnpm run dev:platform

# 5. 启动前端（开发模式）
pnpm run dev:web
```

### 环境变量

```env
# 数据库
MYSQL_URL=mysql://root:password@localhost:3306/kook_saas_platform

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secure-jwt-secret-change-this

# 平台端口
PORT=5000

# Bot 实例端口范围起始
BOT_PORT_START=6001

# 租户数据库
TENANT_MYSQL_URL=mysql://root:password@localhost:3306/kook_saas_tenants
```

## 插件接口

每个插件实现 `IPlugin` 接口：

```typescript
interface IPlugin {
  readonly id: string          // 'points', 'welcome', etc.
  readonly name: string        // '积分系统'
  readonly version: string
  readonly category: PluginCategory
  readonly dependencies: string[]

  // 生命周期
  onLoad(ctx: PluginContext): Promise<void>
  onUnload(): Promise<void>

  // 注册
  getSchema(): Record<string, any>        // DB 表定义
  getCommands(): CommandDefinition[]       // 斜杠命令
  getEventHandlers(): EventHandlerDefinition[]  // 事件处理器
  getApiRoutes(): ApiRouteDefinition[]     // HTTP API
  getTimers(): TimerDefinition[]           // 定时任务
  getConfigSchema(): z.ZodObject<any>      // 配置 schema
  getService(): unknown                    // 对外暴露的服务
}
```

插件通过 `PluginContext` 获取租户隔离的资源：

```typescript
interface PluginContext {
  tenantId: string              // 当前租户 ID
  kookApi: KookApiClient        // 该租户 token 的 Kook API
  db: TenantDB                  // 带 tenantId 作用域的 DB
  redis: ScopedRedis            // key 自动加 tenant 前缀的 Redis
  logger: PluginLogger
  getPluginService: <T>(pluginId: string) => T | null
  getConfig: () => Promise<Record<string, any>>
  setConfig: (key: string, value: any) => Promise<void>
}
```

## 数据库设计

采用**双库策略**：

| 库 | 内容 |
|---|---|
| `kook_saas_platform` | 平台用户、租户、插件目录、订阅、支付 |
| `kook_saas_tenants` | 所有插件业务数据（每张表带 `tenant_id` 列隔离） |

插件表使用 `plugin_` 前缀 + 插件名避免冲突，例如：
- `plugin_points_user_points`
- `plugin_welcome_messages`
- `plugin_voice_online_records`

## API 端点

### 平台 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/tenants` | 租户列表 |
| POST | `/api/tenants` | 创建租户（填入 Bot Token） |
| POST | `/api/instances/:id/start` | 启动 Bot 实例 |
| POST | `/api/instances/:id/stop` | 停止实例 |
| POST | `/api/instances/:id/restart` | 重启实例 |
| GET | `/api/plugins` | 插件商店列表 |
| POST | `/api/subscriptions/:tenantId/subscribe` | 订阅插件 |
| GET | `/api/subscriptions/:tenantId` | 查看订阅 |

### 插件 API

每个插件的 API 挂载在 `/api/plugins/{pluginId}/` 下，由插件自行定义路由。

## 前端页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 登录 | `/login` | 邮箱密码登录 |
| 注册 | `/register` | 新用户注册 |
| Dashboard | `/dashboard` | Bot 实例概览、创建新 Bot |
| Bot 设置 | `/bot-setup` | 配置 Token、启停实例 |
| 插件商店 | `/plugins` | 浏览、搜索、订阅插件 |
| 插件配置 | `/plugins/:id/config` | 单个插件的启用/禁用和配置 |
| 我的订阅 | `/subscriptions` | 管理已订阅插件 |
| 实例监控 | `/monitoring` | 运行状态、端口、心跳、日志 |

## 开发指南

### 添加新插件

1. 在 `packages/plugins/src/` 下创建新目录
2. 实现以下文件：
   - `index.ts` — 插件主类（继承 `BasePlugin`）
   - `schema.ts` — Drizzle 表定义（加 `tenant_id` 列和 `plugin_` 前缀）
   - `service.ts` — 业务逻辑（构造函数接收 `PluginContext`）
   - `events.ts` — 事件处理器
   - `commands.ts` — 斜杠命令
   - `routes.ts` — API 路由
   - `configSchema.ts` — Zod 配置 schema
3. 在 `packages/plugins/src/index.ts` 中注册导出和 `getAllPlugins()`
4. 在 `scripts/seed-plugin-catalog.ts` 中添加插件元数据

### 构建

```bash
# 构建所有包
pnpm run build

# 类型检查
pnpm run lint
```

## 许可证

Private — 未经授权不得使用或分发。
