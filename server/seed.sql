-- Lex-Integrity Minimal Seed Data
-- Run after schema.sql: psql -U postgres -d lex_integrity -f seed.sql

-- =============================================
-- DEFAULT ROLES
-- =============================================
INSERT INTO roles (name, permissions) VALUES
('admin', '["view_dashboard","view_rules","create_rules","edit_rules","delete_rules","analyze_rules","export_data","manage_backup","manage_users","manage_roles"]'),
('analyst', '["view_dashboard","view_rules","create_rules","edit_rules","analyze_rules","export_data"]'),
('user', '["view_dashboard","view_rules","analyze_rules","export_data"]')
ON CONFLICT (name) DO UPDATE SET
    permissions = EXCLUDED.permissions;

-- =============================================
-- DEFAULT USERS
-- Passwords are bcrypt hashes:
-- admin / admin123
-- superadmin / gedangbosok
-- =============================================
INSERT INTO users (username, email, password, role, created_at) VALUES
('admin', 'admin@lex.local', '$2a$10$MpsmwaA3D6jObFdIruLaDugBWGxhFXSKVjzZrasPoj3BumMAFa9te', 'admin', CURRENT_TIMESTAMP),
('superadmin', 'superadmin@lex.local', '$2a$10$I/cQNMrKy41p6c7xwyO7UOd/6VUm3LRoRaY.Pr88BHR4FR7ejpFq.', 'superadmin', CURRENT_TIMESTAMP)
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    role = EXCLUDED.role;

-- =============================================
-- NOTE: Update passwords with real bcrypt hashes
-- Use Node to generate:
-- node -e "const bcrypt=require('bcryptjs');console.log(bcrypt.hashSync('admin123',10))"
-- node -e "const bcrypt=require('bcryptjs');console.log(bcrypt.hashSync('gedangbosok',10))"