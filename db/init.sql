CREATE TABLE IF NOT EXISTS app_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version BIGINT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY,
  original_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  content_type TEXT,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
