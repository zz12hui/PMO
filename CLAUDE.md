# CLAUDE.md — PMO 项目管理看板

## 项目概述
企业级项目管理看板，支持多项目、甘特图、知识库、多账号数据隔离，纯前端实现。

## 技术栈
- **纯 HTML/CSS/JS**：零框架
- **唯一外部依赖**：SheetJS (xlsx 0.20.1) CDN — 用于导出 Excel
- **持久化**：IndexedDB（3 个数据库：`pm_auth` / `pm_data` / `pm_config`）
- **认证**：Web Crypto API SHA-256 加盐 + sessionStorage 会话
- **部署**：Nginx 静态托管

## 部署路径（服务器）
```
root /tmp/ai-tutorial/PMO/;
URL https://www.4si.cc/PMO/
```

## 文件结构
```
PMO/
├── index.html           # 主看板（认证守卫 + 数据隔离 + 配额显示 + 改密弹窗）
├── login.html           # 登录页（首次管理员初始化向导 + 锁定提示）
├── admin/
│   └── index.html       # 管理后台（账号管理 / 系统配置 / 配额管理）
├── js/
│   ├── auth.js          # 认证层：login/logout/createAccount/changePassword/updateAccount + 锁定 + 加盐
│   ├── db-core.js       # IndexedDB 封装：open/getAll/getById/put/delete/count/sum/getAllByIndex
│   └── config.js        # 配置读写：Config.get()/Config.update()/Config.getEffectiveQuota()
├── CLAUDE.md            # 本文件
├── README.md            # 项目文档
├── PLAN.md              # 账号系统详细设计
└── PLAN-v2.md           # 管理员配置系统技术方案
```

## IndexedDB 数据库设计

| 数据库 | ObjectStore | 索引 | 说明 |
|--------|-------------|------|------|
| `pm_auth` | `accounts` | `username` (unique) | 账号（含 passwordHash, hashVersion, kbQuotaMB, projectQuota） |
| `pm_data` | `projects` | `accountId` | 项目 |
| `pm_data` | `phases` | `accountId`, `projectId` | 阶段 |
| `pm_data` | `tasks` | `accountId`, `phaseId`, `parentId` | 任务 |
| `pm_data` | `kb_files` | `accountId` | 知识库文件（Blob） |
| `pm_config` | `settings` | — | 系统配置（key: `system`） |

## 数据模型
```
accounts[]  → { id, username, displayName, passwordHash, hashVersion, role, kbQuotaMB?, projectQuota?, createdAt, lastLogin }
projects[]  → { id, accountId, name, desc }
phases[]    → { id, accountId, projectId, name, start, end }
tasks[]     → { id, accountId, phaseId, seq, name, dur, start, planEnd, actualEnd, predIds, note, status, lv, parentId }
kb_files[]  → { id, accountId, category, name, type, size, addedAt, data(Blob) }
```

## 安全架构

| 层面 | 实现 |
|------|------|
| 密码存储 | `sha256(username + ":" + password + ":" + SALT)` + `hashVersion: 1` |
| 旧密码迁移 | 登录时检测 `hashVersion=0` → 自动升级为加盐哈希 |
| 登录锁定 | 5 次失败 → 15 分钟锁定（localStorage `pm_lockout_<username>`） |
| 会话 | sessionStorage `pm_session`，24h 过期 |
| 访问控制 | `getSession().role` 校验；admin 页面二次 guard |
| 数据隔离 | 所有 IndexedDB 查询带 `accountId` 过滤 |
| API 鉴权 | `listAccounts/deleteAccount/updateAccount/createAccount/resetPassword` 均校验 admin |
| 防自删 | `deleteAccount(id)` 拒绝 `id === session.accountId` |

## 认证函数（auth.js 公开 API）

```javascript
// 全局可用（无需 Auth. 前缀）
login(username, password)         → session
logout()                          → void
getSession()                      → session | null
changePassword(accountId, oldPwd, newPwd) → void
getLockState(username)            → { locked, remainingAttempts, waitSeconds }
createAccount(u, d, p, role, overrides?) → account
listAccounts()                    → account[]        // admin only
deleteAccount(id)                 → void             // admin only
resetPassword(id, newPwd)         → void             // admin only
updateAccount(id, fields)         → account          // admin only
updateAccountOverrides(id, ov)    → void             // admin only
```

## 配置优先级（三级）
```
单账号覆盖值 > 系统默认值 > 代码兜底值
```
- `config.js` 的 `Config.getEffectiveQuota(accountId)` 负责合并
- 管理后台「系统配置」页直接写 `pm_config.settings.system`
- 单账号覆盖通过 `updateAccount` 设置 `kbQuotaMB` / `projectQuota`

## 关键约束
- 任务层级 `lv` 由 `parentId` 推导，最大 4 级（可通过配置调整）
- 前置依赖 `predIds` 按任务 ID 数组匹配
- 知识库文件以 Blob 存入 IndexedDB，配额检查在前：`(已用量 + 新文件) > 有效配额 → 拒绝`
- 所有弹窗复用 `.modal-overlay` / `.modal` CSS 类
- Toast 通知复用 `showToast(msg)` 函数

## 键盘快捷键
- `Ctrl+N` — 新建任务
- `Ctrl+G` — 表格/甘特切换
- `Ctrl+S` — 导出 Excel
- `Esc` — 关闭弹窗 / 退出输入

## 编辑规则
1. CSS 变量在 `:root` 统一管理，不硬编码颜色
2. 数据操作后调用持久化 + 刷新 UI
3. 任务渲染走 `renderTable()`，不直接操作 DOM
4. 日期用 `addDays()` / `dateDiff()` 工具函数
5. IndexedDB 操作全部 async/await
6. onclick 传参优先用 `_accountCache` + ID，避免内联字符串转义
7. 新增认证函数需同步添加全局 wrapper（auth.js 末尾）

## 中文内容安全
所有文档和 UI 使用中性行业词汇，避免敏感关键词。详见 PLAN.md。
