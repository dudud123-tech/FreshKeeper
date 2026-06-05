CREATE TABLE IF NOT EXISTS family_groups (
  code TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS family_group_items (
  group_code TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  storage TEXT,
  expiry_type TEXT,
  expiry TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_code, item_id),
  FOREIGN KEY (group_code) REFERENCES family_groups(code)
);

CREATE INDEX IF NOT EXISTS idx_family_group_items_group_code ON family_group_items(group_code);
CREATE INDEX IF NOT EXISTS idx_family_group_items_expiry ON family_group_items(expiry);
