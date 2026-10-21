'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

const Op = Sequelize.Op || {
  eq: Symbol.for('eq'),
  ne: Symbol.for('ne'),
  like: Symbol.for('like'),
  iLike: Symbol.for('iLike'),
  in: Symbol.for('in'),
  notIn: Symbol.for('notIn'),
  gt: Symbol.for('gt'),
  gte: Symbol.for('gte'),
  lt: Symbol.for('lt'),
  lte: Symbol.for('lte'),
  or: Symbol.for('or'),
  and: Symbol.for('and'),
  between: Symbol.for('between')
};

// -------------------------------------------------------------
// 1. MySQL Sequelize Configuration (untuk Mac & Server)
// -------------------------------------------------------------
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS !== undefined ? process.env.DB_PASS : null;
const dbName = process.env.DB_NAME || 'db_nomor_surat';
const dbPort = process.env.DB_PORT || 3306;

const realSequelize = new Sequelize(dbName, dbUser, dbPass, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: false,
  dialectOptions: {
    connectTimeout: 1500
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 3000,
    idle: 10000
  }
});

let isMysqlConnected = false;
const realModels = {};

// Load model Sequelize asli
const modelFiles = [
  'user.js',
  'jenissurat.js',
  'unitkerja.js',
  'klasifikasi.js',
  'suratmasuk.js',
  'tamu.js',
  'transaksiberkas.js',
  'transaksisurat.js'
];

for (const file of modelFiles) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    try {
      const modelDef = require(filePath);
      if (typeof modelDef === 'function') {
        const model = modelDef(realSequelize, Sequelize.DataTypes);
        realModels[model.name] = model;
      }
    } catch (e) {
      console.warn(`[AI Studio] Warning loading model ${file}:`, e.message);
    }
  }
}

// Buat relasi (associations) untuk Sequelize asli
Object.keys(realModels).forEach(modelName => {
  if (realModels[modelName].associate) {
    realModels[modelName].associate(realModels);
  }
});

// -------------------------------------------------------------
// 2. In-Memory Standalone Fallback (untuk AI Studio Preview)
// -------------------------------------------------------------
const SEED_FILE = path.join(__dirname, '../seed_data.json');
let store = {
  users: [],
  jenissurats: [],
  unitkerjas: [],
  klasifikasis: [],
  suratmasuks: [],
  tamus: [],
  transaksiberkas: [],
  transaksisurats: []
};

try {
  if (fs.existsSync(SEED_FILE)) {
    const raw = fs.readFileSync(SEED_FILE, 'utf8');
    store = JSON.parse(raw);
  }
} catch (err) {
  console.warn('[AI Studio] Could not load seed_data.json:', err.message);
}

function persistStore() {
  try {
    fs.writeFileSync(SEED_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {}
}

function matchWhere(item, where) {
  if (!where) return true;
  const symbols = Object.getOwnPropertySymbols(where);
  for (const sym of symbols) {
    if (sym === Op.or || String(sym).includes('or')) {
      const orList = where[sym];
      if (Array.isArray(orList)) {
        if (!orList.some(condition => matchWhere(item, condition))) return false;
      }
    } else if (sym === Op.and || String(sym).includes('and')) {
      const andList = where[sym];
      if (Array.isArray(andList)) {
        if (!andList.every(condition => matchWhere(item, condition))) return false;
      }
    }
  }

  for (const [key, expected] of Object.entries(where)) {
    const itemVal = item[key];
    if (expected === null || expected === undefined) {
      if (itemVal !== null && itemVal !== undefined) return false;
      continue;
    }

    if (typeof expected === 'object' && expected !== null && !Array.isArray(expected)) {
      const expSymbols = Object.getOwnPropertySymbols(expected);
      for (const opSym of expSymbols) {
        const val = expected[opSym];
        if (opSym === Op.like || opSym === Op.iLike || String(opSym).includes('like')) {
          const pattern = String(val).replace(/%/g, '.*');
          const regex = new RegExp(`^${pattern}$`, 'i');
          if (!regex.test(String(itemVal || ''))) return false;
        } else if (opSym === Op.eq) {
          if (itemVal != val) return false;
        } else if (opSym === Op.ne) {
          if (itemVal == val) return false;
        } else if (opSym === Op.gt) {
          if (!(itemVal > val)) return false;
        } else if (opSym === Op.gte) {
          if (!(itemVal >= val)) return false;
        } else if (opSym === Op.lt) {
          if (!(itemVal < val)) return false;
        } else if (opSym === Op.lte) {
          if (!(itemVal <= val)) return false;
        } else if (opSym === Op.in || String(opSym).includes('in')) {
          if (!Array.isArray(val) || !val.includes(itemVal)) return false;
        } else if (opSym === Op.between || String(opSym).includes('between')) {
          if (!Array.isArray(val) || itemVal < val[0] || itemVal > val[1]) return false;
        }
      }
      for (const [opKey, val] of Object.entries(expected)) {
        if (opKey === 'like' || opKey.includes('like')) {
          const pattern = String(val).replace(/%/g, '.*');
          const regex = new RegExp(`^${pattern}$`, 'i');
          if (!regex.test(String(itemVal || ''))) return false;
        }
      }
      continue;
    }

    if (Array.isArray(expected)) {
      if (!expected.includes(itemVal)) return false;
      continue;
    }

    if (String(itemVal) !== String(expected) && itemVal !== expected) {
      return false;
    }
  }

  return true;
}

function createModelRecord(modelName, rawItem) {
  const item = { ...rawItem };
  const record = {
    ...item,
    dataValues: item,
    get: function(key) {
      return key ? this[key] : this.dataValues;
    },
    toJSON: function() {
      return { ...this.dataValues };
    },
    update: async function(changes) {
      Object.assign(item, changes);
      item.updatedAt = new Date().toISOString();
      Object.assign(this, item);
      this.dataValues = item;
      persistStore();
      return this;
    },
    save: async function() {
      item.updatedAt = new Date().toISOString();
      persistStore();
      return this;
    },
    destroy: async function() {
      const list = store[modelName];
      const idx = list.findIndex(r => r.id === item.id);
      if (idx !== -1) {
        list.splice(idx, 1);
        persistStore();
      }
      return this;
    }
  };
  return record;
}

function createInMemoryModel(tableName, modelName) {
  return {
    name: modelName,
    tableName: tableName,
    rawList: () => store[tableName] || [],
    findAll: async function(options = {}) {
      const list = store[tableName] || [];
      let results = list.filter(item => matchWhere(item, options.where));

      if (options.order && Array.isArray(options.order)) {
        results.sort((a, b) => {
          for (const ord of options.order) {
            let col = ord[0];
            let dir = (ord[1] || 'ASC').toUpperCase();
            let valA = a[col];
            let valB = b[col];
            if (valA === valB) continue;
            if (valA === null || valA === undefined) return dir === 'ASC' ? 1 : -1;
            if (valB === null || valB === undefined) return dir === 'ASC' ? -1 : 1;
            if (valA < valB) return dir === 'ASC' ? -1 : 1;
            if (valA > valB) return dir === 'ASC' ? 1 : -1;
          }
          return 0;
        });
      }

      const offset = options.offset || 0;
      if (options.limit !== undefined) {
        results = results.slice(offset, offset + options.limit);
      } else if (offset > 0) {
        results = results.slice(offset);
      }

      const records = results.map(item => {
        const rec = createModelRecord(tableName, item);
        hydrateIncludes(rec, options.include);
        return rec;
      });

      return records;
    },
    findAndCountAll: async function(options = {}) {
      const list = store[tableName] || [];
      const filtered = list.filter(item => matchWhere(item, options.where));
      const count = filtered.length;
      let results = [...filtered];

      if (options.order && Array.isArray(options.order)) {
        results.sort((a, b) => {
          for (const ord of options.order) {
            let col = ord[0];
            let dir = (ord[1] || 'ASC').toUpperCase();
            let valA = a[col];
            let valB = b[col];
            if (valA === valB) continue;
            if (valA === null || valA === undefined) return dir === 'ASC' ? 1 : -1;
            if (valB === null || valB === undefined) return dir === 'ASC' ? -1 : 1;
            if (valA < valB) return dir === 'ASC' ? -1 : 1;
            if (valA > valB) return dir === 'ASC' ? 1 : -1;
          }
          return 0;
        });
      }

      const offset = options.offset || 0;
      if (options.limit !== undefined) {
        results = results.slice(offset, offset + options.limit);
      } else if (offset > 0) {
        results = results.slice(offset);
      }

      const rows = results.map(item => {
        const rec = createModelRecord(tableName, item);
        hydrateIncludes(rec, options.include);
        return rec;
      });

      return { count, rows };
    },
    findOne: async function(options = {}) {
      const list = store[tableName] || [];
      const match = list.find(item => matchWhere(item, options.where));
      if (!match) return null;
      const rec = createModelRecord(tableName, match);
      hydrateIncludes(rec, options.include);
      return rec;
    },
    findByPk: async function(id, options = {}) {
      const list = store[tableName] || [];
      const match = list.find(item => String(item.id) === String(id));
      if (!match) return null;
      const rec = createModelRecord(tableName, match);
      hydrateIncludes(rec, options.include);
      return rec;
    },
    create: async function(values) {
      const list = store[tableName] || (store[tableName] = []);
      const maxId = list.reduce((m, item) => Math.max(m, Number(item.id) || 0), 0);
      const newId = maxId + 1;
      const now = new Date().toISOString();
      const newRecord = {
        id: newId,
        ...values,
        createdAt: values.createdAt || now,
        updatedAt: values.updatedAt || now
      };
      list.push(newRecord);
      persistStore();
      return createModelRecord(tableName, newRecord);
    },
    update: async function(values, options = {}) {
      const list = store[tableName] || [];
      let count = 0;
      for (const item of list) {
        if (matchWhere(item, options.where)) {
          Object.assign(item, values);
          item.updatedAt = new Date().toISOString();
          count++;
        }
      }
      if (count > 0) persistStore();
      return [count];
    },
    destroy: async function(options = {}) {
      const list = store[tableName] || [];
      const before = list.length;
      store[tableName] = list.filter(item => !matchWhere(item, options.where));
      const deleted = before - store[tableName].length;
      if (deleted > 0) persistStore();
      return deleted;
    },
    count: async function(options = {}) {
      const list = store[tableName] || [];
      return list.filter(item => matchWhere(item, options.where)).length;
    }
  };
}

function hydrateIncludes(record, includes) {
  if (!includes || !Array.isArray(includes)) return;
  for (const inc of includes) {
    const incName = inc.name || (typeof inc === 'string' ? inc : (inc.model && inc.model.name));
    const as = inc.as;

    if (incName === 'JenisSurat') {
      const match = store.jenissurats.find(j => j.id == record.jenisId);
      record.JenisSurat = match ? createModelRecord('jenissurats', match) : null;
    } else if (incName === 'Klasifikasi') {
      const match = store.klasifikasis.find(k => k.id == record.klasifikasiId);
      record.Klasifikasi = match ? createModelRecord('klasifikasis', match) : null;
    } else if (incName === 'UnitKerja') {
      const match = store.unitkerjas.find(u => u.id == record.unitId);
      record.UnitKerja = match ? createModelRecord('unitkerjas', match) : null;
    } else if (incName === 'User') {
      const match = store.users.find(u => u.id == record.userId);
      record.User = match ? createModelRecord('users', match) : null;
    } else if (incName === 'Tamu') {
      const match = store.tamus.find(t => t.id == record.tamuId);
      const rec = match ? createModelRecord('tamus', match) : null;
      record.Tamu = rec;
      if (as) record[as] = rec;
      record.tamu = rec;
    } else if (incName === 'TransaksiBerkas') {
      const matches = store.transaksiberkas.filter(tb => tb.tamuId == record.id);
      record.TransaksiBerkas = matches.map(m => createModelRecord('transaksiberkas', m));
    }
  }
}

const inMemoryModels = {
  User: createInMemoryModel('users', 'User'),
  JenisSurat: createInMemoryModel('jenissurats', 'JenisSurat'),
  UnitKerja: createInMemoryModel('unitkerjas', 'UnitKerja'),
  Klasifikasi: createInMemoryModel('klasifikasis', 'Klasifikasi'),
  SuratMasuk: createInMemoryModel('suratmasuks', 'SuratMasuk'),
  Tamu: createInMemoryModel('tamus', 'Tamu'),
  TransaksiBerkas: createInMemoryModel('transaksiberkas', 'TransaksiBerkas'),
  TransaksiSurat: createInMemoryModel('transaksisurats', 'TransaksiSurat')
};

// -------------------------------------------------------------
// 3. Model Proxy (Dynamic Routing to MySQL vs Fallback)
// -------------------------------------------------------------
function makeModelProxy(modelName) {
  return new Proxy({}, {
    get(target, prop) {
      const activeModel = (isMysqlConnected && realModels[modelName]) ? realModels[modelName] : inMemoryModels[modelName];
      if (!activeModel) return undefined;
      const val = activeModel[prop];
      if (typeof val === 'function') {
        return val.bind(activeModel);
      }
      return val;
    }
  });
}

const db = {
  User: makeModelProxy('User'),
  JenisSurat: makeModelProxy('JenisSurat'),
  UnitKerja: makeModelProxy('UnitKerja'),
  Klasifikasi: makeModelProxy('Klasifikasi'),
  SuratMasuk: makeModelProxy('SuratMasuk'),
  Tamu: makeModelProxy('Tamu'),
  TransaksiBerkas: makeModelProxy('TransaksiBerkas'),
  TransaksiSurat: makeModelProxy('TransaksiSurat'),

  sequelize: {
    sync: async (options = {}) => {
      try {
        await realSequelize.authenticate();
        isMysqlConnected = true;
        console.log(`[Database] Terhubung ke MySQL lokal (${dbHost}:${dbPort}/${dbName})`);
        return await realSequelize.sync(options);
      } catch (err) {
        isMysqlConnected = false;
        console.log(`[Database] MySQL tidak aktif / tidak terjangkau (${err.message}). Menggunakan mode standalone.`);
        return Promise.resolve();
      }
    },
    authenticate: async () => {
      try {
        await realSequelize.authenticate();
        isMysqlConnected = true;
        return true;
      } catch (err) {
        isMysqlConnected = false;
        return false;
      }
    },
    close: async () => {
      if (isMysqlConnected) {
        return await realSequelize.close();
      }
      return Promise.resolve();
    },
    query: (...args) => {
      if (isMysqlConnected) {
        return realSequelize.query(...args);
      }
      return Promise.resolve([]);
    }
  },
  Sequelize: {
    ...Sequelize,
    Op: Op
  }
};

module.exports = db;
