import { sql } from '@vercel/postgres';

export { sql };

// Run once to create all tables — called from /api/setup
export async function setupDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      name        TEXT,
      image       TEXT,
      role        TEXT NOT NULL DEFAULT 'member',
      job_title   TEXT,
      coins       INTEGER NOT NULL DEFAULT 0,
      streak      INTEGER NOT NULL DEFAULT 0,
      last_active DATE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name          TEXT NOT NULL,
      contact_name  TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      industry      TEXT,
      notes         TEXT,
      status        TEXT NOT NULL DEFAULT 'active',
      created_by    TEXT REFERENCES users(id),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title            TEXT NOT NULL,
      description      TEXT,
      status           TEXT NOT NULL DEFAULT 'todo',
      priority         TEXT NOT NULL DEFAULT 'P3',
      owner_id         TEXT REFERENCES users(id),
      client_id        TEXT REFERENCES clients(id),
      deadline         DATE,
      estimated_hours  NUMERIC(5,1),
      actual_hours     NUMERIC(5,1),
      quality_rating   INTEGER,
      ai_checklist     TEXT DEFAULT '[]',
      created_by       TEXT REFERENCES users(id),
      completed_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS followups (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      client_id    TEXT REFERENCES clients(id) ON DELETE CASCADE,
      subject      TEXT NOT NULL,
      body         TEXT,
      due_date     DATE,
      status       TEXT NOT NULL DEFAULT 'pending',
      assigned_to  TEXT REFERENCES users(id),
      created_by   TEXT REFERENCES users(id),
      sent_at      TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS rewards (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name         TEXT NOT NULL,
      emoji        TEXT NOT NULL,
      description  TEXT,
      coin_cost    INTEGER NOT NULL DEFAULT 0,
      reward_type  TEXT NOT NULL DEFAULT 'weekly',
      status       TEXT NOT NULL DEFAULT 'locked',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS badges (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name        TEXT NOT NULL,
      emoji       TEXT NOT NULL,
      description TEXT,
      condition   TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_badges (
      user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
      badge_id  TEXT REFERENCES badges(id) ON DELETE CASCADE,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, badge_id)
    )
  `;

  // Seed default rewards (idempotent)
  await sql`
    INSERT INTO rewards (name, emoji, description, coin_cost, reward_type)
    SELECT * FROM (VALUES
      ('Team Lunch',    '🍕', 'Celebrate with a team lunch',          500,   'weekly'),
      ('Bowling Night', '🎳', 'Strike it up at the bowling alley',    800,   'weekly'),
      ('Ice Skating',   '⛸️', 'Cool off at the rink together',        800,   'weekly'),
      ('Rock Climbing', '🧗', 'Reach new heights as a team',          800,   'weekly'),
      ('Cricket Match', '🏏', 'Team vs team on the pitch',            600,   'weekly'),
      ('Gaming Night',  '🎮', 'LAN party at the office',              400,   'weekly'),
      ('Movie Night',   '🎬', 'Team movie outing',                    500,   'weekly'),
      ('Goa Trip',      '✈️', 'Grand monthly prize — Goa team trip',  13000, 'monthly')
    ) AS v(name, emoji, description, coin_cost, reward_type)
    WHERE NOT EXISTS (SELECT 1 FROM rewards LIMIT 1)
  `;

  // Seed default badges
  await sql`
    INSERT INTO badges (name, emoji, description, condition)
    SELECT * FROM (VALUES
      ('First Task',     '✅', 'Complete your very first task',       'first_task'),
      ('Streak Starter', '🔥', '3-day completion streak',             'streak_3'),
      ('Week Warrior',   '⚡', '7-day completion streak',             'streak_7'),
      ('Quality King',   '⭐', '5-star quality rating 5 times',       'quality_5x5'),
      ('Deadline Slayer','🎯', 'Zero overdue tasks for a full week',  'deadline_week'),
      ('Team Player',    '🤝', 'Assign tasks to 3 different people',  'collab_3'),
      ('Century',        '💯', '100 tasks completed total',           'tasks_100'),
      ('Month Master',   '👑', '30-day streak',                       'streak_30')
    ) AS v(name, emoji, description, condition)
    WHERE NOT EXISTS (SELECT 1 FROM badges LIMIT 1)
  `;

  return { ok: true };
}
