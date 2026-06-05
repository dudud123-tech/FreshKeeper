CREATE TABLE IF NOT EXISTS ai_receipt_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  app_version TEXT,
  provider TEXT,
  model TEXT,
  fallback_from TEXT,
  ok INTEGER NOT NULL,
  error TEXT,
  detail TEXT,
  line_count INTEGER NOT NULL DEFAULT 0,
  local_candidate_count INTEGER NOT NULL DEFAULT 0,
  ai_candidate_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ai_receipt_request_lines (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  line_index INTEGER NOT NULL,
  text_masked TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES ai_receipt_requests(id)
);

CREATE TABLE IF NOT EXISTS ai_receipt_local_candidates (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  candidate_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  name_hash TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES ai_receipt_requests(id)
);

CREATE TABLE IF NOT EXISTS ai_receipt_ai_candidates (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  candidate_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  name_hash TEXT NOT NULL,
  confidence REAL,
  reason TEXT,
  FOREIGN KEY (request_id) REFERENCES ai_receipt_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_receipt_requests_created_at ON ai_receipt_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_receipt_requests_provider ON ai_receipt_requests(provider);
CREATE INDEX IF NOT EXISTS idx_ai_receipt_request_lines_request_id ON ai_receipt_request_lines(request_id);
CREATE INDEX IF NOT EXISTS idx_ai_receipt_ai_candidates_request_id ON ai_receipt_ai_candidates(request_id);
