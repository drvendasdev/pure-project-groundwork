import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type WorkspaceRole = 'master' | 'admin' | 'user';

interface WorkspaceRoleHook {
  userWorkspaceRole: WorkspaceRole | null;
  isMaster: boolean;
  isAdmin: (workspaceId?: string) => boolean;
  isUser: (workspaceId?: string) => boolean;
  canCreateConnections: (workspaceId?: string) => boolean;
  canManageWorkspace: (workspaceId?: string) => boolean;
  getUserWorkspaces: () => Promise<string[]>;
  loading: boolean;
}

export function useWorkspaceRole(): WorkspaceRoleHook {
  const { user, userRole } = useAuth();
  const [userWorkspaceRole, setUserWorkspaceRole] = useState<WorkspaceRole | null>(null);
  const [userWorkspaces, setUserWorkspaces] = useState<{workspaceId: string, role: WorkspaceRole}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserWorkspaceRoles = async () => {
      if (!user?.id) {
        setUserWorkspaceRole(null);
        setUserWorkspaces([]);
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching workspace roles via Edge function for user:', user.id);
        
        // Use the same Edge function to get workspace memberships
        const { data, error } = await supabase.functions.invoke('list-user-workspaces', {
          headers: {
            'x-system-user-id': user.id,
            'x-system-user-email': user.email
          }
        });

        if (error) {
          console.error('Error calling list-user-workspaces function:', error);
          setUserWorkspaceRole(null);
          setUserWorkspaces([]);
          return;
        }

        if (data?.userMemberships && data.userMemberships.length > 0) {
          setUserWorkspaces(data.userMemberships.map((m: any) => ({ workspaceId: m.workspaceId, role: m.role as WorkspaceRole })));
          
          // Check if user is master in any workspace
          const isMaster = data.userMemberships.some((m: any) => m.role === 'master');
          if (isMaster) {
            setUserWorkspaceRole('master');
          } else {
            // Set the highest role
            const hasAdmin = data.userMemberships.some((m: any) => m.role === 'admin');
            setUserWorkspaceRole(hasAdmin ? 'admin' : 'user');
          }
        } else if (data?.userRole === 'master') {
          // Handle master users who might not have explicit workspace memberships
          setUserWorkspaceRole('master');
          setUserWorkspaces([]);
        } else {
          setUserWorkspaceRole(null);
          setUserWorkspaces([]);
        }
      } catch (error) {
        console.error('Error in fetchUserWorkspaceRoles:', error);
        setUserWorkspaceRole(null);
        setUserWorkspaces([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserWorkspaceRoles();
  }, [user?.id]);

  const isMaster = userRole === 'master' || userWorkspaceRole === 'master';

  const isAdmin = (workspaceId?: string) => {
    if (userRole === 'master' || userWorkspaceRole === 'master') return true;
    if (!workspaceId) return userWorkspaceRole === 'admin';
    return userWorkspaces.some(w => w.workspaceId === workspaceId && (w.role === 'admin' || w.role === 'master'));
  };

  const isUser = (workspaceId?: string) => {
    if (!workspaceId) return userWorkspaceRole === 'user';
    return userWorkspaces.some(w => w.workspaceId === workspaceId && w.role === 'user');
  };

  const canCreateConnections = (workspaceId?: string) => {
    // master can create connections anywhere
    if (isMaster) return true;
    
    // admin can create connections in their workspace
    if (workspaceId) {
      return isAdmin(workspaceId);
    }
    
    // If no specific workspace, check if user is at least admin somewhere
    return userWorkspaceRole === 'admin';
  };

  const canManageWorkspace = (workspaceId?: string) => {
    // master can manage any workspace
    if (isMaster) return true;
    
    // admin can manage their workspace (but not create new ones)
    if (workspaceId) {
      return isAdmin(workspaceId);
    }
    
    return false;
  };

  const getUserWorkspaces = async (): Promise<string[]> => {
    if (isMaster) {
      // master has access to all workspaces
      const { data: allWorkspaces } = await supabase
        .from('workspaces')
        .select('id')
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      return allWorkspaces?.map(w => w.id) || [];
    }
    
    return userWorkspaces.map(w => w.workspaceId);
  };

  return {
    userWorkspaceRole,
    isMaster,
    isAdmin,
    isUser,
    canCreateConnections,
    canManageWorkspace,
    getUserWorkspaces,
    loading
  };
}