import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    ensureDataDir();
    const client = createClient({
      url: `file:${path.join(DATA_DIR, 'mindfulness.db')}`,
    });
    _db = drizzle(client, { schema });
    // Schema is managed by Drizzle push — run `npm run db:push` once
  }
  return _db;
}

// Initialize DB schema inline (no migration files needed for local MVP)
export async function initDb() {
  const db = getDb();
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        checkin_mood INTEGER NOT NULL,
        checkin_tension INTEGER NOT NULL,
        checkin_self_critical INTEGER NOT NULL,
        checkin_intent TEXT NOT NULL,
        checkin_last_outcome TEXT,
        checkin_free_text TEXT,
        risk_level TEXT NOT NULL,
        patterns TEXT NOT NULL,
        action TEXT NOT NULL,
        recommended_mode TEXT NOT NULL,
        supervisor_message TEXT NOT NULL,
        guidance_duration INTEGER NOT NULL,
        guidance_mode TEXT NOT NULL,
        guidance_text TEXT NOT NULL,
        guidance_is_preset INTEGER NOT NULL,
        post_felt_better INTEGER,
        post_would_continue INTEGER,
        post_notes TEXT,
        summary TEXT
      )
    `);
  } catch (e) {
    console.warn('DB sessions init warning:', e);
  }

  // Add reflection columns (may already exist on pre-existing DBs — ignore errors)
  for (const col of [
    'ALTER TABLE sessions ADD COLUMN reflection_profile TEXT',
    'ALTER TABLE sessions ADD COLUMN reflection_summary TEXT',
  ]) {
    try { await db.run(col); } catch { /* column exists */ }
  }

  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_memory (
        user_id TEXT PRIMARY KEY,
        memory TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  } catch (e) {
    console.warn('DB user_memory init warning:', e);
  }

  return db;
}
