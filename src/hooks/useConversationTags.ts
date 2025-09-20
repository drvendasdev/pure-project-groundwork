import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ConversationTag {
  id: string;
  conversation_id: string;
  tag_id: string;
  tag: Tag;
}

export function useConversationTags(conversationId?: string) {
  const [conversationTags, setConversationTags] = useState<ConversationTag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch tags already assigned to conversation
  const fetchConversationTags = async () => {
    if (!conversationId) return;
    
    try {
      const { data, error } = await supabase
        .from('conversation_tags')
        .select(`
          id,
          conversation_id,
          tag_id,
          tag:tags(id, name, color)
        `)
        .eq('conversation_id', conversationId);

      if (error) throw error;
      setConversationTags(data || []);
    } catch (err) {
      console.error('Error fetching conversation tags:', err);
    }
  };

  // Fetch all available tags
  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .order('name');

      if (error) throw error;
      setAvailableTags(data || []);
    } catch (err) {
      console.error('Error fetching available tags:', err);
    }
  };

  // Add tag to conversation
  const addTagToConversation = async (tagId: string) => {
    if (!conversationId) return false;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('conversation_tags')
        .insert({
          conversation_id: conversationId,
          tag_id: tagId
        });

      if (error) throw error;

      await fetchConversationTags();
      toast({
        title: "Tag adicionada",
        description: "A tag foi adicionada à conversa com sucesso.",
      });
      
      return true;
    } catch (error: any) {
      console.error('Error adding tag to conversation:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a tag. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get available tags excluding already assigned ones
  const getFilteredTags = (searchTerm: string = '') => {
    const assignedTagIds = conversationTags.map(ct => ct.tag_id);
    const filtered = availableTags.filter(tag => 
      !assignedTagIds.includes(tag.id) &&
      tag.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered;
  };

  useEffect(() => {
    fetchAvailableTags();
  }, []);

  useEffect(() => {
    fetchConversationTags();
  }, [conversationId]);

  return {
    conversationTags,
    availableTags,
    isLoading,
    addTagToConversation,
    getFilteredTags,
    refreshTags: fetchConversationTags
  };
}