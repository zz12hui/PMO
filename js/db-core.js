/* ==================== IndexedDB 统一封装 ==================== */
const DB = (function() {
  'use strict';

  const connections = {};

  function open(dbName, version, stores) {
    if (connections[dbName]) {
      return Promise.resolve(connections[dbName]);
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, version);
      req.onupgradeneeded = function(e) {
        const db = e.target.result;
        // create object stores and indices
        if (stores && stores.length) {
          stores.forEach(s => {
            let store;
            if (!db.objectStoreNames.contains(s.name)) {
              store = db.createObjectStore(s.name, { keyPath: s.keyPath || 'id' });
            } else {
              store = e.target.transaction.objectStore(s.name);
            }
            if (s.indices) {
              s.indices.forEach(idx => {
                if (!store.indexNames.contains(idx.name)) {
                  store.createIndex(idx.name, idx.keyPath || idx.name, idx.options || {});
                }
              });
            }
          });
        }
      };
      req.onsuccess = function(e) {
        const db = e.target.result;
        connections[dbName] = db;
        db.onclose = function() { delete connections[dbName]; };
        resolve(db);
      };
      req.onerror = function(e) { reject(e.target.error); };
      req.onblocked = function() { reject(new Error('Database blocked')); };
    });
  }

  async function getDB(dbName) {
    if (connections[dbName]) return connections[dbName];
    // If not connected, attempt to open without version change (version must match)
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = function(e) {
        const db = e.target.result;
        connections[dbName] = db;
        db.onclose = function() { delete connections[dbName]; };
        resolve(db);
      };
      req.onerror = function(e) { reject(e.target.error); };
    });
  }

  function getAll(dbName, storeName) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await getDB(dbName);
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch(e) { reject(e); }
    });
  }

  function getById(dbName, storeName, id) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await getDB(dbName);
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      } catch(e) { reject(e); }
    });
  }

  function put(dbName, storeName, obj) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await getDB(dbName);
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(obj);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch(e) { reject(e); }
    });
  }

  function del(dbName, storeName, id) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await getDB(dbName);
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch(e) { reject(e); }
    });
  }

  function count(dbName, storeName, indexName, value) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await getDB(dbName);
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        let req;
        if (indexName && value !== undefined) {
          const idx = store.index(indexName);
          req = idx.count(IDBKeyRange.only(value));
        } else {
          req = store.count();
        }
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => reject(req.error);
      } catch(e) { reject(e); }
    });
  }

  function sum(dbName, storeName, indexName, value, field) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await getDB(dbName);
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        let cursorReq;
        if (indexName && value !== undefined) {
          const idx = store.index(indexName);
          cursorReq = idx.openCursor(IDBKeyRange.only(value));
        } else {
          cursorReq = store.openCursor();
        }
        let total = 0;
        cursorReq.onsuccess = function(e) {
          const cursor = e.target.result;
          if (cursor) {
            total += (cursor.value[field] || 0);
            cursor.continue();
          } else {
            resolve(total);
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      } catch(e) { reject(e); }
    });
  }

  function clearStore(dbName, storeName) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await getDB(dbName);
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch(e) { reject(e); }
    });
  }

  // Helper: get all records matching index value
  function getAllByIndex(dbName, storeName, indexName, value) {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await getDB(dbName);
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const idx = store.index(indexName);
        const req = idx.getAll(IDBKeyRange.only(value));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch(e) { reject(e); }
    });
  }

  // Config helpers: init and read/write pm_config
  let _configDBReady = false;
  async function _ensureConfigDB() {
    if (_configDBReady) return;
    await open('pm_config', 1, [{ name: 'settings', keyPath: 'id' }]);
    _configDBReady = true;
  }

  async function getConfig() {
    await _ensureConfigDB();
    return getById('pm_config', 'settings', 'system');
  }

  async function setConfig(obj) {
    await _ensureConfigDB();
    return put('pm_config', 'settings', obj);
  }

  return {
    open,
    getDB,
    getAll,
    getById,
    getAllByIndex,
    put,
    delete: del,
    count,
    sum,
    clearStore,
    getConfig,
    setConfig
  };
})();
