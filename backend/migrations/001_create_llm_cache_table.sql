-- Migration: Create llm_cache table for caching LLM recommendation outputs
-- Created: 2025-11-20
-- Description: Stores LLM analysis results with hash key for efficient lookups

CREATE TABLE IF NOT EXISTS llm_cache (
    id SERIAL PRIMARY KEY,
    hash_key VARCHAR(64) UNIQUE NOT NULL,
    schema_name VARCHAR(255) NOT NULL,
    cloud_platform VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id TEXT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    output_json JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on hash_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_llm_cache_hash_key ON llm_cache(hash_key);

-- Create index on schema_name and cloud_platform for filtering
CREATE INDEX IF NOT EXISTS idx_llm_cache_schema_cloud ON llm_cache(schema_name, cloud_platform);

-- Create index on created_at for cache expiration management
CREATE INDEX IF NOT EXISTS idx_llm_cache_created_at ON llm_cache(created_at);

-- Add comment to table
COMMENT ON TABLE llm_cache IS 'Caches LLM recommendation outputs to reduce API calls and improve response time';

-- Add comments to important columns
COMMENT ON COLUMN llm_cache.hash_key IS 'MD5 hash of input parameters (cloud_platform, schema_name, resource_type, start_date, end_date, resource_id)';
COMMENT ON COLUMN llm_cache.output_json IS 'Cached LLM response as JSON array of recommendation objects';
COMMENT ON COLUMN llm_cache.resource_id IS 'Specific resource ID if analyzing single resource, NULL if analyzing all resources';
