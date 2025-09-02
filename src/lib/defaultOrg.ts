import { supabase } from '@/integrations/supabase/client';

let cachedDefaultOrgId: string | null = null;

export async function getDefaultOrgId(): Promise<string> {
  if (cachedDefaultOrgId) {
    return cachedDefaultOrgId;
  }

  const { data: defaultOrg, error } = await supabase
    .from('orgs')
    .select('id')
    .eq('name', 'Workspace Padrão')
    .single();

  if (error || !defaultOrg) {
    throw new Error('Default workspace not found');
  }

  cachedDefaultOrgId = defaultOrg.id;
  return defaultOrg.id;
}