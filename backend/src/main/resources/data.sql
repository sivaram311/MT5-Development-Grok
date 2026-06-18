-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS grok_dev;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS grok_dev.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE IF NOT EXISTS grok_dev.roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- User Roles join table
CREATE TABLE IF NOT EXISTS grok_dev.user_roles (
    user_id BIGINT REFERENCES grok_dev.users(id),
    role_id BIGINT REFERENCES grok_dev.roles(id),
    PRIMARY KEY (user_id, role_id)
);

-- Projects table (demo content for welcome screen)
CREATE TABLE IF NOT EXISTS grok_dev.projects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_by BIGINT REFERENCES grok_dev.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table for JWT refresh support
CREATE TABLE IF NOT EXISTS grok_dev.refresh_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES grok_dev.users(id),
    expiry_date TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE
);

-- Insert roles (safe to do in SQL)
INSERT INTO grok_dev.roles (name) VALUES ('ROLE_ADMIN') ON CONFLICT (name) DO NOTHING;
INSERT INTO grok_dev.roles (name) VALUES ('ROLE_USER') ON CONFLICT (name) DO NOTHING;

-- NOTE: 
-- - Admin user (admin/admin123) is seeded via DataSeeder.java (CommandLineRunner)
--   This guarantees the password is properly BCrypt-encoded at runtime.
-- - Projects and user_roles can be added manually or via future seed logic.
