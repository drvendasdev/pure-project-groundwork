import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';

export function usePipelineCardAutoCreation() {
  const [isCreating, setIsCreating] = useState(false);
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  const checkAndCreateCard = useCallback(async (
    conversationId: string,
    contactId: string,
    workspaceId: string
  ) => {
    try {
      setIsCreating(true);

      // Verificar se já existe um card para esta conversa
      const { data: existingCard } = await supabase
        .from('pipeline_cards')
        .select('id')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (existingCard) {
        console.log('Card já existe para esta conversa:', existingCard.id);
        return existingCard;
      }

      // Buscar o primeiro pipeline ativo do workspace
      const headers = getHeaders();
      const { data: pipelines } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers
      });

      if (!pipelines || pipelines.length === 0) {
        console.warn('Nenhum pipeline encontrado para auto-criação de card');
        return null;
      }

      const firstPipeline = pipelines[0];
      
      // Buscar a primeira coluna do pipeline
      const { data: columns } = await supabase.functions.invoke(`pipeline-management/columns?pipeline_id=${firstPipeline.id}`, {
        method: 'GET',
        headers
      });

      if (!columns || columns.length === 0) {
        console.warn('Nenhuma coluna encontrada no pipeline para auto-criação de card');
        return null;
      }

      const firstColumn = columns[0];

      // Buscar informações do contato e da conversa
      const { data: contact } = await supabase
        .from('contacts')
        .select('name, phone')
        .eq('id', contactId)
        .single();

      if (!contact) {
        console.error('Contato não encontrado para auto-criação de card');
        return null;
      }

      // Buscar informações da conversa para obter o usuário responsável
      const { data: conversation } = await supabase
        .from('conversations')
        .select('assigned_user_id')
        .eq('id', conversationId)
        .single();

      // Criar o card automaticamente
      const { data: newCard } = await supabase.functions.invoke('pipeline-management/cards', {
        method: 'POST',
        headers,
        body: {
          pipeline_id: firstPipeline.id,
          column_id: firstColumn.id,
          conversation_id: conversationId,
          contact_id: contactId,
          responsible_user_id: conversation?.assigned_user_id || null,
          title: contact.name || contact.phone || 'Contato sem nome',
          description: 'Card criado automaticamente',
          value: 0,
          status: 'aberto',
          tags: []
        }
      });

      if (newCard) {
        console.log('Card criado automaticamente:', newCard);
        toast({
          title: 'CRM atualizado',
          description: 'Novo negócio criado automaticamente',
        });
      }

      return newCard;

    } catch (error) {
      console.error('Erro ao criar card automaticamente:', error);
      // Não mostrar erro ao usuário, apenas log interno
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [getHeaders, toast]);

  return {
    checkAndCreateCard,
    isCreating
  };
}