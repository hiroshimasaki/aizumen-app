-- Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow platform_admins to do everything
CREATE POLICY "Platform admins can manage system settings"
    ON public.system_settings
    FOR ALL
    TO authenticated
    USING (
        auth.jwt() ->> 'role' = 'platform_admin'
    )
    WITH CHECK (
        auth.jwt() ->> 'role' = 'platform_admin'
    );

-- Allow authenticated users to read settings
CREATE POLICY "Authenticated users can read system settings"
    ON public.system_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Insert initial maintenance mode setting
INSERT INTO public.system_settings (key, value)
VALUES (
    'maintenance_mode',
    '{"enabled": false, "message": "", "started_at": null}'::jsonb
) ON CONFLICT (key) DO NOTHING;
