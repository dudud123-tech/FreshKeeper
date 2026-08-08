CREATE TABLE IF NOT EXISTS barcode_products (
  barcode TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  storage TEXT,
  expiry_days INTEGER,
  created_by_subject_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
