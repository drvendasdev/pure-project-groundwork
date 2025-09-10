import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Tag {
  id: string;
  name: string;
  color: string;
  workspace_id: string;
  created_at: string;
}

export function useTags(workspaceId?: string) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (workspaceId) {
      fetchTags();
    }
  }, [workspaceId]);

  async function fetchTags() {
    if (!workspaceId) return;
    
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('name');

      if (error) throw error;
      setTags(data || []);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar tags';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function createTag(name: string, color: string) {
    if (!workspaceId) {
      toast({
        title: "Erro",
        description: "Workspace não encontrado",
        variant: "destructive",
      });
      return { success: false };
    }

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({
          name: name.trim(),
          color,
          workspace_id: workspaceId,
        })
        .select()
        .single();

      if (error) throw error;

      setTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      
      toast({
        title: "Sucesso",
        description: "Tag criada com sucesso",
      });

      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar tag';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    }
  }

  async function updateTag(id: string, name: string, color: string) {
    try {
      const { data, error } = await supabase
        .from('tags')
        .update({
          name: name.trim(),
          color,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTags(prev => 
        prev.map(tag => 
          tag.id === id ? data : tag
        ).sort((a, b) => a.name.localeCompare(b.name))
      );

      toast({
        title: "Sucesso",
        description: "Tag atualizada com sucesso",
      });

      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar tag';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    }
  }

  async function deleteTag(id: string) {
    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTags(prev => prev.filter(tag => tag.id !== id));

      toast({
        title: "Sucesso",
        description: "Tag excluída com sucesso",
      });

      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao excluir tag';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    }
  }

  return { 
    tags, 
    isLoading, 
    error, 
    createTag, 
    updateTag, 
    deleteTag,
    refreshTags: fetchTags
  };
}