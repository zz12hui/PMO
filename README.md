# PMO 项目管理看板

> 企业级项目管理工具，支持多项目、甘特图、知识库、多账号数据隔离。
> 纯前端实现，零后端依赖，扔进 nginx 就能用。

## 快速开始

### 部署
```bash
cp -r PMO/ /var/www/html/
# 访问 http://your-server/PMO/
```

### 首次使用
1. 打开页面，自动进入**管理员初始化向导**，创建第一个管理员账号
2. 管理员登录后进入管理后台，手动创建其他用户账号
3. 普通用户登录后直接进入看板，开始项目管理
4. 在任务表格中直接编辑，`Ctrl+S` 导出含甘特图的 Excel 报表

---

## 功能列表

| 功能 | 说明 |
|------|------|
| 📋 多项目管理 | 创建/切换/删除项目 |
| 📂 阶段管理 | 每个项目多阶段，自动编号 |
| 🌲 任务层级 | 4 级树形结构，折叠/展开 |
| 🔗 前置依赖 | 任务间 ID 依赖，自动排期 |
| 📊 甘特图 | 表格/甘特图一键切换 |
| 📥 Excel 导出 | 含任务表 + 甘特图双 Sheet |
| 📚 知识库 | 分类管理文件/链接（IndexedDB 存储） |
| 👥 账号系统 | 多用户数据隔离 + 配额管理 |
| 🛡️ 管理后台 | 账号管理 / 系统配置 / 配额管理 |
| 🔐 安全认证 | SHA-256 加盐 + 登录锁定 + 自主改密 |

---

## 项目结构

```
PMO/
├── index.html           # 主看板（认证守卫 + 数据隔离 + 配额显示）
├── login.html           # 登录页（首次管理员初始化向导）
├── admin/
│   └── index.html       # 管理后台（账号管理 / 系统配置 / 配额管理）
├── js/
│   ├── auth.js          # 认证层（登录/改密/锁定/加盐哈希）
│   ├── db-core.js       # IndexedDB 封装（put/get/count/sum）
│   └── config.js        # 配置读写（三级优先级：覆盖 > 系统 > 兜底）
├── CLAUDE.md            # AI 编程助手指南
├── README.md            # 本文件
├── PLAN.md              # 账号系统技术方案
└── PLAN-v2.md           # 管理员配置系统技术方案
```

---

## 安全架构

| 层面 | 措施 |
|------|------|
| 🔐 密码存储 | SHA-256 + 固定盐（`hashVersion: 1`） |
| 🔄 平滑迁移 | 旧版无盐密码自动升级，用户无感知 |
| 🚫 暴力防护 | 5 次失败 → 15 分钟锁定（localStorage 跨标签） |
| 🛡️ 会话管理 | sessionStorage + 24 小时过期 |
| 👤 访问控制 | role 校验（admin/user）+ 双 guard |
| 📦 数据隔离 | accountId 索引过滤所有查询 |
| 🔏 API 鉴权 | 每个写操作校验 session.role |
| 🔑 自主改密 | 用户可自行修改密码 |
| 🚷 防自删 | 管理员不可删除自己 |

---

## 配置系统

管理员可在后台调整以下系统参数（或按账号覆盖）：

| 参数 | 默认值 |
|------|--------|
| 知识库配额 | 100 MB/账号 |
| 项目数量上限 | 10 个/账号 |
| 会话有效期 | 24 小时 |
| 最大上传文件 | 50 MB |
| 密码最小长度 | 6 位 |
| 最大任务层级 | 4 级 |

配额优先级：**单账号覆盖值 > 系统默认值 > 代码兜底值**

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 纯 HTML/CSS/JS（零框架） |
| 数据库 | IndexedDB（pm_auth + pm_data + pm_config） |
| 认证 | Web Crypto API SHA-256 + sessionStorage |
| 导出 | SheetJS (xlsx 0.20.1) |
| 部署 | 任意 HTTP 服务器 |

---

## 数据模型

```
accounts[]  → { id, username, displayName, passwordHash, hashVersion, role, kbQuotaMB?, projectQuota?, createdAt, lastLogin }
projects[]  → { id, accountId, name, desc }
phases[]    → { id, accountId, projectId, name, start, end }
tasks[]     → { id, accountId, phaseId, seq, name, dur, start, planEnd, actualEnd, predIds, note, status, lv, parentId }
kb_files[]  → { id, accountId, category, name, type, size, addedAt, data(Blob) }
```

---

## 浏览器兼容

Chrome 80+ / Firefox 80+ / Edge 80+ / Safari 14+
（需 Web Crypto API + IndexedDB 支持）

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-06-22 | 初始版本：单页看板 + 甘特图 + 知识库 |
| v0.2 | 2026-06-22 | P0 修复：知识库改 IndexedDB + 依赖改 ID 匹配 + 模板任务常量化 |
| v0.3 | 2026-06-22 | 账号系统：多用户数据隔离、管理后台、配额管理、后台配置中心 |
| v1.0 | 2026-06-22 | 安全加固：密码加盐、登录锁定、用户自主改密、登录分流 |
