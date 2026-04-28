-- Migration 019: Tenant website URL

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS website_url TEXT;
