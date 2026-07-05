-- Run this once against your PostgreSQL database
-- e.g. psql -U your_user -d your_database -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- enables gen_random_uuid()

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    course VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for lookups by email (UNIQUE already creates one, but explicit is fine to skip)
-- CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
