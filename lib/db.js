import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// In production (Vercel), use /tmp which is writable
// In development, use local project directory
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/yoursocials.db'
  : path.join(process.cwd(), 'yoursocials.db');

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  setupSchema(_db);
  return _db;
}

function setupSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT UNIQUE NOT NULL,
      name       TEXT,
      image      TEXT,
      role       TEXT NOT NULL DEFAULT 'member',
      job_title  TEXT,
      coins      INTEGER NOT NULL DEFAULT 0,
      streak     INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name          TEXT NOT NULL,
      contact_name  TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      industry      TEXT,
      notes         TEXT,
      status        TEXT NOT NULL DEFAULT 'active',
      created_by    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      title           TEXT NOT NULL,
      description     TEXT,
      status          TEXT NOT NULL DEFAULT 'todo',
      priority        TEXT NOT NULL DEFAULT 'P3',
      owner_id        TEXT,
      client_id       TEXT,
      deadline        TEXT,
      estimated_hours REAL,
      actual_hours    REAL,
      quality_rating  INTEGER,
      ai_checklist    TEXT DEFAULT '[]',
      created_by      TEXT,
      completed_at    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS followups (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      client_id   TEXT,
      subject     TEXT NOT NULL,
      body        TEXT,
      due_date    TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',
      assigned_to TEXT,
      created_by  TEXT,
      sent_at     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name        TEXT NOT NULL,
      emoji       TEXT NOT NULL,
      description TEXT,
      coin_cost   INTEGER NOT NULL DEFAULT 0,
      reward_type TEXT NOT NULL DEFAULT 'weekly',
      status      TEXT NOT NULL DEFAULT 'locked',
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed rewards only once
  const count = db.prepare('SELECT COUNT(*) as c FROM rewards').get();
  if (count.c === 0) {
    const insert = db.prepare(
      'INSERT INTO rewards (name, emoji, description, coin_cost, reward_type) VALUES (?,?,?,?,?)'
    );
    const seed = db.transaction(() => {
      [
        ['Team Lunch',    '🍕', 'Celebrate with a team lunch',          500,   'weekly'],
        ['Bowling Night', '🎳', 'Strike it up at the bowling alley',    800,   'weekly'],
        ['Ice Skating',   '⛸️',  'Cool off at the rink together',        800,   'weekly'],
        ['Rock Climbing', '🧗', 'Reach new heights as a team',          800,   'weekly'],
        ['Cricket Match', '🏏', 'Team vs team on the pitch',            600,   'weekly'],
        ['Gaming Night',  '🎮', 'LAN party at the office',              400,   'weekly'],
        ['Movie Night',   '🎬', 'Team movie outing',                    500,   'weekly'],
        ['Goa Trip',      '✈️',  'Grand monthly prize — Goa team trip', 13000, 'monthly'],
      ].forEach(r => insert.run(...r));
    });
    seed();
  }
}
