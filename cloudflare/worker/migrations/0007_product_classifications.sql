CREATE TABLE IF NOT EXISTS product_classification_catalog (
  normalized_name TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  storage TEXT NOT NULL,
  expiry_days INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'food-safety-catalog',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_classification_preferences (
  subject_key TEXT NOT NULL,
  account_id TEXT,
  client_id TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  predicted_category TEXT,
  predicted_storage TEXT,
  predicted_expiry_days INTEGER,
  predicted_source TEXT,
  final_category TEXT NOT NULL,
  final_storage TEXT NOT NULL,
  final_expiry_days INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (subject_key, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_product_classification_preferences_name
ON product_classification_preferences(normalized_name);

CREATE INDEX IF NOT EXISTS idx_product_classification_preferences_account
ON product_classification_preferences(account_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_product_classification_catalog_category
ON product_classification_catalog(category);
