-- ─────────────────────────────────────────────────────────────────────────
-- Portfolio Manager — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Portfolios table
CREATE TABLE IF NOT EXISTS public.portfolios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug        TEXT        NOT NULL,
  data        JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portfolios_user_id_unique UNIQUE (user_id),
  CONSTRAINT portfolios_slug_unique    UNIQUE (slug),
  CONSTRAINT portfolios_slug_format    CHECK  (slug ~ '^[a-z0-9][a-z0-9_-]{1,58}[a-z0-9]$')
);

-- 2. Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portfolios_set_updated_at ON public.portfolios;
CREATE TRIGGER portfolios_set_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Enable Row-Level Security
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- 4. Public can read any portfolio (needed for /portfolio/:slug pages)
DROP POLICY IF EXISTS "public_read" ON public.portfolios;
CREATE POLICY "public_read"
  ON public.portfolios FOR SELECT
  USING (true);

-- 5. Authenticated user can insert their own row
DROP POLICY IF EXISTS "owner_insert" ON public.portfolios;
CREATE POLICY "owner_insert"
  ON public.portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Authenticated user can update their own row
DROP POLICY IF EXISTS "owner_update" ON public.portfolios;
CREATE POLICY "owner_update"
  ON public.portfolios FOR UPDATE
  USING (auth.uid() = user_id);

-- 7. Authenticated user can delete their own row
DROP POLICY IF EXISTS "owner_delete" ON public.portfolios;
CREATE POLICY "owner_delete"
  ON public.portfolios FOR DELETE
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- AFTER RUNNING THIS SQL:
--  • Go to Supabase → Authentication → Settings
--  • Set "Email Confirm" to DISABLED (so users log in immediately after signup)
--  • Optionally enable Google / GitHub OAuth for one-click login
-- ─────────────────────────────────────────────────────────────────────────
