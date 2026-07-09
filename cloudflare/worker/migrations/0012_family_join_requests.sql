CREATE TABLE IF NOT EXISTS family_group_join_requests (
  group_code TEXT NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL,
  decided_at TEXT,
  PRIMARY KEY (group_code, account_id),
  FOREIGN KEY (group_code) REFERENCES family_groups(code),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_family_join_requests_group_status
ON family_group_join_requests(group_code, status, requested_at);

CREATE INDEX IF NOT EXISTS idx_family_join_requests_account
ON family_group_join_requests(account_id, status, requested_at);
