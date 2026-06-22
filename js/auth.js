/* ==================== 认证层 ==================== */
const Auth = (function() {
  'use strict';

  const AUTH_DB = 'pm_auth';
  const AUTH_STORE = 'accounts';
  const SESSION_KEY = 'pm_session';
  const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  // ── Security: salted hashing ──
  const HASH_SALT = 'pmo_s2k_v1_8f3a1c7d'; // PBKDF2-style salt, never changes
  const HASH_VERSION_KEY = 'hashVersion';    // for future algorithm upgrades

  // ── Security: login lockout ──
  const LOCKOUT_KEY = 'pm_lockout';          // localStorage key
  const MAX_FAILURES = 5;
  const LOCKOUT_MINUTES = 15;

  // Initialize the auth database
  function initAuthDB() {
    return DB.open(AUTH_DB, 1, [{
      name: AUTH_STORE,
      keyPath: 'id',
      indices: [
        { name: 'username', keyPath: 'username', options: { unique: true } }
      ]
    }]);
  }

  // SHA-256 hash using Web Crypto API
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Salted hash: sha256(username + ":" + password + ":" + SALT)
  function hashPassword(username, password) {
    return sha256(username.trim() + ':' + password + ':' + HASH_SALT);
  }

  // Old (unsalted) hash — for migration compatibility
  function hashPasswordLegacy(password) {
    return sha256(password);
  }

  // Generate a unique account ID
  function genAccountId() {
    return 'acc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  // ── Login lockout helpers (localStorage, cross-tab) ──
  function _loadLockState(username) {
    try {
      const raw = localStorage.getItem(LOCKOUT_KEY + '_' + username);
      if (!raw) return { failCount: 0, firstFailAt: 0, lockedUntil: 0 };
      return JSON.parse(raw);
    } catch(e) { return { failCount: 0, firstFailAt: 0, lockedUntil: 0 }; }
  }

  function _saveLockState(username, state) {
    localStorage.setItem(LOCKOUT_KEY + '_' + username, JSON.stringify(state));
  }

  function getLockState(username) {
    if (!username) return { locked: false, remainingAttempts: MAX_FAILURES, waitSeconds: 0 };
    const state = _loadLockState(username.trim());
    const now = Date.now();

    // Check if locked
    if (state.lockedUntil && now < state.lockedUntil) {
      return {
        locked: true,
        remainingAttempts: 0,
        waitSeconds: Math.ceil((state.lockedUntil - now) / 1000)
      };
    }

    // If lock expired, reset
    if (state.lockedUntil && now >= state.lockedUntil) {
      _saveLockState(username.trim(), { failCount: 0, firstFailAt: 0, lockedUntil: 0 });
      return { locked: false, remainingAttempts: MAX_FAILURES, waitSeconds: 0 };
    }

    // Reset stale failures (> 30 minutes since first fail)
    if (state.firstFailAt && (now - state.firstFailAt) > 30 * 60 * 1000) {
      _saveLockState(username.trim(), { failCount: 0, firstFailAt: 0, lockedUntil: 0 });
      return { locked: false, remainingAttempts: MAX_FAILURES, waitSeconds: 0 };
    }

    const remaining = Math.max(0, MAX_FAILURES - state.failCount);
    return { locked: false, remainingAttempts: remaining, waitSeconds: 0 };
  }

  function recordLockFailure(username) {
    if (!username) return;
    const state = _loadLockState(username.trim());
    const now = Date.now();

    if (!state.firstFailAt || (now - state.firstFailAt) > 30 * 60 * 1000) {
      state.firstFailAt = now;
      state.failCount = 1;
    } else {
      state.failCount++;
    }

    if (state.failCount >= MAX_FAILURES) {
      state.lockedUntil = now + LOCKOUT_MINUTES * 60 * 1000;
    }

    _saveLockState(username.trim(), state);
  }

  function clearLock(username) {
    if (!username) return;
    _saveLockState(username.trim(), { failCount: 0, firstFailAt: 0, lockedUntil: 0 });
  }

  // Check if this is the first run (no accounts exist)
  async function isFirstRun() {
    await initAuthDB();
    const all = await DB.getAll(AUTH_DB, AUTH_STORE);
    return all.length === 0;
  }

  // Create account (admin only)
  async function createAccount(username, displayName, password, role, overrides) {
    if (!username || username.trim().length < 2) {
      throw new Error('用户名至少2个字符');
    }
    if (!displayName || displayName.trim().length < 1) {
      throw new Error('请输入显示名');
    }
    if (!password || password.length < 6) {
      throw new Error('密码至少6位');
    }
    if (!role || !['admin', 'user'].includes(role)) {
      throw new Error('请选择有效的角色');
    }

    await initAuthDB();

    // Check if username already exists
    const allAccounts = await DB.getAll(AUTH_DB, AUTH_STORE);
    const existing = allAccounts.find(a => a.username === username.trim());
    if (existing) {
      throw new Error('用户名已存在');
    }

    const account = {
      id: genAccountId(),
      username: username.trim(),
      passwordHash: await hashPassword(username, password),
      hashVersion: 1,  // v1 = salted
      displayName: displayName.trim(),
      role: role,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    // Apply quota overrides if provided
    if (overrides) {
      if (overrides.kbQuotaMB != null) account.kbQuotaMB = overrides.kbQuotaMB;
      if (overrides.projectQuota != null) account.projectQuota = overrides.projectQuota;
    }

    await DB.put(AUTH_DB, AUTH_STORE, account);
    return { id: account.id, username: account.username, displayName: account.displayName, role: account.role };
  }

  // First-run initialization: create admin account without session check
  async function initAdminAccount(username, password) {
    if (!username || username.trim().length < 2) {
      throw new Error('用户名至少2个字符');
    }
    if (!password || password.length < 6) {
      throw new Error('密码至少6位');
    }
    await initAuthDB();
    const all = await DB.getAll(AUTH_DB, AUTH_STORE);
    if (all.length > 0) {
      throw new Error('系统已初始化，不能重复创建管理员账号');
    }
    const account = {
      id: genAccountId(),
      username: username.trim(),
      displayName: '管理员',
      passwordHash: await hashPassword(username, password),
      hashVersion: 1,
      role: 'admin',
      createdAt: new Date().toISOString(),
      lastLogin: null
    };
    await DB.put(AUTH_DB, AUTH_STORE, account);
    return { id: account.id, username: account.username, displayName: account.displayName, role: account.role };
  }

  // Login (with lockout + migration)
  async function login(username, password) {
    if (!username || !password) {
      throw new Error('请输入用户名和密码');
    }

    const uname = username.trim();

    // ── Lockout check ──
    const lockState = getLockState(uname);
    if (lockState.locked) {
      const mins = Math.ceil(lockState.waitSeconds / 60);
      throw new Error('账号已锁定，请 ' + mins + ' 分钟后再试');
    }

    await initAuthDB();

    const allAccounts = await DB.getAll(AUTH_DB, AUTH_STORE);
    const account = allAccounts.find(a => a.username === uname);
    if (!account) {
      recordLockFailure(uname);
      const remaining = lockState.remainingAttempts - 1;
      throw new Error('用户名或密码错误' + (remaining > 0 ? '（剩余 ' + remaining + ' 次尝试）' : ''));
    }

    // ── Password verification with auto-migration ──
    let matched = false;
    let needsMigration = false;

    // Try current salted hash (v1)
    const newHash = await hashPassword(uname, password);
    if (newHash === account.passwordHash) {
      matched = true;
    }

    // Try legacy unsalted hash (v0) — auto-migrate
    if (!matched && (!account.hashVersion || account.hashVersion === 0)) {
      const legacyHash = await hashPasswordLegacy(password);
      if (legacyHash === account.passwordHash) {
        matched = true;
        needsMigration = true;
      }
    }

    if (!matched) {
      recordLockFailure(uname);
      const newState = getLockState(uname);
      if (newState.locked) {
        throw new Error('账号已锁定，请 ' + LOCKOUT_MINUTES + ' 分钟后再试');
      }
      throw new Error('用户名或密码错误（剩余 ' + (newState.remainingAttempts) + ' 次尝试）');
    }

    // ── Success: clear lockout + migrate if needed ──
    clearLock(uname);

    if (needsMigration) {
      account.passwordHash = newHash;
      account.hashVersion = 1;
    }

    // Update lastLogin
    account.lastLogin = new Date().toISOString();
    await DB.put(AUTH_DB, AUTH_STORE, account);

    // Create session
    const now = Date.now();
    const session = {
      accountId: account.id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      loginAt: now,
      expiresAt: now + SESSION_DURATION
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  // Get current session (validates expiry)
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch(e) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  // Logout
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ── Self-service password change ──
  async function changePassword(accountId, oldPassword, newPassword) {
    const session = getSession();
    if (!session) throw new Error('请先登录');
    if (session.accountId !== accountId) throw new Error('无权限：只能修改自己的密码');
    if (!oldPassword) throw new Error('请输入当前密码');
    if (!newPassword || newPassword.length < 6) throw new Error('新密码至少6位');
    if (oldPassword === newPassword) throw new Error('新密码不能与当前密码相同');

    await initAuthDB();
    const account = await DB.getById(AUTH_DB, AUTH_STORE, accountId);
    if (!account) throw new Error('账号不存在');

    // Verify old password (support both hash versions)
    let oldMatched = false;
    const newSaltedHash = await hashPassword(account.username, oldPassword);
    if (newSaltedHash === account.passwordHash) oldMatched = true;
    if (!oldMatched && (!account.hashVersion || account.hashVersion === 0)) {
      const legacyHash = await hashPasswordLegacy(oldPassword);
      if (legacyHash === account.passwordHash) oldMatched = true;
    }
    if (!oldMatched) throw new Error('当前密码错误');

    // Update to new salted hash
    account.passwordHash = await hashPassword(account.username, newPassword);
    account.hashVersion = 1;
    await DB.put(AUTH_DB, AUTH_STORE, account);
  }

  // Admin: list all accounts
  async function listAccounts() {
    const session = getSession();
    if (!session || session.role !== 'admin') {
      throw new Error('无权限：仅管理员可查看账号列表');
    }
    await initAuthDB();
    const accounts = await DB.getAll(AUTH_DB, AUTH_STORE);
    // Return without passwordHash
    return accounts.map(a => ({
      id: a.id,
      username: a.username,
      displayName: a.displayName,
      role: a.role,
      kbQuotaMB: a.kbQuotaMB,
      projectQuota: a.projectQuota,
      createdAt: a.createdAt,
      lastLogin: a.lastLogin
    }));
  }

  // Admin: delete an account
  async function deleteAccount(id) {
    const session = getSession();
    if (!session || session.role !== 'admin') {
      throw new Error('无权限：仅管理员可删除账号');
    }
    if (id === session.accountId) {
      throw new Error('不能删除自己的账号');
    }
    await initAuthDB();
    await DB.delete(AUTH_DB, AUTH_STORE, id);
  }

  // Admin: reset password
  async function resetPassword(id, newPassword) {
    const session = getSession();
    if (!session || session.role !== 'admin') {
      throw new Error('无权限：仅管理员可重置密码');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('密码至少6位');
    }
    await initAuthDB();
    const account = await DB.getById(AUTH_DB, AUTH_STORE, id);
    if (!account) {
      throw new Error('账号不存在');
    }
    account.passwordHash = await hashPassword(account.username, newPassword);
    account.hashVersion = 1;
    await DB.put(AUTH_DB, AUTH_STORE, account);
  }

  // Get account usage stats (project count + KB usage)
  async function getAccountUsage(accountId) {
    if (!accountId) return { projectCount: 0, kbBytes: 0 };

    try {
      const projectCount = await DB.count('pm_data', 'projects', 'accountId', accountId);
      const kbBytes = await DB.sum('pm_data', 'kb_files', 'accountId', accountId, 'size');
      return { projectCount, kbBytes };
    } catch(e) {
      console.warn('getAccountUsage error:', e);
      return { projectCount: 0, kbBytes: 0 };
    }
  }

  // Internal: get account by id (no session check)
  async function _getAccountById(accountId) {
    if (!accountId) return null;
    await initAuthDB();
    return DB.getById(AUTH_DB, AUTH_STORE, accountId);
  }

  // Admin: update account override fields (kbQuotaMB, projectQuota)
  async function updateAccountOverrides(id, overrides) {
    const session = getSession();
    if (!session || session.role !== 'admin') {
      throw new Error('无权限：仅管理员可修改配额');
    }
    await initAuthDB();
    const account = await DB.getById(AUTH_DB, AUTH_STORE, id);
    if (!account) throw new Error('账号不存在');
    if (overrides.kbQuotaMB !== undefined) account.kbQuotaMB = overrides.kbQuotaMB;
    if (overrides.projectQuota !== undefined) account.projectQuota = overrides.projectQuota;
    await DB.put(AUTH_DB, AUTH_STORE, account);
  }

  // Admin: update account fields (displayName, role, quotas)
  async function updateAccount(id, fields) {
    const session = getSession();
    if (!session || session.role !== 'admin') throw new Error('无权限');
    await initAuthDB();
    const account = await DB.getById(AUTH_DB, AUTH_STORE, id);
    if (!account) throw new Error('账号不存在');
    if (fields.displayName !== undefined) account.displayName = fields.displayName;
    if (fields.role !== undefined) account.role = fields.role;
    if (fields.kbQuotaMB !== undefined) account.kbQuotaMB = fields.kbQuotaMB;
    if (fields.projectQuota !== undefined) account.projectQuota = fields.projectQuota;
    await DB.put(AUTH_DB, AUTH_STORE, account);
    return account;
  }

  return {
    sha256,
    hashPassword,
    createAccount,
    login,
    getSession,
    logout,
    changePassword,
    getLockState,
    listAccounts,
    deleteAccount,
    resetPassword,
    getAccountUsage,
    isFirstRun,
    initAdminAccount,
    updateAccountOverrides,
    updateAccount,
    _getAccountById
  };
})();

// Expose globally for inline onclick handlers
function sha256(msg) { return Auth.sha256(msg); }
async function createAccount(username, displayName, password, role, overrides) { return Auth.createAccount(username, displayName, password, role, overrides); }
async function login(username, password) { return Auth.login(username, password); }
function getSession() { return Auth.getSession(); }
function logout() { Auth.logout(); }
async function changePassword(accountId, oldPassword, newPassword) { return Auth.changePassword(accountId, oldPassword, newPassword); }
function getLockState(username) { return Auth.getLockState(username); }
async function listAccounts() { return Auth.listAccounts(); }
async function deleteAccount(id) { return Auth.deleteAccount(id); }
async function resetPassword(id, newPassword) { return Auth.resetPassword(id, newPassword); }
async function getAccountUsage(accountId) { return Auth.getAccountUsage(accountId); }
async function isFirstRun() { return Auth.isFirstRun(); }
async function initAdminAccount(username, password) { return Auth.initAdminAccount(username, password); }
async function updateAccount(id, fields) { return Auth.updateAccount(id, fields); }
async function updateAccountOverrides(id, overrides) { return Auth.updateAccountOverrides(id, overrides); }
