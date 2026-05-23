CREATE TABLE IF NOT EXISTS tasks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT NOT NULL,
  note              TEXT,
  tag               TEXT,
  estimated_minutes INTEGER,
  status            TEXT NOT NULL DEFAULT 'today' CHECK (status IN ('backlog','today','done')),
  position          REAL NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  completed_at      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_position ON tasks(status, position);

CREATE TABLE IF NOT EXISTS sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  duration_sec  INTEGER,
  ended_reason  TEXT CHECK (ended_reason IN ('stop','complete','app_quit'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_sessions_open ON sessions(task_id) WHERE ended_at IS NULL;
