-- Add missing visual customization fields to workspace_configurations table
ALTER TABLE public.workspace_configurations 
ADD COLUMN IF NOT EXISTS logo_claro text,
ADD COLUMN IF NOT EXISTS logo_escuro text,
ADD COLUMN IF NOT EXISTS logo_secundario_claro text,
ADD COLUMN IF NOT EXISTS logo_secundario_escuro text,
ADD COLUMN IF NOT EXISTS background_solid_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS background_solid_color text;