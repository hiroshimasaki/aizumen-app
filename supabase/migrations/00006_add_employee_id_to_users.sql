-- Migration: add_employee_id_to_users

-- Add employee_id column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255);

-- Create a unique constraint to ensure employee_id is unique within a tenant
ALTER TABLE public.users ADD CONSTRAINT users_tenant_employee_id_key UNIQUE NULLS NOT DISTINCT (tenant_id, employee_id);
