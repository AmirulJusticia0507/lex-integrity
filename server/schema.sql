-- ============================================================
-- Schema Database PostgreSQL - Lex-Integrity
-- Database: lex_integrity
-- ============================================================

CREATE TABLE IF NOT EXISTS rules (
    id                SERIAL PRIMARY KEY,
    rule_code         VARCHAR(100) UNIQUE NOT NULL,
    title             VARCHAR(500) NOT NULL,
    regime            VARCHAR(100),
    category          VARCHAR(50),
    content           TEXT,
    derived_rules     JSONB DEFAULT '[]'::jsonb,
    is_active         BOOLEAN DEFAULT TRUE,
    publish_date      DATE,
    source            VARCHAR(255),
    pdf_url           VARCHAR(500),
    loopholes         JSONB DEFAULT '[]'::jsonb,
    impacts           JSONB DEFAULT '[]'::jsonb,
    sanctions         JSONB DEFAULT '{"administrative": "", "criminal": ""}'::jsonb,
    view_count        INTEGER DEFAULT 0,
    confidence_score  DOUBLE PRECISION DEFAULT 0.85,
    processed_at      TIMESTAMPTZ,
    processed_by      VARCHAR(100),
    processing_method VARCHAR(50),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(100) UNIQUE NOT NULL,
    email      VARCHAR(200) UNIQUE NOT NULL,
    password   VARCHAR(255) NOT NULL,
    role       VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics (
    id          SERIAL PRIMARY KEY,
    event_type  VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   INTEGER,
    user_id     INTEGER,
    metadata    JSONB,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Index untuk mempercepat pencarian & filter
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rules_regime     ON rules (regime);
CREATE INDEX IF NOT EXISTS idx_rules_category   ON rules (category);
CREATE INDEX IF NOT EXISTS idx_rules_is_active  ON rules (is_active);
CREATE INDEX IF NOT EXISTS idx_rules_created_at ON rules (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_entity ON analytics (entity_type, entity_id);

-- Full-text search untuk pencarian teks (opsional)
CREATE INDEX IF NOT EXISTS idx_rules_title_gin
    ON rules USING GIN (to_tsvector('simple', COALESCE(title, '')));
CREATE INDEX IF NOT EXISTS idx_rules_content_gin
    ON rules USING GIN (to_tsvector('simple', COALESCE(content, '')));
