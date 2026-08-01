CREATE INDEX IF NOT EXISTS idx_product_candidate_exclusions_name
ON product_candidate_exclusions(normalized_name, subject_key);
