ALTER TABLE receipt_feedback ADD COLUMN ai_request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_receipt_feedback_ai_request_id
ON receipt_feedback(ai_request_id);

CREATE TABLE IF NOT EXISTS receipt_feedback_selected_items (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  item_index INTEGER NOT NULL,
  name_masked TEXT NOT NULL,
  name_hash TEXT NOT NULL,
  FOREIGN KEY (receipt_id) REFERENCES receipt_feedback(id)
);

CREATE INDEX IF NOT EXISTS idx_receipt_feedback_selected_items_receipt_id
ON receipt_feedback_selected_items(receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_feedback_selected_items_name_hash
ON receipt_feedback_selected_items(name_hash);
