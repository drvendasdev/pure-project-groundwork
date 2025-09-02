-- Add RLS policy for ADMIN to create USER in same org
CREATE POLICY "org_members_insert_admin_can_create_user" 
ON public.org_members 
FOR INSERT 
WITH CHECK (
  is_master() OR 
  is_member(org_id, 'OWNER'::org_role) OR 
  (is_member(org_id, 'ADMIN'::org_role) AND role = 'USER'::org_role)
);

-- Create useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON public.conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_channels_org_id ON public.channels(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON public.contacts(org_id);