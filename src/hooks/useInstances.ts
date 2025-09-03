import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Instance {
  instance: string;
  displayName?: string;
}

export function useInstances() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInstances() {
      try {
        setIsLoading(true);
        setError(null);

        // First try to get instances from channels table
        const { data: channelsData, error: channelsError } = await supabase
          .from('channels')
          .select('instance, name')
          .order('name');

        if (channelsError) {
          console.warn('Error fetching from channels:', channelsError);
        }

        // Then try to get from instance_user_assignments (current instances in use)
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('instance_user_assignments')
          .select('instance')
          .order('instance');

        if (assignmentsError) {
          console.warn('Error fetching from assignments:', assignmentsError);
        }

        // Combine and deduplicate instances
        const allInstances = new Set<string>();
        
        if (channelsData) {
          channelsData.forEach(channel => {
            if (channel.instance) {
              allInstances.add(channel.instance);
            }
          });
        }

        if (assignmentsData) {
          assignmentsData.forEach(assignment => {
            if (assignment.instance) {
              allInstances.add(assignment.instance);
            }
          });
        }

        // Convert to array with display names
        const instanceList: Instance[] = Array.from(allInstances).map(instance => {
          const channel = channelsData?.find(c => c.instance === instance);
          return {
            instance,
            displayName: channel?.name || instance
          };
        });

        setInstances(instanceList);
      } catch (err) {
        console.error('Error fetching instances:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar instâncias');
      } finally {
        setIsLoading(false);
      }
    }

    fetchInstances();
  }, []);

  return { instances, isLoading, error };
}