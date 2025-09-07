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
        // Use the system user ID from the user object (which comes from system_users table)
        const systemUserId = user.id;
        
        // Fetch user's workspace memberships
        const { data: memberships, error } = await supabase
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', systemUserId);

        if (error) {
          console.error('Error fetching workspace roles:', error);
          setUserWorkspaceRole(null);
          setUserWorkspaces([]);
          return;
        }

        if (memberships && memberships.length > 0) {
          setUserWorkspaces(memberships.map(m => ({ workspaceId: m.workspace_id, role: m.role as WorkspaceRole })));
          
          // Check if user is master in any workspace
          const isMaster = memberships.some(m => m.role === 'master');
          if (isMaster) {
            setUserWorkspaceRole('master');
          } else {
            // Set the highest role
            const hasAdmin = memberships.some(m => m.role === 'admin');
            setUserWorkspaceRole(hasAdmin ? 'admin' : 'user');
          }
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