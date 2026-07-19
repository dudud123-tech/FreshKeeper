CREATE TABLE IF NOT EXISTS growth_events (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  event_key TEXT NOT NULL,
  type TEXT NOT NULL,
  item_id TEXT,
  xp_delta INTEGER NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(account_id, event_key),
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_growth_events_account_created
ON growth_events(account_id, created_at);
