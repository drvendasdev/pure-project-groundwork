import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Tag {
  id: string;
  name: string;
  color: string;
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar tags');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const refresh = () => {
    fetchTags();
  };

  return { tags, isLoading, error, refresh };
}