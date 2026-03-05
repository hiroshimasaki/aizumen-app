-- Migration: add_trial_ends_at_column

-- Add trial_ends_at column to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- (Optional) Update existing tenants to have a default trial period
-- UPDATE public.tenants SET trial_ends_at = NOW() + INTERVAL '7 days' WHERE plan = 'free' AND trial_ends_at IS NULL;
