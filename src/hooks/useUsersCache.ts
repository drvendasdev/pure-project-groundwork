import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
}

// Cache global para usuários
let globalUsersCache: User[] = [];
let isFetching = false;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em milliseconds

// Listeners para notificar componentes quando o cache é atualizado
const cacheListeners: ((users: User[]) => void)[] = [];

const notifyListeners = (users: User[]) => {
  cacheListeners.forEach(listener => listener(users));
};

const addCacheListener = (listener: (users: User[]) => void) => {
  cacheListeners.push(listener);
  return () => {
    const index = cacheListeners.indexOf(listener);
    if (index > -1) {
      cacheListeners.splice(index, 1);
    }
  };
};

const fetchUsersFromDB = async (): Promise<User[]> => {
  // Se já está buscando, retornar cache atual
  if (isFetching) {
    return globalUsersCache;
  }

  // Se cache é recente, usar cache
  const now = Date.now();
  if (globalUsersCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
    return globalUsersCache;
  }

  isFetching = true;
  try {
    console.log('🔄 Buscando usuários do banco...');
    const { data, error } = await supabase
      .from('system_users')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
      .limit(100);
      
    if (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      throw error;
    }

    const users = data?.map(user => ({ id: user.id, name: user.name })) || [];
    globalUsersCache = users;
    cacheTimestamp = now;
    
    console.log(`✅ Usuários carregados: ${users.length} usuários`);
    
    // Notificar todos os listeners
    notifyListeners(users);
    
    return users;
  } catch (error) {
    console.error('❌ Erro crítico ao buscar usuários:', error);
    // Retornar cache antigo se houver erro
    return globalUsersCache;
  } finally {
    isFetching = false;
  }
};

export const useUsersCache = () => {
  const [users, setUsers] = useState<User[]>(globalUsersCache);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Se já temos usuários no cache, usar eles
    if (globalUsersCache.length > 0) {
      setUsers(globalUsersCache);
    }

    // Adicionar listener para updates do cache
    const removeListener = addCacheListener((updatedUsers) => {
      setUsers(updatedUsers);
    });

    return removeListener;
  }, []);

  const loadUsers = async () => {
    // Se já temos usuários e cache é recente, não recarregar
    const now = Date.now();
    if (globalUsersCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      setUsers(globalUsersCache);
      return { data: globalUsersCache };
    }

    setIsLoading(true);
    try {
      const fetchedUsers = await fetchUsersFromDB();
      setUsers(fetchedUsers);
      return { data: fetchedUsers };
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      return { error: 'Erro ao carregar usuários' };
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUsers = async () => {
    // Força atualização ignorando cache
    cacheTimestamp = 0;
    globalUsersCache = [];
    return loadUsers();
  };

  return {
    users,
    isLoading,
    loadUsers,
    refreshUsers
  };
};