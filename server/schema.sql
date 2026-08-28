-- Lex-Integrity Database Schema
-- Generated from Sequelize models
-- Run: psql -U postgres -d lex_integrity -f schema.sql

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================
-- TABLE: users
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================
-- TABLE: roles
-- =============================================
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE: rules
-- =============================================
CREATE TABLE IF NOT EXISTS rules (
    id SERIAL PRIMARY KEY,
    rule_code VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    regime VARCHAR(100),
    category VARCHAR(100),
    content TEXT,
    loopholes JSONB DEFAULT '[]'::jsonb,
    impacts JSONB DEFAULT '[]'::jsonb,
    sanctions JSONB DEFAULT '{}'::jsonb,
    publish_date DATE,
    source VARCHAR(200),
    pdf_url TEXT,
    slug VARCHAR(200),
    view_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    processed_at TIMESTAMP,
    processed_by VARCHAR(100),
    processing_method VARCHAR(50),
    embedding vector(768),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rules_rule_code ON rules(rule_code);
CREATE INDEX IF NOT EXISTS idx_rules_title ON rules USING GIN (to_tsvector('indonesian', title));
CREATE INDEX IF NOT EXISTS idx_rules_content ON rules USING GIN (to_tsvector('indonesian', content));
CREATE INDEX IF NOT EXISTS idx_rules_regime ON rules(regime);
CREATE INDEX IF NOT EXISTS idx_rules_category ON rules(category);
CREATE INDEX IF NOT EXISTS idx_rules_is_active ON rules(is_active);
CREATE INDEX IF NOT EXISTS idx_rules_source ON rules(source);
CREATE INDEX IF NOT EXISTS idx_rules_publish_date ON rules(publish_date);
CREATE INDEX IF NOT EXISTS idx_rules_view_count ON rules(view_count);
CREATE INDEX IF NOT EXISTS idx_rules_slug ON rules(slug);
CREATE INDEX IF NOT EXISTS idx_rules_embedding ON rules USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =============================================
-- TABLE: rule_chunks (for adaptive chunking embeddings)
-- =============================================
CREATE TABLE IF NOT EXISTS rule_chunks (
    id SERIAL PRIMARY KEY,
    rule_code VARCHAR(100) NOT NULL REFERENCES rules(rule_code) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(768),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rule_code, chunk_text)
);

CREATE INDEX IF NOT EXISTS idx_rule_chunks_rule_code ON rule_chunks(rule_code);
CREATE INDEX IF NOT EXISTS idx_rule_chunks_embedding ON rule_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_rule_chunks_metadata ON rule_chunks USING GIN (chunk_metadata);

-- =============================================
-- TABLE: analytics
-- =============================================
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES rules(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_rule_id ON analytics(rule_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);

-- =============================================
-- DEFAULT ROLES (seed)
-- =============================================
INSERT INTO roles (name, permissions) VALUES
('admin', '["view_dashboard","view_rules","create_rules","edit_rules","delete_rules","analyze_rules","export_data","manage_backup","manage_users","manage_roles"]'),
('analyst', '["view_dashboard","view_rules","create_rules","edit_rules","analyze_rules","export_data"]'),
('user', '["view_dashboard","view_rules","analyze_rules","export_data"]')
ON CONFLICT (name) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    created_at = CURRENT_TIMESTAMP;

-- =============================================
-- DEFAULT ADMIN USER (seed)
-- Password: admin / admin123, superadmin / gedangbosok
-- =============================================
INSERT INTO users (username, email, password, role, created_at) VALUES
('admin', 'admin@lex.local', '$2a$10$MpsmwaA3D6jObFdIruLaDugBWGxhFXSKVjzZrasPoj3BumMAFa9te', 'admin', CURRENT_TIMESTAMP),
('superadmin', 'superadmin@lex.local', '$2a$10$I/cQNMrKy41p6c7xwyO7UOd/6VUm3LRoRaY.Pr88BHR4FR7ejpFq.', 'superadmin', CURRENT_TIMESTAMP)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    updated_at = CURRENT_TIMESTAMP;

-- =============================================
-- VIEW: rule_search (for full-text search)
-- =============================================
CREATE OR REPLACE VIEW rule_search AS
SELECT 
    id,
    rule_code,
    title,
    regime,
    category,
    content,
    source,
    publish_date,
    is_active,
    to_tsvector('indonesian', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(regime, '') || ' ' || COALESCE(category, '')) AS search_vector
FROM rules
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_rule_search_vector ON rule_search USING GIN (search_vector);

-- =============================================
-- FUNCTION: update_updated_at_column
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for rules table
DROP TRIGGER IF EXISTS update_rules_updated_at ON rules;
CREATE TRIGGER update_rules_updated_at
    BEFORE UPDATE ON rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for rule_chunks table
DROP TRIGGER IF EXISTS update_rule_chunks_updated_at ON rule_chunks;
CREATE TRIGGER update_rule_chunks_updated_at
    BEFORE UPDATE ON rule_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- GRANTS (adjust as needed)
-- =============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- =============================================
-- NOTES
-- =============================================
-- 1. Run migrations via Sequelize: npx sequelize-cli db:migrate
-- 2. Load Jogja data: node src/scripts/loadJogjaJdih.js
-- 3. For production, use proper password hashing (bcrypt)
-- 4. Adjust GRANTS for your deployment user