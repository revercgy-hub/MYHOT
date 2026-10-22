-- Private, immutable Gold review imports. This workflow is separate from articles/publications.
CREATE TABLE gold_review_batches (
  batch_hash       text PRIMARY KEY CHECK (batch_hash ~ '^[a-f0-9]{64}$'),
  manifest_sha256  text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  payload_sha256   text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  schema_version   text NOT NULL,
  manifest_meta    jsonb NOT NULL,
  candidate_count  integer NOT NULL CHECK (candidate_count > 0 AND candidate_count <= 500),
  imported_by      text NOT NULL,
  imported_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gold_review_cases (
  batch_hash             text NOT NULL REFERENCES gold_review_batches(batch_hash) ON DELETE CASCADE,
  case_id                text NOT NULL,
  candidate_metadata     jsonb NOT NULL,
  body_zh_snapshot       text NOT NULL DEFAULT '',
  body_original_snapshot text NOT NULL DEFAULT '',
  content_hash           text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  body_sha256            text NOT NULL CHECK (body_sha256 ~ '^[a-f0-9]{64}$'),
  source_article_id      text,
  source_revision        integer,
  human_status           text NOT NULL CHECK (human_status IN ('needs_review', 'user_confirmed')),
  decision               text CHECK (decision IN ('select', 'reject', 'either')),
  confirmed_by           text,
  confirmed_at           timestamptz,
  imported_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_hash, case_id),
  CHECK ((source_article_id IS NULL) = (source_revision IS NULL)),
  CHECK (length(body_zh_snapshot) > 0 OR length(body_original_snapshot) > 0),
  CHECK (NOT (length(body_zh_snapshot) > 0 AND length(body_original_snapshot) > 0)),
  CHECK (
    (human_status = 'needs_review' AND decision IS NULL AND confirmed_by IS NULL AND confirmed_at IS NULL)
    OR
    (human_status = 'user_confirmed' AND decision IS NOT NULL AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
  )
);

CREATE INDEX gold_review_cases_status_idx ON gold_review_cases (batch_hash, human_status, case_id);

CREATE TABLE gold_review_idempotency (
  batch_hash      text NOT NULL REFERENCES gold_review_batches(batch_hash) ON DELETE CASCADE,
  actor           text NOT NULL,
  request_id      text NOT NULL,
  payload_sha256  text NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  response        jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_hash, actor, request_id)
);
