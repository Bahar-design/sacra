import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("sacra_offline.db");

// Creates the local table on first app launch (user_id scopes prayers per account)
export function initOfflineDB() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS offline_prayers (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      body        TEXT NOT NULL,
      religion    TEXT,
      tradition   TEXT,
      source      TEXT,
      language    TEXT,
      occasion    TEXT,
      mood        TEXT,
      user_id     TEXT DEFAULT '',
      saved_at    INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
  // Migrate existing installs: add user_id column if missing
  try {
    db.execSync("ALTER TABLE offline_prayers ADD COLUMN user_id TEXT DEFAULT ''");
  } catch {
    // Column already exists — safe to ignore
  }
}

// Save prayer to device — scoped to the signed-in user
export function saveToDevice(prayer: any, userId: string) {
  db.runSync(
    `INSERT OR REPLACE INTO offline_prayers
      (id,title,body,religion,tradition,source,language,occasion,mood,user_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      prayer.id,
      prayer.title,
      prayer.body,
      prayer.religions?.name || prayer.religion_id || "",
      prayer.tradition || "",
      prayer.source || "",
      prayer.language || "en",
      JSON.stringify(prayer.occasion || []),
      JSON.stringify(prayer.mood || []),
      userId,
    ],
  );
}

// Remove prayer — only affects this user's collection
export function removeFromDevice(prayerId: string, userId: string) {
  db.runSync("DELETE FROM offline_prayers WHERE id = ? AND user_id = ?", [prayerId, userId]);
}

// Get all saved prayers for this user — works with zero connectivity
export function getAllOfflinePrayers(userId: string): any[] {
  return db.getAllSync(
    "SELECT * FROM offline_prayers WHERE user_id = ? ORDER BY saved_at DESC",
    [userId],
  );
}

// Check instantly if a prayer is saved by this user
export function isPrayerSaved(prayerId: string, userId: string): boolean {
  const row = db.getFirstSync(
    "SELECT id FROM offline_prayers WHERE id = ? AND user_id = ?",
    [prayerId, userId],
  );
  return !!row;
}

// Offline text search — scoped to this user
export function searchOffline(query: string, userId: string): any[] {
  return db.getAllSync(
    `SELECT * FROM offline_prayers WHERE (title LIKE ? OR body LIKE ?) AND user_id = ? ORDER BY saved_at DESC`,
    [`%${query}%`, `%${query}%`, userId],
  );
}

// Clear one user's cached prayers (used only when needed, not on every sign-out)
export function clearUserPrayers(userId: string) {
  db.runSync("DELETE FROM offline_prayers WHERE user_id = ?", [userId]);
}

// Admin / test utility
export function clearAllOfflinePrayers() {
  db.runSync("DELETE FROM offline_prayers");
}
