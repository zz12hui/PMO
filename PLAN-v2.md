# PMO 管理员配置系统 — 技术方案

## 一、需求变更

| 变更 | 旧方案 | 新方案 |
|------|--------|--------|
| 注册 | 任何人都可在 login.html 注册 | ❌ 取消注册，仅管理员手动创建账号 |
| 账号创建 | 用户自主注册，首个自动 admin | 仅 admin 在后台创建，可指定角色 |
| 系统参数 | 硬编码在 JS 中 | 管理员可在后台配置，实时生效 |
| 配额 | 全局固定 100MB/10项目 | 系统默认值 + 单账号可覆盖 |

---

## 二、文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `login.html` | 移除注册 tab，纯登录页 |
| 创建 | `js/config.js` | 系统配置读写层 |
| 改造 | `admin/index.html` | 新增配置管理 + 账号覆盖 |
| 适配 | `js/auth.js` | 移除 register 函数，新增管理员创建账号 |
| 适配 | `index.html` | 从配置读取配额而非硬编码 |
| 删除 | `auth.js` 中的 `register()` | 不再需要公开注册 |

---

## 三、配置数据模型

### 3.1 存储位置

新增 IndexedDB database `pm_config`，单 objectStore `settings`：

```json
{
  "id": "system",
  "defaultKbQuotaMB": 100,
  "defaultProjectQuota": 10,
  "sessionExpireHours": 24,
  "maxFileSizeMB": 50,
  "maxTaskDepth": 4,
  "minPasswordLength": 6,
  "showDemoOnFirstLogin": true,
  "updatedAt": "2026-06-22T..."
}
```

### 3.2 单账号覆盖

在 `pm_auth.accounts` 的账号对象中增加可选字段：

```json
{
  "id": "acc_xxx",
  "username": "zhangsan",
  "displayName": "张三",
  "role": "user",
  "passwordHash": "...",
  "kbQuotaMB": 200,       // 覆盖系统默认 100MB
  "projectQuota": 20,     // 覆盖系统默认 10
  "createdAt": "...",
  "lastLogin": "..."
}
```

当账号有覆盖值时用覆盖值，否则用系统默认值。

### 3.3 配置优先级

```
单账号覆盖 > 系统默认 > 代码兜底
```

---

## 四、js/config.js — 配置 API

```js
const Config = {
  // 读取系统配置（带缓存）
  async get() → { defaultKbQuotaMB, defaultProjectQuota, ... }

  // 更新系统配置
  async update(partial) → void

  // 为指定账号读取有效配额
  async getEffectiveQuota(accountId) → { kbQuotaMB, projectQuota }

  // 为指定账号设置覆盖值（管理员操作）
  async setAccountOverride(accountId, field, value) → void

  // 重置默认值（恢复出厂设置）
  async reset() → void
}
```

首次调用 `Config.get()` 时，如果 `pm_config` 不存在则自动创建并写入默认值。

---

## 五、admin/index.html 改造

### 5.1 布局改为 Tab 结构

```
┌─────────────────────────────────────────────┐
│  ⚙️ PMO 管理后台           [返回看板] [退出] │
├─────────────────────────────────────────────┤
│  [账号管理]  [系统配置]  [配额管理]          │
├─────────────────────────────────────────────┤
│                                             │
│  (当前 tab 内容)                             │
│                                             │
└─────────────────────────────────────────────┘
```

### 5.2 Tab 1: 账号管理

保持现有功能 + 增强：

- 账号卡片列表（用户名、显示名、角色、项目数、KB用量）
- **质量指标列**：
  - 项目进度% = 完成任务数 / 总任务数
  - 延期任务数
  - 最近活跃时间
- 操作：重置密码 / 编辑配额 / 删除账号
- [+ 新建账号] 弹窗：
  - 用户名（必填）
  - 显示名（必填）
  - 密码（必填）
  - 角色：admin / user（下拉选择）
  - KB配额：不填则用系统默认
  - 项目配额：不填则用系统默认

### 5.3 Tab 2: 系统配置

可配置的参数表格：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 知识库配额(MB) | number | 100 | 每个账号最大 KB 存储 |
| 项目数量上限 | number | 10 | 每个账号最多项目数 |
| 会话有效期(h) | number | 24 | 过期需重新登录 |
| 最大上传文件(MB) | number | 50 | 单个知识库文件上限 |
| 密码最小长度 | number | 6 | 新建/重置密码最小字符 |
| 最大任务层级 | number | 4 | 任务树最大深度 |
| 首次登录显示演示数据 | toggle | true | 新账号默认加载模板 |

每个参数旁有 [重置默认值] 小按钮。
底部 [保存配置] 按钮。

### 5.4 Tab 3: 配额管理

- 所有账号列表，每行显示：
  - 用户名 / 显示名
  - 当前 KB 用量 / 配额（进度条）
  - 当前项目数 / 配额（进度条）
  - [编辑] 按钮 → 弹窗修改该账号的配额覆盖值
- 可以单独放大某个账号的配额（如 VIP 用户）
- 覆盖值为空 = 跟随系统默认

---

## 六、login.html 改造

- ❌ 删除「注册」tab
- ✅ 仅保留登录表单
- ✅ 无账号提示改为：「请联系管理员获取账号」
- ✅ 如启动时无任何账号，显示首次设置向导（创建管理员账号）
- 首次设置向导：输入 admin 用户名 + 密码 → 创建首个 admin 账号 → 跳转登录

---

## 七、各文件适配清单

### 7.1 login.html
- 移除注册 tab HTML 和 JS
- 添加首次启动检测：`listAccounts()` 返回空 → 显示初始化表单
- 初始化表单：创建首个 admin 账号

### 7.2 auth.js
- 删除 `register()` 函数
- 新增 `createAccount(username, displayName, password, role, overrides)` — 仅管理员调用
- 新增 `isFirstRun()` → 检查是否有任何账号
- 新增 `updateAccountOverrides(id, overrides)` — 更新配额覆盖

### 7.3 config.js（新建）
- `Config.get()` / `Config.update()` / `Config.reset()`
- `Config.getEffectiveQuota(accountId)`
- `Config.setAccountOverride(accountId, field, value)`

### 7.4 admin/index.html
- 新增 tab 结构 HTML + CSS
- Tab1 JS：增强账号列表显示（进度%、延期数、活跃时间）
- Tab2 JS：配置表单渲染 + 保存逻辑
- Tab3 JS：配额列表 + 单账号覆盖编辑
- 引用 `../js/config.js`

### 7.5 index.html
- 顶栏配额显示从 `Config.getEffectiveQuota()` 读取
- `saveProject()` 配额检查用 Config 值
- `saveKbItem()` 文件大小检查用 Config 值
- 初始化时调用 `Config.get()` 预热配置

### 7.6 db-core.js
- `open()` 增加第三个数据库 `pm_config`
- stores: `['settings']`

---

## 八、实施步骤

| # | 步骤 | 文件 | 依赖 |
|---|------|------|------|
| 1 | 扩展 db-core.js 支持 pm_config | `js/db-core.js` | — |
| 2 | 创建 js/config.js | `js/config.js` | step 1 |
| 3 | 修改 auth.js | `js/auth.js` | step 2 |
| 4 | 改造 login.html | `login.html` | step 3 |
| 5 | 改造 admin/index.html | `admin/index.html` | step 2,3 |
| 6 | 适配 index.html | `index.html` | step 2,5 |
| 7 | 集成测试 | — | all |

---

## 九、验收标准

| # | 验收项 | 标准 |
|---|--------|------|
| 1 | 注册已移除 | login.html 无注册入口 |
| 2 | 首次启动向导 | 零账号时显示 admin 初始化表单 |
| 3 | 管理员创建账号 | admin 后台可创建 user/admin 账号 |
| 4 | 系统配置 | 修改配额默认值后，新账号生效 |
| 5 | 单账号覆盖 | 单独设置某账号配额 > 系统默认 |
| 6 | 配置持久化 | 刷新页面后配置不丢失 |
| 7 | 所有页面 0 JS 错误 | browser console 验证 |
| 8 | 中文界面 | 所有 UI 文本中文 |
