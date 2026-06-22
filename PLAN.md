# PMO 账号管理系统 — 技术方案

## 一、需求摘要

| 需求 | 说明 |
|------|------|
| 登录管理 | 账号密码登录，会话保持（sessionStorage） |
| 管理后台 | `pmo/admin/` 账号 CRUD 面板 |
| 数据隔离 | 每个账号独立数据集（项目/阶段/任务/知识库） |
| KB 配额 | 每账号最大 100MB（IndexedDB 计费） |
| 项目配额 | 每账号最多 10 个项目 |
| Excel 甘特图 | 导出报表含第二 Sheet「甘特图」，用着色单元格绘制任务条 |
| 离线可用 | 零外网依赖（符合内网部署约束） |

---

## 二、架构决策

### 为什么不引入后端

- 当前项目是纯静态单页，目标用户 ≤20 人小团队
- 引入后端（FastAPI/Django）会失去「扔进 nginx 就能用」的便利性
- IndexedDB 可满足 100MB/账号 的存储需求
- 密码用 SHA-256 客户端哈希，虽非银行级安全，但对内网小团队够用

### 渐进式演进路径

```
Phase 1（本次）：纯前端认证 + 数据隔离
Phase 2（未来）：FastAPI + SQLite 后端，JWT 令牌
Phase 3（未来）：LDAP/企业微信 SSO 对接
```

---

## 三、文件结构

```
/tmp/ai-tutorial/PMO/
├── index.html           # 主看板（需登录，未登录跳转 login.html）
├── login.html           # 登录/注册/修改密码 页面
├── admin/
│   └── index.html       # 管理员后台：账号CRUD + 配额查看
├── js/
│   ├── auth.js          # 认证层：登录/登出/会话/sessionStorage
│   ├── db-core.js       # IndexedDB 统一封装（升级版）
│   ├── db-kb.js         # 知识库存储（基于 db-core）
│   └── db-projects.js   # 项目数据存储（基于 db-core）
├── CLAUDE.md
└── PLAN.md              # 本文档
```

---

## 四、数据模型

### 4.1 IndexedDB 数据库设计

| 数据库名 | ObjectStore | Key | 索引 | 说明 |
|----------|-------------|-----|------|------|
| `pm_auth` | `accounts` | `id` | `username` | 账号库 |
| `pm_data` | `projects` | `id` | `accountId` | 项目 |
| `pm_data` | `phases` | `id` | `accountId`, `projectId` | 阶段 |
| `pm_data` | `tasks` | `id` | `accountId`, `phaseId`, `parentId` | 任务 |
| `pm_data` | `kb_items` | `id` | `accountId`, `category` | 知识库元数据 |
| `pm_data` | `kb_files` | `id` | `accountId` | 知识库二进制文件 |

**为什么合并到一个 `pm_data` 数据库**：减少 IndexedDB 连接数，accountId 索引统一隔离。

### 4.2 账号对象

```json
{
  "id": "acc_abc123",
  "username": "zhangsan",
  "passwordHash": "sha256...",
  "displayName": "张三",
  "role": "user",
  "kbQuotaBytes": 104857600,
  "projectQuota": 10,
  "createdAt": "2026-06-22T08:00:00Z",
  "lastLogin": "2026-06-22T09:30:00Z"
}
```

- `role` 枚举：`admin`（可管理账号）/ `user`（普通用户）
- 首个注册的账号自动成为 `admin`
- 密码最小长度 6 位，SHA-256 哈希后存储

### 4.3 会话模型

```json
// sessionStorage key: "pm_session"
{
  "accountId": "acc_abc123",
  "username": "zhangsan",
  "displayName": "张三",
  "role": "admin",
  "loginAt": 1687425000000,
  "expiresAt": 1687511400000
}
```

- 登录有效期 24 小时
- 所有页面加载时检查 `pm_session`，过期/缺失 → 跳转 `login.html`
- 登出时清除 sessionStorage

---

## 五、配额机制

### 5.1 KB 配额（100MB/账号）

**计费时机**：保存文件前
```
已用量 = SUM(kb_files WHERE accountId = currentUser).size
if 已用量 + 新文件大小 > 100MB → 拒绝并提示
```

**展示**：管理员后台显示每个用户的 KB 使用量（绝对值 + 百分比进度条）

### 5.2 项目配额（10 个/账号）

**计费时机**：创建项目前
```
项目数 = COUNT(projects WHERE accountId = currentUser)
if 项目数 >= 10 → 拒绝并提示 "已达到项目上限（10个）"
```

**展示**：主页面右上角显示 "项目 3/10"

---

## 六、页面设计

### 6.1 login.html — 登录页

```
┌──────────────────────────────────┐
│         📋 PMO 看板               │
│                                  │
│   ┌────────────────────────┐     │
│   │  用户名                │     │
│   │  [____________]        │     │
│   │  密码                  │     │
│   │  [____________]        │     │
│   │                        │     │
│   │  [ 登 录 ]             │     │
│   │                        │     │
│   │  没有账号？立即注册     │     │
│   └────────────────────────┘     │
│                                  │
│   ┌─ 注册表单（折叠）────────┐   │
│   │  用户名 / 显示名 / 密码  │   │
│   │  [ 注 册 ]              │   │
│   └──────────────────────────┘  │
└──────────────────────────────────┘
```

- 默认展示登录表单
- 点击"注册"展开注册表单（需输入密码、确认密码）
- 登录成功后跳转 `index.html`
- 首个注册用户自动为 admin

### 6.2 admin/index.html — 管理后台

```
┌──────────────────────────────────┐
│  ⚙️ 账号管理          [返回看板] │
├──────────────────────────────────┤
│  总览：3 个账号 · 共占用 45MB    │
├──────────────────────────────────┤
│  ┌──────────────────────────┐    │
│  │ 头像  张三 (zhangsan)    │    │
│  │ 📊 项目 3/10  💾 KB 12MB/100MB │
│  │ 🔑 角色: user  ⏰ 最后登录: 今天 ││
│  │ [重置密码] [删除账号]     │    │
│  ├──────────────────────────┤    │
│  │ 头像  管理员 (admin)      │    │
│  │ 📊 项目 1/10  💾 KB 33MB/100MB │
│  │ 🔑 角色: admin 👑        │    │
│  │ [重置密码]               │    │
│  └──────────────────────────┘    │
│                                  │
│  [+ 新建账号]                     │
└──────────────────────────────────┘
```

- 仅 admin 角色可访问（非 admin 自动跳回看板）
- 功能：增删账号、重置密码、查看配额使用
- 新建账号弹窗：用户名、显示名、初始密码

### 6.3 index.html 改动点

| 位置 | 改动 |
|------|------|
| 页面顶部 | 新增顶栏：`👤 张三 | 📊 3/10项目 | 💾 12MB/100MB | 退出` |
| 初始化 | `loadFromLocal()` → `loadFromDB(accountId)` |
| 持久化 | `saveToLocal()` → `saveToDB(accountId)` |
| 新建项目 | 前置检查：`countProjects() >= 10 → 拒绝` |
| KB 保存 | 前置检查：`totalKBSize + newSize > 100MB → 拒绝` |
| 退出按钮 | 清除 sessionStorage → 跳转 login.html |

---

## 七、数据迁移方案

### 旧数据 → 新系统

```
检测条件：localStorage 中存在 pm_projects（旧格式）
迁移步骤：
  1. 取第一个 admin 账号（或自动创建 admin/admin）
  2. 将旧 pm_projects/phases/tasks 写入 pm_data（accountId=admin账号ID）
  3. 将旧 pm_kb_items 转为 pm_data.kb_items + pm_data.kb_files
  4. 删除 localStorage 中的旧 key
  5. 提示 "数据已迁移到新账号系统"
```

---

## 八、安全考虑

| 层面 | 措施 |
|------|------|
| 密码 | SHA-256 客户端哈希，不存明文 |
| 会话 | sessionStorage（标签页隔离，关闭即清除），24h 过期 |
| 权限 | admin 页面通过 `role` 字段保护，前端路由守卫 |
| XSS | 现有 innerHTML 渲染需审查，用户名等用户输入需转义 |
| 离线 | 管理员密码重置功能（admin 可重置任意用户密码，无需旧密码） |

---

## 九、实施步骤（分阶段）

### Step 1：创建 `js/db-core.js`（IndexedDB 统一封装）
- 升级现有 kbDB → 统一 pm_data 连接
- CRUD 泛型方法：getAll / getById / put / delete / count / sum

### Step 2：创建 `js/auth.js`
- `hashPassword(pwd)` → SHA-256
- `register(username, displayName, password)` → account 对象
- `login(username, password)` → session 对象
- `logout()` → 清除 session
- `getCurrentSession()` → 校验并返回 session
- `listAccounts()` → admin 专用
- `deleteAccount(id)` → admin 专用
- `resetPassword(id, newPwd)` → admin 专用

### Step 3：创建 `login.html`
- 纯 HTML/CSS/JS 单页，引用 `auth.js` + `db-core.js`
- 登录/注册/改密 三个表单（tab 切换）

### Step 4：创建 `admin/index.html`
- 引用 `auth.js` + `db-core.js`
- 账号列表 + 配额统计 + CRUD

### Step 5：改造 `index.html`
- 引入 `auth.js` + `db-core.js`
- 替换持久化层（localStorage → IndexedDB 按 accountId 隔离）
- 添加顶栏用户信息 + 配额提示
- 添加配额检查逻辑

### Step 6：数据迁移
- 首次加载时自动检测并迁移旧数据
- 测试：旧 localStorage 数据 → 新 IndexedDB 格式

### Step 7：集成测试
- 多账号切换、数据隔离验证
- 配额超限拦截验证
- 浏览器控制台零错误

---

## 十、技术细节备忘

### 10.1 SHA-256 实现
使用 Web Crypto API（浏览器原生，零依赖）：
```js
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 10.2 IndexedDB 统一封装 API
```js
const DB = {
  open()           → Promise<IDBDatabase>
  getAll(store)    → Promise<array>
  getById(store, id) → Promise<object>
  put(store, obj)  → Promise<void>
  delete(store, id) → Promise<void>
  count(store, index, value) → Promise<number>
  sum(store, index, value, field) → Promise<number>
  clear(store)     → Promise<void>
}
```

### 10.3 配额展示组件
```html
<div class="quota-bar">
  <span>💾 KB 用量</span>
  <div class="quota-bg"><div class="quota-fill" style="width:12%"></div></div>
  <span>12MB / 100MB</span>
</div>
```

---

## 十一、验收标准

| # | 验收项 | 标准 |
|---|--------|------|
| 1 | 登录 | 正确密码进入看板，错误密码提示，注册流转通 |
| 2 | 数据隔离 | 账号A创建的项目，账号B登录后不可见 |
| 3 | 会话过期 | 24h 后自动跳转登录页 |
| 4 | 角色权限 | 非 admin 无法访问 `pmo/admin/` |
| 5 | KB 配额 | 超 100MB 时拒绝上传并提示 |
| 6 | 项目配额 | 第 11 个项目创建被拒绝并提示 |
| 7 | 管理后台 | admin 可新建/删除账号、重置密码 |
| 8 | 数据迁移 | 旧 localStorage 数据自动迁移到新系统 |
| 9 | 离线可用 | 断网状态下所有功能正常（无外部 CDN 依赖） |
| 10 | 中文界面 | 所有提示/按钮/Label 使用中文 |
