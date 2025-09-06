import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type WorkspaceRole = 'mentor_master' | 'gestor' | 'colaborador';

interface WorkspaceRoleHook {
  userWorkspaceRole: WorkspaceRole | null;
  isMentorMaster: boolean;
  isGestor: (workspaceId?: string) => boolean;
  isColaborador: (workspaceId?: string) => boolean;
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
        // Fetch user's workspace memberships
        const { data: memberships, error } = await supabase
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching workspace roles:', error);
          setUserWorkspaceRole(null);
          setUserWorkspaces([]);
          return;
        }

        if (memberships && memberships.length > 0) {
          setUserWorkspaces(memberships.map(m => ({ workspaceId: m.workspace_id, role: m.role as WorkspaceRole })));
          
          // Check if user is mentor_master in any workspace
          const isMentorMaster = memberships.some(m => m.role === 'mentor_master');
          if (isMentorMaster) {
            setUserWorkspaceRole('mentor_master');
          } else {
            // Set the highest role
            const hasGestor = memberships.some(m => m.role === 'gestor');
            setUserWorkspaceRole(hasGestor ? 'gestor' : 'colaborador');
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

  const isMentorMaster = userRole === 'master' || userWorkspaceRole === 'mentor_master';

  const isGestor = (workspaceId?: string) => {
    if (userRole === 'master' || userWorkspaceRole === 'mentor_master') return true;
    if (!workspaceId) return userWorkspaceRole === 'gestor';
    return userWorkspaces.some(w => w.workspaceId === workspaceId && (w.role === 'gestor' || w.role === 'mentor_master'));
  };

  const isColaborador = (workspaceId?: string) => {
    if (!workspaceId) return userWorkspaceRole === 'colaborador';
    return userWorkspaces.some(w => w.workspaceId === workspaceId && w.role === 'colaborador');
  };

  const canCreateConnections = (workspaceId?: string) => {
    // mentor_master can create connections anywhere
    if (isMentorMaster) return true;
    
    // gestor can create connections in their workspace
    if (workspaceId) {
      return isGestor(workspaceId);
    }
    
    // If no specific workspace, check if user is at least gestor somewhere
    return userWorkspaceRole === 'gestor';
  };

  const canManageWorkspace = (workspaceId?: string) => {
    // mentor_master can manage any workspace
    if (isMentorMaster) return true;
    
    // gestor can manage their workspace
    if (workspaceId) {
      return isGestor(workspaceId);
    }
    
    return false;
  };

  const getUserWorkspaces = async (): Promise<string[]> => {
    if (isMentorMaster) {
      // mentor_master has access to all workspaces
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
    isMentorMaster,
    isGestor,
    isColaborador,
    canCreateConnections,
    canManageWorkspace,
    getUserWorkspaces,
    loading
  };
}