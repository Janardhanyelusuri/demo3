-- Migration: Fix timezone issue in llm_cache timestamps
-- Created: 2025-11-21
-- Description: Convert TIMESTAMP columns to TIMESTAMPTZ to handle timezone-aware datetimes

-- Alter created_at to use timezone-aware timestamp
ALTER TABLE llm_cache
ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- Alter updated_at to use timezone-aware timestamp
ALTER TABLE llm_cache
ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Update default values
ALTER TABLE llm_cache
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE llm_cache
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
