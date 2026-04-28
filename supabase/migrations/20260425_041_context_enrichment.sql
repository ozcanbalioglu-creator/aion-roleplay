-- ─── P3-007: Context Enrichment ──────────────────────────────────────────────
-- Adds tenant-level company context and scenario-level role context so the AI
-- can give more realistic, company-specific conversations.
-- Architecture: persona system prompt = personality only (tenant-agnostic);
-- tenant = company-wide info; scenario = persona's role in this context.

-- Tenant company profile (structured JSONB for easy partial updates)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS context_profile JSONB DEFAULT '{}'::jsonb;

-- Scenario role context (plain text — what this persona is responsible for here)
ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS role_context TEXT;
