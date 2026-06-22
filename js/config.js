/* ==================== 系统配置 ==================== */
const Config = (function() {
  'use strict';

  const DEFAULTS = {
    id: 'system',
    defaultKbQuotaMB: 100,
    defaultProjectQuota: 10,
    sessionExpireHours: 24,
    maxFileSizeMB: 50,
    maxTaskDepth: 4,
    minPasswordLength: 6,
    showDemoOnFirstLogin: true,
    updatedAt: null
  };

  async function get() {
    let cfg = await DB.getConfig();
    if (!cfg) {
      cfg = Object.assign({}, DEFAULTS, { updatedAt: new Date().toISOString() });
      await DB.setConfig(cfg);
    }
    // Ensure all keys exist (migration for existing configs missing new fields)
    let updated = false;
    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (!(k in cfg)) { cfg[k] = v; updated = true; }
    }
    if (updated) { await DB.setConfig(cfg); }
    return cfg;
  }

  async function update(partial) {
    const cfg = await get();
    for (const [k, v] of Object.entries(partial)) {
      if (k !== 'id' && k in DEFAULTS) {
        cfg[k] = v;
      }
    }
    cfg.updatedAt = new Date().toISOString();
    await DB.setConfig(cfg);
    return cfg;
  }

  async function reset() {
    const cfg = Object.assign({}, DEFAULTS, { updatedAt: new Date().toISOString() });
    await DB.setConfig(cfg);
    return cfg;
  }

  async function getEffectiveQuota(accountId) {
    const [cfg, account] = await Promise.all([
      get(),
      accountId ? Auth._getAccountById(accountId) : null
    ]);
    
    return {
      kbQuotaMB: (account && account.kbQuotaMB != null) ? account.kbQuotaMB : cfg.defaultKbQuotaMB,
      projectQuota: (account && account.projectQuota != null) ? account.projectQuota : cfg.defaultProjectQuota
    };
  }

  async function setAccountOverride(accountId, field, value) {
    if (!accountId) throw new Error('accountId required');
    return Auth.updateAccountOverrides(accountId, { [field]: value });
  }

  return {
    DEFAULTS,
    get,
    update,
    reset,
    getEffectiveQuota,
    setAccountOverride
  };
})();
