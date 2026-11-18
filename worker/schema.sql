CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  session TEXT NOT NULL,
  type TEXT NOT NULL,
  hymn INTEGER,
  path TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS events_day ON events(day);
CREATE INDEX IF NOT EXISTS events_session ON events(session);
