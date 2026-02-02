-- Migration: Add Subscription Support to Profiles (User-level subscription)
-- Description: Adds subscription tier and status tracking for coaches (SaaS model)
-- Date: 2026-02-02
-- Note: Subscription is per USER, not per Academy
--       Basic = 1 academy, Pro = multi-academy + AI features

-- ============================================
-- 1. CREATE ENUM TYPES
-- ============================================

-- Subscription tiers: beta_free (current beta users), basic (1 academy), pro (multi-academy + AI)
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('beta_free', 'basic', 'pro');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Subscription statuses for payment tracking
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'unpaid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. ADD COLUMNS TO PROFILES (not academies!)
-- ============================================

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'beta_free',
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- ============================================
-- 3. CREATE INDEX FOR QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_subscription 
  ON profiles(subscription_tier, subscription_status);

-- ============================================
-- 4. UPDATE EXISTING PROFILES
-- ============================================

-- Ensure all existing profiles are marked as beta_free and active
UPDATE profiles 
SET 
  subscription_tier = 'beta_free',
  subscription_status = 'active',
  subscription_started_at = COALESCE(subscription_started_at, created_at)
WHERE subscription_tier IS NULL OR subscription_status IS NULL;
