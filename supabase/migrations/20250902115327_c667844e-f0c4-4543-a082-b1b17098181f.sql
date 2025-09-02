-- Phase 1: Create enum types and base organizational structure
CREATE TYPE public.org_role AS ENUM ('OWNER', 'ADMIN', 'USER');
CREATE TYPE public.app_role AS ENUM ('master', 'user');

-- Create profiles table (1-1 with auth.users when we migrate)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles for global roles (master, etc.)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create organizations table
CREATE TABLE public.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on orgs
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- Create org_members table (many-to-many between users and orgs with roles)
CREATE TABLE public.org_members (
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role org_role NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Create indexes for org_members
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.org_members(org_id);

-- Enable RLS on org_members
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, role_name app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = has_role.user_id
      AND user_roles.role = role_name
  )
$$;

-- Helper function to check if current user is master
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'master'::app_role)
$$;

-- Helper function to check if user is member of an org with specific role
CREATE OR REPLACE FUNCTION public.is_member(org_id UUID, min_role org_role DEFAULT 'USER')
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.org_id = is_member.org_id
      AND om.user_id = auth.uid()
      AND (
        (min_role = 'USER') OR
        (min_role = 'ADMIN' AND om.role IN ('ADMIN', 'OWNER')) OR
        (min_role = 'OWNER' AND om.role = 'OWNER')
      )
  )
$$;

-- Add org_id to existing tables for multi-tenancy
ALTER TABLE public.channels ADD COLUMN org_id UUID;
ALTER TABLE public.contacts ADD COLUMN org_id UUID;
ALTER TABLE public.conversations ADD COLUMN org_id UUID;
ALTER TABLE public.tags ADD COLUMN org_id UUID;
ALTER TABLE public.activities ADD COLUMN org_id UUID;

-- Create default workspace and backfill existing data
INSERT INTO public.orgs (id, name) VALUES (gen_random_uuid(), 'Workspace Padrão');

-- Get the default org id for backfill
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    SELECT id INTO default_org_id FROM public.orgs WHERE name = 'Workspace Padrão' LIMIT 1;
    
    -- Backfill existing records
    UPDATE public.channels SET org_id = default_org_id WHERE org_id IS NULL;
    UPDATE public.contacts SET org_id = default_org_id WHERE org_id IS NULL;
    UPDATE public.conversations SET org_id = default_org_id WHERE org_id IS NULL;
    UPDATE public.tags SET org_id = default_org_id WHERE org_id IS NULL;
    UPDATE public.activities SET org_id = default_org_id WHERE org_id IS NULL;
END $$;

-- Make org_id NOT NULL and add foreign keys
ALTER TABLE public.channels ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.tags ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.activities ALTER COLUMN org_id SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE public.channels ADD CONSTRAINT fk_channels_org FOREIGN KEY (org_id) REFERENCES public.orgs(id);
ALTER TABLE public.contacts ADD CONSTRAINT fk_contacts_org FOREIGN KEY (org_id) REFERENCES public.orgs(id);
ALTER TABLE public.conversations ADD CONSTRAINT fk_conversations_org FOREIGN KEY (org_id) REFERENCES public.orgs(id);
ALTER TABLE public.tags ADD CONSTRAINT fk_tags_org FOREIGN KEY (org_id) REFERENCES public.orgs(id);
ALTER TABLE public.activities ADD CONSTRAINT fk_activities_org FOREIGN KEY (org_id) REFERENCES public.orgs(id);

-- Create indexes for better performance
CREATE INDEX idx_channels_org_id ON public.channels(org_id);
CREATE INDEX idx_contacts_org_id ON public.contacts(org_id);
CREATE INDEX idx_conversations_org_id ON public.conversations(org_id);
CREATE INDEX idx_tags_org_id ON public.tags(org_id);
CREATE INDEX idx_activities_org_id ON public.activities(org_id);

-- RLS Policies for orgs
CREATE POLICY "orgs_select" ON public.orgs
  FOR SELECT USING (
    public.is_master() OR 
    public.is_member(id)
  );

CREATE POLICY "orgs_insert" ON public.orgs
  FOR INSERT WITH CHECK (public.is_master());

CREATE POLICY "orgs_update" ON public.orgs
  FOR UPDATE USING (
    public.is_master() OR 
    public.is_member(id, 'OWNER')
  );

CREATE POLICY "orgs_delete" ON public.orgs
  FOR DELETE USING (public.is_master());

-- RLS Policies for org_members
CREATE POLICY "org_members_select" ON public.org_members
  FOR SELECT USING (
    public.is_master() OR 
    public.is_member(org_id)
  );

CREATE POLICY "org_members_insert" ON public.org_members
  FOR INSERT WITH CHECK (
    public.is_master() OR 
    public.is_member(org_id, 'OWNER')
  );

CREATE POLICY "org_members_update" ON public.org_members
  FOR UPDATE USING (
    public.is_master() OR 
    public.is_member(org_id, 'OWNER')
  );

CREATE POLICY "org_members_delete" ON public.org_members
  FOR DELETE USING (
    public.is_master() OR 
    public.is_member(org_id, 'OWNER')
  );

-- RLS Policies for resource tables (channels, contacts, etc.)
-- Remove existing permissive policies and create new org-scoped ones

-- Channels policies
DROP POLICY IF EXISTS "Allow all operations on channels" ON public.channels;
CREATE POLICY "channels_select" ON public.channels
  FOR SELECT USING (public.is_member(org_id));

CREATE POLICY "channels_insert" ON public.channels
  FOR INSERT WITH CHECK (
    public.is_master() OR 
    public.is_member(org_id, 'ADMIN')
  );

CREATE POLICY "channels_update" ON public.channels
  FOR UPDATE USING (
    public.is_master() OR 
    public.is_member(org_id, 'ADMIN')
  );

CREATE POLICY "channels_delete" ON public.channels
  FOR DELETE USING (
    public.is_master() OR 
    public.is_member(org_id, 'OWNER')
  );

-- Contacts policies
DROP POLICY IF EXISTS "Allow all operations on contacts" ON public.contacts;
CREATE POLICY "contacts_select" ON public.contacts
  FOR SELECT USING (public.is_member(org_id));

CREATE POLICY "contacts_insert" ON public.contacts
  FOR INSERT WITH CHECK (public.is_member(org_id));

CREATE POLICY "contacts_update" ON public.contacts
  FOR UPDATE USING (public.is_member(org_id));

CREATE POLICY "contacts_delete" ON public.contacts
  FOR DELETE USING (
    public.is_master() OR 
    public.is_member(org_id, 'ADMIN')
  );

-- Tags policies
DROP POLICY IF EXISTS "Allow all operations on tags" ON public.tags;
CREATE POLICY "tags_select" ON public.tags
  FOR SELECT USING (public.is_member(org_id));

CREATE POLICY "tags_insert" ON public.tags
  FOR INSERT WITH CHECK (public.is_member(org_id));

CREATE POLICY "tags_update" ON public.tags
  FOR UPDATE USING (public.is_member(org_id));

CREATE POLICY "tags_delete" ON public.tags
  FOR DELETE USING (
    public.is_master() OR 
    public.is_member(org_id, 'ADMIN')
  );

-- Update timestamp trigger for orgs
CREATE TRIGGER update_orgs_updated_at
  BEFORE UPDATE ON public.orgs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update timestamp trigger for profiles  
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();