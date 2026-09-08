const DB_NAME = "bioara_swine_demo_v1";
const DB_VERSION = 1;
const STORE_CASES = "cases";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CASES)) {
        const store = db.createObjectStore(STORE_CASES, { keyPath: "id" });
        store.createIndex("byDate", "fechaRegistro", { unique: false });
        store.createIndex("bySync", "syncStatus", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCase(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CASES, "readwrite");
    tx.objectStore(STORE_CASES).put(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listCases() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CASES, "readonly");
    const req = tx.objectStore(STORE_CASES).getAll();
    req.onsuccess = () => {
      const rows = req.result || [];
      rows.sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markAllSynced() {
  const rows = await listCases();
  const now = new Date().toISOString();
  for (const row of rows) {
    row.syncStatus = "synced";
    row.syncedAt = now;
    await saveCase(row);
  }
  return rows.length;
}
