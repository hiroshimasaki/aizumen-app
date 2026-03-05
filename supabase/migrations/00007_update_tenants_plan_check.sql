-- Migration: update_tenants_plan_check

-- Drop the existing constraint
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_plan_check;

-- Create the new constraint that includes 'free'
ALTER TABLE public.tenants ADD CONSTRAINT tenants_plan_check CHECK (plan IN ('free', 'lite', 'plus', 'pro'));
