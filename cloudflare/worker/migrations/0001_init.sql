CREATE TABLE IF NOT EXISTS receipt_feedback (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  app_version TEXT,
  parser_version TEXT,
  device_locale TEXT,
  store_hint TEXT,
  line_count INTEGER NOT NULL DEFAULT 0,
  selected_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ocr_feedback_lines (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  text_masked TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  selected INTEGER NOT NULL,
  x REAL,
  y REAL,
  width REAL,
  height REAL,
  FOREIGN KEY (receipt_id) REFERENCES receipt_feedback(id)
);

CREATE INDEX IF NOT EXISTS idx_ocr_feedback_lines_receipt_id ON ocr_feedback_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_ocr_feedback_lines_selected ON ocr_feedback_lines(selected);
CREATE INDEX IF NOT EXISTS idx_ocr_feedback_lines_text_hash ON ocr_feedback_lines(text_hash);
