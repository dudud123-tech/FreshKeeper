CREATE TABLE IF NOT EXISTS product_classification_keyword_rules (
  normalized_keyword TEXT PRIMARY KEY,
  display_keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  storage TEXT NOT NULL,
  expiry_days INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_classification_keyword_priority
ON product_classification_keyword_rules(priority DESC, normalized_keyword);
