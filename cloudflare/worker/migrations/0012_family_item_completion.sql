ALTER TABLE family_group_items ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE family_group_items ADD COLUMN completed_at TEXT;

UPDATE family_group_items
SET status = 'active'
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_family_group_items_status
ON family_group_items(group_code, status, deleted);
