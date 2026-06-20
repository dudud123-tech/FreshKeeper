CREATE TABLE IF NOT EXISTS receipt_feedback_user_excluded_items (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  candidate_index INTEGER NOT NULL,
  name_masked TEXT NOT NULL,
  name_hash TEXT NOT NULL,
  FOREIGN KEY (receipt_id) REFERENCES receipt_feedback(id)
);

CREATE INDEX IF NOT EXISTS idx_receipt_feedback_user_excluded_items_receipt_id
ON receipt_feedback_user_excluded_items(receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_feedback_user_excluded_items_name_hash
ON receipt_feedback_user_excluded_items(name_hash);
