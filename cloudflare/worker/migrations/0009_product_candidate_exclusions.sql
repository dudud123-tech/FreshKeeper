CREATE TABLE IF NOT EXISTS product_candidate_exclusions (
  subject_key TEXT NOT NULL,
  account_id TEXT,
  client_id TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (subject_key, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_product_candidate_exclusions_client
ON product_candidate_exclusions(client_id, normalized_name);
