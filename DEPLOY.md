# PMO 项目管理看板 — 完整部署文档

> 版本 v1.0 | 2026-06-22
> 适用环境：Linux (Ubuntu/Debian/CentOS) / Nginx
> 部署方式：静态文件托管，零后端依赖

---

## 目录

1. [环境要求](#1-环境要求)
2. [快速部署 (Nginx)](#2-快速部署-nginx)
3. [离线部署方案](#3-离线部署方案)
4. [文件清单](#4-文件清单)
5. [Nginx 配置参考](#5-nginx-配置参考)
6. [安全加固](#6-安全加固)
7. [备份与恢复](#7-备份与恢复)
8. [升级流程](#8-升级流程)
9. [运维巡检清单](#9-运维巡检清单)
10. [故障排查](#10-故障排查)

---

## 1. 环境要求

### 服务器

| 项目 | 最低要求 |
|------|----------|
| OS | Ubuntu 20.04+ / Debian 11+ / CentOS 7+ |
| Web Server | Nginx 1.18+ (推荐) 或 Apache 2.4+ |
| 磁盘 | 1 GB（静态文件 < 500KB） |
| 内存 | 512 MB |
| CPU | 1 核 |

### 客户端

| 浏览器 | 版本 |
|--------|------|
| Chrome | 80+ |
| Firefox | 80+ |
| Edge | 80+ |
| Safari | 14+ |

> 需要 Web Crypto API 和 IndexedDB 支持。

### 网络

- 在线部署：需要 CDN 访问（cdn.sheetjs.com）用于 Excel 导出
- 离线部署：需本地化 SheetJS 依赖（见 [离线部署方案](#3-离线部署方案)）

---

## 2. 快速部署 (Nginx)

### 2.1 准备文件

```bash
# 将所有文件复制到目标目录
sudo mkdir -p /var/www/html/PMO
sudo cp -r ./* /var/www/html/PMO/
```

### 2.2 配置 Nginx

```bash
# 创建站点配置
sudo tee /etc/nginx/sites-available/pmo << 'EOF'
server {
    listen 80;
    server_name your-domain.com;   # 替换为实际域名

    root /var/www/html/PMO;
    index index.html;

    # 静态文件缓存
    location ~* \.(html|css|js|png|jpg|svg|ico)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # 禁止访问敏感文件
    location ~* \.(md|plan|sql|log)$ {
        deny all;
        return 403;
    }

    # 禁止访问隐藏文件和目录
    location ~ /\. {
        deny all;
        return 403;
    }

    # 安全头
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF

# 启用站点
sudo ln -sf /etc/nginx/sites-available/pmo /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载
sudo nginx -s reload
```

### 2.3 验证

```bash
# 检查 HTTP 状态
curl -sI http://your-domain.com/PMO/ | head -3

# 预期输出：
# HTTP/1.1 200 OK
# Server: nginx
# Content-Type: text/html
```

### 2.4 目录结构与权限

```bash
# 设置正确的权限
sudo chown -R www-data:www-data /var/www/html/PMO/
sudo chmod -R 755 /var/www/html/PMO/
sudo chmod 644 /var/www/html/PMO/*.html
sudo chmod 644 /var/www/html/PMO/js/*.js
```

---

## 3. 离线部署方案

> 适用于**内网环境**，完全脱离外网依赖。

### 3.1 下载 SheetJS 本地化

在线环境下载依赖：

```bash
# 下载 SheetJS
cd /tmp/ai-tutorial/PMO/
mkdir -p assets
curl -L -o assets/xlsx.min.js https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js

# 验证文件
ls -lh assets/xlsx.min.js
# 预期：约 600KB
```

### 3.2 修改 index.html 引用

```bash
# 将 CDN 引用替换为本地路径
sed -i 's|https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js|assets/xlsx.min.js|g' index.html
```

### 3.3 打包离线部署包

```bash
# 打包整个项目
cd /tmp/ai-tutorial
tar -czf pmo-offline-$(date +%Y%m%d).tar.gz PMO/

# 传输到内网服务器后解压
tar -xzf pmo-offline-*.tar.gz -C /var/www/html/
```

### 3.4 内网验证

```bash
# 在内网服务器上验证
curl -sI http://localhost/PMO/assets/xlsx.min.js | head -3
# 预期：200 OK

curl -sI http://localhost/PMO/ | head -3
# 预期：200 OK
```

---

## 4. 文件清单

```
PMO/
├── index.html              # 主看板（124KB，2289行）
├── login.html              # 登录页（8KB）
├── admin/
│   └── index.html          # 管理后台（35KB）
├── js/
│   ├── auth.js             # 认证层（16KB）
│   ├── db-core.js          # IndexedDB 封装（7KB）
│   └── config.js           # 配置读写
├── assets/                 # [离线部署时添加]
│   └── xlsx.min.js         # SheetJS 库（~600KB）
├── CLAUDE.md              # AI 编程助手指南
├── README.md              # 项目文档
├── USER_MANUAL.md         # 用户使用手册
├── SOP.md                 # 标准操作流程
├── DEPLOY.md              # 本部署文档
├── PLAN.md                # 账号系统技术方案
└── PLAN-v2.md             # 管理员配置系统技术方案
```

### 关键文件说明

| 文件 | 功能 | 修改频率 |
|------|------|----------|
| `index.html` | 主看板应用 | 功能迭代时修改 |
| `login.html` | 登录/初始化 | 安全策略变更时修改 |
| `admin/index.html` | 管理后台 | 管理功能扩展时修改 |
| `js/auth.js` | 认证核心 | 安全算法升级时修改 |
| `js/db-core.js` | 数据库封装 | 极少修改（稳定层） |
| `js/config.js` | 配置读写 | 新增配置项时修改 |

---

## 5. Nginx 配置参考

### 5.1 生产环境完整配置

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书（推荐使用 Let's Encrypt）
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/html/PMO;
    index index.html;

    # 安全头
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # 静态文件缓存
    location ~* \.(html)$ {
        expires -1;  # HTML 不缓存（应用逻辑可能更新）
        add_header Cache-Control "no-cache";
    }
    location ~* \.(css|js|png|jpg|svg|ico|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 管理后台额外保护（可选：IP 白名单）
    location /PMO/admin/ {
        # allow 10.0.0.0/8;      # 仅内网访问
        # deny all;
        auth_basic "Admin Area";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }

    # 禁止访问敏感文件
    location ~* \.(md|plan|sql|log|pem|key)$ {
        deny all;
        return 403;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
        return 403;
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/html text/css application/javascript text/plain;
    gzip_min_length 1000;
}

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

### 5.2 Apache 配置

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /var/www/html/PMO

    <Directory /var/www/html/PMO>
        Options -Indexes
        AllowOverride None
        Require all granted
    </Directory>

    # 禁止访问敏感文件
    <FilesMatch "\.(md|plan|sql|log)$">
        Require all denied
    </FilesMatch>
</VirtualHost>
```

---

## 6. 安全加固

### 6.1 应用层安全（已内置）

| 措施 | 状态 |
|------|------|
| 密码 SHA-256 加盐存储 | ✅ 已实现 |
| 登录失败锁定（5次/15分钟） | ✅ 已实现 |
| 会话超时（默认24h） | ✅ 已实现，可配置 |
| 数据账号隔离 | ✅ 已实现 |
| API 权限校验 | ✅ 已实现 |
| 防管理员自删 | ✅ 已实现 |

### 6.2 服务端安全（需配置）

```bash
# 1. 限制 Nginx 访问管理后台（推荐）
# 见上方 Nginx 配置中的 location /PMO/admin/ 段

# 2. 启用 HTTPS（Let's Encrypt 免费证书）
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 3. 设置文件权限
sudo chown -R root:root /var/www/html/PMO/
sudo chmod -R 755 /var/www/html/PMO/
sudo chmod 644 /var/www/html/PMO/*.*

# 4. 禁用目录列表
# 在 nginx 配置中确保没有 autoindex on;
```

### 6.3 数据安全建议

| 建议 | 说明 |
|------|------|
| 定期备份 | 用户定期导出 Excel 报表作为数据备份 |
| 密码策略 | 管理员在后台设置 ≥8 位密码要求 |
| 会话时效 | 内网可设置较长时间，公网建议 ≤8 小时 |
| 审计日志 | 当前无服务端日志，后续可扩展 |

---

## 7. 备份与恢复

### 7.1 代码备份

```bash
# 备份整个项目目录
tar -czf pmo-backup-$(date +%Y%m%d).tar.gz /var/www/html/PMO/

# 远程备份
scp pmo-backup-*.tar.gz user@backup-server:/backups/
```

### 7.2 数据备份（用户侧）

> ⚠️ 数据存储在用户浏览器的 IndexedDB 中，无法从服务端备份。

**推荐方案：**

1. 用户定期导出 Excel 报表（`Ctrl+S`）
2. 报表文件存档到内部文件服务器
3. 建议频率：**每周五导出一次**

### 7.3 恢复流程

```bash
# 代码回滚
cd /var/www/html/
sudo mv PMO PMO.bak.$(date +%Y%m%d)
sudo tar -xzf pmo-backup-YYYYMMDD.tar.gz

# 用户数据恢复
# 方法：从历史导出的 Excel 报表手动重建任务
# IndexedDB 数据在浏览器清除后无法恢复
```

---

## 8. 升级流程

### 8.1 在线升级

```bash
# 1. 备份当前版本
sudo cp -r /var/www/html/PMO /tmp/PMO.backup.$(date +%Y%m%d_%H%M)

# 2. 替换文件
sudo cp index.html /var/www/html/PMO/
sudo cp login.html /var/www/html/PMO/
sudo cp admin/index.html /var/www/html/PMO/admin/
sudo cp js/*.js /var/www/html/PMO/js/

# 3. 清除 HTML 缓存（重要！）
# 用户浏览器可能缓存了旧版 HTML，需在 index.html 增加版本号
# 或在 nginx 配置中将 HTML 的 Cache-Control 设为 no-cache

# 4. 验证
curl -sI https://your-domain.com/PMO/ | head -3
```

### 8.2 升级注意事项

- ⚠️ 升级 `auth.js` 可能影响密码验证算法，**需保留旧版兼容逻辑**
- ⚠️ 升级 `db-core.js` 可能影响数据结构，**需增加数据库版本号**
- ⚠️ 升级 `index.html` 需通知所有用户**硬刷新**（`Ctrl+Shift+R`）
- ⚠️ 升级前务必**备份当前版本**

---

## 9. 运维巡检清单

### 每日检查

- [ ] 服务是否正常运行（`curl -sI URL` 返回 200）
- [ ] Nginx 进程运行状态

### 每周检查

- [ ] Nginx 日志无异常错误
```bash
sudo tail -100 /var/log/nginx/error.log
```
- [ ] 磁盘空间充足
```bash
df -h /var/www/html/
```
- [ ] SSL 证书有效期
```bash
sudo certbot certificates
```

### 每月检查

- [ ] 管理员登录后台 → 配额管理 → 确认无超标账号
- [ ] 管理员登录后台 → 系统配置 → 确认配置项无异常
- [ ] 代码备份到异地

---

## 10. 故障排查

### 10.1 页面无法访问

```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 检查端口监听
sudo ss -tlnp | grep -E '80|443'

# 检查错误日志
sudo tail -50 /var/log/nginx/error.log

# 测试配置
sudo nginx -t
```

### 10.2 页面白屏/加载失败

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| 白屏 | JS 报错 | 打开浏览器 F12 控制台查看错误 |
| 加载中不动 | auth.js 加载失败 | 检查文件是否存在 `ls -la js/auth.js` |
| 登录后跳转失败 | 会话异常 | 清除浏览器数据后重试 |

### 10.3 Excel 导出失败

| 现象 | 原因 | 解决 |
|------|------|------|
| 点击无反应 | SheetJS CDN 不可达 | 离线部署本地化 SheetJS |
| 下载的文件损坏 | 数据异常 | 检查控制台错误，刷新后重试 |

### 10.4 知识库上传失败

| 现象 | 原因 | 解决 |
|------|------|------|
| 上传无反应 | 文件超大 | 单文件 ≤50MB |
| 提示配额不足 | 已用空间超标 | 清理旧文件或联系管理员扩容 |
| 文件不显示 | IndexedDB 错误 | 检查浏览器是否禁用 IndexedDB |

---

## 附录

### A. 完整部署检查清单

部署完成后逐项验证：

- [ ] `curl -sI http://server/PMO/` → 200 OK
- [ ] `curl -sI http://server/PMO/login.html` → 200 OK
- [ ] `curl -sI http://server/PMO/admin/` → 200 OK
- [ ] `curl -sI http://server/PMO/js/auth.js` → 200 OK
- [ ] `curl -sI http://server/PMO/js/db-core.js` → 200 OK
- [ ] `curl -sI http://server/PMO/js/config.js` → 200 OK
- [ ] 浏览器访问 → 显示初始化页面（首次）
- [ ] 创建管理员账号 → 成功
- [ ] 管理员登录 → 进入管理后台
- [ ] 创建普通用户 → 成功
- [ ] 普通用户登录 → 进入看板
- [ ] 创建项目 → 成功
- [ ] 创建任务 → 成功
- [ ] 导出 Excel → 下载成功，能打开
- [ ] 修改密码 → 成功
- [ ] 锁定测试 → 5 次错误后锁定 15 分钟
- [ ] 敏感文件不可访问 → `.md` 文件返回 403

### B. 快速命令速查

```bash
# 部署
sudo cp -r PMO/ /var/www/html/
sudo nginx -s reload

# 备份
tar -czf pmo-$(date +%Y%m%d).tar.gz /var/www/html/PMO/

# 回滚
sudo tar -xzf pmo-YYYYMMDD.tar.gz -C /var/www/html/

# 检查状态
curl -sI https://your-domain.com/PMO/ | head -1

# 查看错误
sudo tail -50 /var/log/nginx/error.log

# 证书续期
sudo certbot renew --dry-run
```
## 作者微信，
创作交流请加备注github
#### 支持定制项目可按需求
<img width="566" height="540" alt="image" src="https://github.com/user-attachments/assets/dd67ac0b-a751-46a8-b762-d71715faa049" />
