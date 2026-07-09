ALTER TABLE family_groups ADD COLUMN owner_account_id TEXT;
ALTER TABLE family_groups ADD COLUMN last_accessed_at TEXT;
ALTER TABLE family_groups ADD COLUMN image_consent_at TEXT;
ALTER TABLE family_groups ADD COLUMN deleted_at TEXT;

UPDATE family_groups
SET last_accessed_at = COALESCE(updated_at, created_at)
WHERE last_accessed_at IS NULL;

ALTER TABLE family_group_items ADD COLUMN image_key TEXT;

CREATE TABLE IF NOT EXISTS family_group_members (
  group_code TEXT NOT NULL,
  account_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (group_code, account_id),
  FOREIGN KEY (group_code) REFERENCES family_groups(code),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_family_group_members_account
ON family_group_members(account_id, last_seen_at);

CREATE INDEX IF NOT EXISTS idx_family_groups_last_accessed
ON family_groups(last_accessed_at, deleted_at);
