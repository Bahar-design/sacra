import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("sacra_offline.db");

// Creates the local table on first app launch
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
      saved_at    INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
}

// Save prayer to device — called when user taps Save
export function saveToDevice(prayer: any) {
  db.runSync(
    `INSERT OR REPLACE INTO offline_prayers
      (id,title,body,religion,tradition,source,language,occasion,mood)
      VALUES (?,?,?,?,?,?,?,?,?)`,
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
    ],
  );
}

// Remove prayer from local storage
export function removeFromDevice(prayerId: string) {
  db.runSync("DELETE FROM offline_prayers WHERE id = ?", [prayerId]);
}

// Get all saved prayers — works with zero connectivity
export function getAllOfflinePrayers(): any[] {
  return db.getAllSync("SELECT * FROM offline_prayers ORDER BY saved_at DESC");
}

// Check instantly if a prayer is saved — no network needed
export function isPrayerSaved(prayerId: string): boolean {
  const row = db.getFirstSync("SELECT id FROM offline_prayers WHERE id = ?", [
    prayerId,
  ]);
  return !!row;
}

// Offline text search — works without internet
export function searchOffline(query: string): any[] {
  return db.getAllSync(
    `SELECT * FROM offline_prayers WHERE title LIKE ? OR body LIKE ? ORDER BY saved_at DESC`,
    [`%${query}%`, `%${query}%`],
  );
}

// Clear all saved prayers — called on sign out so the next user starts fresh
export function clearAllOfflinePrayers() {
  db.runSync("DELETE FROM offline_prayers");
}
