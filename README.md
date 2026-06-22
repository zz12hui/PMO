# 📋 PMO — 项目管理看板-小型团队免费开源便捷看板

<p align="center">
  <strong>纯前端 · 零依赖 · 多账号 · 开箱即用</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/framework-none-lightgrey" alt="no framework">
  <img src="https://img.shields.io/badge/backend-none-lightgrey" alt="no backend">
  <img src="https://img.shields.io/badge/deploy-nginx%20%7C%20apache%20%7C%20python-orange" alt="deploy">
</p>
---


## 文档导航

| 文档 | 适合谁 |
|------|--------|
| [README.md](./README.md) | 所有人（项目介绍） |
| [USER_MANUAL.md](./USER_MANUAL.md) | 所有用户（日常操作） |
| [SOP.md](./SOP.md) | 管理员 + 项目经理（规范操作） |
| [DEPLOY.md](./DEPLOY.md) | 运维 / 部署人员 |
| [CLAUDE.md](./CLAUDE.md) | AI 编程助手 |

---

## 这是什么

**PMO** 是一个在浏览器里就能用的项目管理工具。不需要装数据库、不需要配后端、不需要 Node.js——**一个 HTML 文件扔进 Nginx 就能跑**。

但它不简陋：多账号隔离、甘特图、知识库、Excel 导出、后台管理、登录锁定——该有的全有。

> 🎯 **一句话：给团队一个极简、安全、不用运维的项目看板。**

---

## 为什么选它

| 对比维度 | PMO | Jira / 飞书多维表格 | Trello | Excel 共享 |
|----------|-----|---------------------|--------|------------|
| 部署难度 | 复制粘贴 | 需要服务器/付费 | 需要网络 | 几乎为零 |
| 账号隔离 | ✅ IndexedDB 原生 | ✅ | ✅ | ❌ |
| 离线可用 | ✅ 完全离线 | ❌ | ❌ | ✅ |
| 甘特图 | ✅ 内置 | 需插件/付费 | 需插件 | 手动绘制 |
| 学习成本 | 5 分钟 | 高 | 低 | 极低 |
| 数据导出 | Excel+甘特图 | 有限 | 有限 | 原生 |
| 权限管理 | 管理员+用户 | 丰富 | 有限 | ❌ |
| 价格 | 免费开源 | 贵 | Freemium | 免费 |

**核心理念：** 不需要为一个小团队的项目管理去折腾 Jira 那一套。扔个 HTML 到 Nginx，三分钟全团队上线。

---

## 功能一览

### 📋 项目 & 任务

- **多项目切换** — 左侧项目列表，一键切换
- **4 级任务树** — 父任务/子任务折叠展开，自动编号
- **阶段管理** — 每个项目多阶段，甘特图按阶段着色
- **前置依赖** — 基于 ID 的依赖关系，自动顺延排期
- **批量操作** — 勾选多任务，一键改状态/日期

### 📊 甘特图

- 表格 / 甘特图 **一键切换**（`Ctrl+G`）
- 按天展开时间线，完工🟢 · 进行中🔵 · 延期🔴 · 未开始⚪
- 鼠标悬停查看任务详情

### 📥 Excel 导出

- 导出 **双 Sheet**：任务清单 + 甘特图
- 甘特图按月日着色，可直接用于汇报
- 依赖 SheetJS，一键下载 `项目名_日期.xlsx`

### 📚 知识库

- 按分类管理项目文件（上传）和链接
- 文件存入 IndexedDB，不依赖后端存储
- 配额管控：单文件 ≤50MB，总容量可配置

### 👥 账号系统

- **管理员初始化向导** — 首次访问自动引导创建管理员
- **管理后台** — 账号管理 / 系统配置 / 配额管理 三个面板
- **数据隔离** — 每个用户只能看到自己的项目数据
- **登录分流** — 管理员→后台，用户→看板
- **配置中心** — 7 项系统参数后台可调，支持单账号覆盖

### 🔐 安全

- 密码 **SHA-256 + 固定盐** 存储（`hashVersion` 支持平滑升级）
- 连续 5 次错误 → **锁定 15 分钟**
- 会话 24 小时过期（可配）
- 用户可**自行修改密码**
- 管理员不可删除自己

---

## 五分钟上手

```bash
# 1. 部署（选其一）
cp -r PMO/ /var/www/html/          # Nginx / Apache
python3 -m http.server 8080        # 本地开发

# 2. 打开浏览器
http://your-server:8080/

# 3. 首次访问 → 创建管理员账号
# 4. 管理员登录 → 管理后台 → 创建用户
# 5. 用户登录 → 开始项目管理
```

👉 详细文档：[USER_MANUAL.md](./USER_MANUAL.md) | [SOP.md](./SOP.md) | [DEPLOY.md](./DEPLOY.md)

---

## 架构设计

```
┌──────────────────────────────────────────────────┐
│                    浏览器                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ index.html│  │  admin/  │  │   login.html  │  │
│  │  主看板   │  │ 管理后台  │  │   登录/初始化  │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │             │               │           │
│  ┌────┴─────────────┴───────────────┴───────┐   │
│  │              js/ 模块层                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────┐  │   │
│  │  │ auth.js  │ │db-core.js│ │config.js│  │   │
│  │  │ 认证+锁定 │ │IndexedDB │ │配置读写  │  │   │
│  │  └──────────┘ └──────────┘ └─────────┘  │   │
│  └────────────────────┬────────────────────┘   │
│                       │                         │
│  ┌────────────────────┴────────────────────┐   │
│  │           IndexedDB (3 数据库)           │   │
│  │  pm_auth (账号) + pm_data (业务)         │   │
│  │  + pm_config (配置)                      │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │         sessionStorage + localStorage     │  │
│  │         会话管理 + 登录锁定状态           │  │
│  └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
       静态文件托管：Nginx / Apache / Python HTTP Server
       零后端依赖 · 零数据库 · 零 Node.js
```

---

## 项目结构

```
PMO/
├── index.html              # 主看板（认证守卫 + 数据隔离 + 2,289 行）
├── login.html              # 登录页（首次管理员初始化向导）
├── admin/
│   └── index.html           # 管理后台（账号 / 配置 / 配额 三 Tab）
├── js/
│   ├── auth.js              # 认证核心（14 个公开 API）
│   ├── db-core.js           # IndexedDB 封装（getAll/put/count/sum）
│   └── config.js            # 配置读写（三级优先级合并）
├── assets/                  # [离线部署] SheetJS 本地化
├── README.md                # 项目介绍（你在这里）
├── USER_MANUAL.md           # 用户使用手册
├── SOP.md                   # 标准操作流程（21 个子流程）
├── DEPLOY.md                # 完整部署文档
├── CLAUDE.md                # AI 编程助手指南
├── PLAN.md                  # 账号系统技术方案
└── PLAN-v2.md               # 管理员配置系统技术方案
```

---

## 技术栈

| 层 | 选型 | 备注 |
|----|------|------|
| 框架 | **无** | 纯 HTML/CSS/JS，gzip 后 < 50KB |
| 数据库 | **IndexedDB** | 3 个数据库，6 个 ObjectStore |
| 认证 | **Web Crypto API** | SHA-256 加盐，0 外部依赖 |
| 会话 | **sessionStorage** | 关闭标签即登出 |
| 锁定 | **localStorage** | 跨标签页生效 |
| 导出 | **SheetJS** (xlsx) | 唯一外部依赖，支持离线本地化 |
| 部署 | **任意 HTTP 服务器** | Nginx / Apache / Python http.server |

---

## 配置参数

管理员在后台「⚙️ 系统配置」可调：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `defaultKbQuotaMB` | 100 | 每账号知识库上限 |
| `defaultProjectQuota` | 10 | 每账号项目数上限 |
| `sessionExpireHours` | 24 | 登录会话有效期 |
| `maxFileSizeMB` | 50 | 知识库单文件上限 |
| `minPasswordLength` | 6 | 密码最小长度 |
| `maxTaskDepth` | 4 | 任务树最大层级 |
| `showDemoOnFirstLogin` | true | 新账号是否加载示例数据 |

**配额优先级：** 单账号覆盖 > 系统默认 > 代码兜底

---

## 浏览器兼容

| Chrome | Firefox | Edge | Safari |
|--------|---------|------|--------|
| 80+ ✅ | 80+ ✅ | 80+ ✅ | 14+ ✅ |

需要 Web Crypto API + IndexedDB（主流浏览器均支持）。

---

## 版本

| 版本 | 日期 | 里程碑 |
|------|------|--------|
| v0.1 | 2026-06-22 | 单页看板 + 甘特图 + 知识库 |
| v0.2 | 2026-06-22 | 知识库迁 IndexedDB / 依赖改 ID 匹配 / 模板常量化 |
| v0.3 | 2026-06-22 | 账号系统 + 管理后台 + 配额 + 配置中心 |
| **v1.0** | **2026-06-22** | **密码加盐 / 登录锁定 / 自主改密 / 登录分流** |

---

## 许可证

MIT License — 随便用，随便改。

---

## 作者微信，
创作交流请加备注github
#### 支持定制项目可按需求
<img width="566" height="540" alt="image" src="https://github.com/user-attachments/assets/dd67ac0b-a751-46a8-b762-d71715faa049" />

