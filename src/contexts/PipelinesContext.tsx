import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';

export interface Pipeline {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineColumn {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  order_position: number;
  created_at: string;
}

export interface PipelineCard {
  id: string;
  pipeline_id: string;
  column_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  value: number;
  status: string;
  tags: any[];
  created_at: string;
  updated_at: string;
  contact?: any;
  conversation?: any;
}

interface PipelinesContextType {
  pipelines: Pipeline[];
  selectedPipeline: Pipeline | null;
  columns: PipelineColumn[];
  cards: PipelineCard[];
  isLoading: boolean;
  fetchPipelines: () => Promise<void>;
  createPipeline: (name: string, type: string) => Promise<Pipeline>;
  selectPipeline: (pipeline: Pipeline) => void;
  createColumn: (name: string, color: string) => Promise<PipelineColumn>;
  createCard: (cardData: Partial<PipelineCard>) => Promise<PipelineCard>;
  updateCard: (cardId: string, updates: Partial<PipelineCard>) => Promise<void>;
  moveCard: (cardId: string, newColumnId: string) => Promise<void>;
  getCardsByColumn: (columnId: string) => PipelineCard[];
}

const PipelinesContext = createContext<PipelinesContextType | undefined>(undefined);

export function PipelinesProvider({ children }: { children: React.ReactNode }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start as loading
  const { selectedWorkspace } = useWorkspace();
  const { toast } = useToast();

  // Estabilizar a função getHeaders para evitar re-renders desnecessários
  const getHeaders = useMemo(() => {
    if (!selectedWorkspace?.workspace_id) {
      return null;
    }
    
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    if (!currentUserData?.id) {
      return null;
    }

    const headers = {
      'x-system-user-id': currentUserData.id,
      'x-system-user-email': currentUserData.email || '',
      'x-workspace-id': selectedWorkspace.workspace_id
    };
    
    return headers;
  }, [selectedWorkspace?.workspace_id]);

  const fetchPipelines = useCallback(async () => {
    if (!getHeaders) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers: getHeaders
      });

      if (error) {
        console.error('❌ Pipeline fetch error:', error);
        throw error;
      }

      setPipelines(data || []);
      
      // Auto-select first pipeline if none selected and we have pipelines
      if (data?.length > 0 && !selectedPipeline) {
        setSelectedPipeline(data[0]);
      }
    } catch (error) {
      console.error('❌ Error fetching pipelines:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pipelines. Verifique sua conexão.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, toast]);

  const fetchColumns = useCallback(async (pipelineId: string) => {
    if (!getHeaders || !pipelineId) return;

    try {
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers: getHeaders
      });

      if (error) throw error;
      setColumns(data || []);
    } catch (error) {
      console.error('Error fetching columns:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar colunas",
        variant: "destructive",
      });
    }
  }, [getHeaders, toast]);

  const fetchCards = useCallback(async (pipelineId: string) => {
    if (!getHeaders || !pipelineId) return;

    try {
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers: getHeaders
      });

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar cards",
        variant: "destructive",
      });
    }
  }, [getHeaders, toast]);

  const createPipeline = useCallback(async (name: string, type: string) => {
    if (!getHeaders) throw new Error('Headers not available');
    
    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'POST',
        headers: getHeaders,
        body: { name, type }
      });

      if (error) throw error;

      setPipelines(prev => [data, ...prev]);
      setSelectedPipeline(data);
      
      toast({
        title: "Sucesso",
        description: "Pipeline criado com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating pipeline:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar pipeline",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, toast]);

  const selectPipeline = useCallback((pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
  }, []);

  const createColumn = useCallback(async (name: string, color: string) => {
    if (!getHeaders || !selectedPipeline) throw new Error('Requirements not met');

    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/columns', {
        method: 'POST',
        headers: getHeaders,
        body: { 
          pipeline_id: selectedPipeline.id,
          name,
          color 
        }
      });

      if (error) throw error;

      setColumns(prev => [...prev, data]);
      
      toast({
        title: "Sucesso",
        description: "Coluna criada com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating column:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar coluna",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, selectedPipeline, toast]);

  const createCard = useCallback(async (cardData: Partial<PipelineCard>) => {
    if (!getHeaders || !selectedPipeline) throw new Error('Requirements not met');

    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/cards', {
        method: 'POST',
        headers: getHeaders,
        body: {
          pipeline_id: selectedPipeline.id,
          ...cardData
        }
      });

      if (error) throw error;

      setCards(prev => [...prev, data]);
      
      toast({
        title: "Sucesso",
        description: "Card criado com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating card:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar card",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, selectedPipeline, toast]);

  const updateCard = useCallback(async (cardId: string, updates: Partial<PipelineCard>) => {
    if (!getHeaders) throw new Error('Headers not available');

    try {
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}`, {
        method: 'PUT',
        headers: getHeaders,
        body: updates
      });

      if (error) throw error;

      setCards(prev => prev.map(card => 
        card.id === cardId ? { ...card, ...data } : card
      ));

      return data;
    } catch (error) {
      console.error('Error updating card:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar card",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, toast]);

  const moveCard = useCallback(async (cardId: string, newColumnId: string) => {
    await updateCard(cardId, { column_id: newColumnId });
  }, [updateCard]);

  const getCardsByColumn = useCallback((columnId: string) => {
    return cards.filter(card => card.column_id === columnId);
  }, [cards]);

  // Buscar pipelines quando o workspace mudar
  useEffect(() => {
    if (selectedWorkspace?.workspace_id && getHeaders) {
      fetchPipelines();
    } else {
      setPipelines([]);
      setSelectedPipeline(null);
    }
  }, [selectedWorkspace?.workspace_id, fetchPipelines]);

  // Buscar colunas e cards quando o pipeline selecionado mudar
  useEffect(() => {
    if (selectedPipeline?.id) {
      fetchColumns(selectedPipeline.id);
      fetchCards(selectedPipeline.id);
    } else {
      setColumns([]);
      setCards([]);
    }
  }, [selectedPipeline?.id, fetchColumns, fetchCards]);

  const value = useMemo(() => ({
    pipelines,
    selectedPipeline,
    columns,
    cards,
    isLoading,
    fetchPipelines,
    createPipeline,
    selectPipeline,
    createColumn,
    createCard,
    updateCard,
    moveCard,
    getCardsByColumn,
  }), [
    pipelines,
    selectedPipeline,
    columns,
    cards,
    isLoading,
    fetchPipelines,
    createPipeline,
    selectPipeline,
    createColumn,
    createCard,
    updateCard,
    moveCard,
    getCardsByColumn,
  ]);

  return (
    <PipelinesContext.Provider value={value}>
      {children}
    </PipelinesContext.Provider>
  );
}

export function usePipelinesContext() {
  const context = useContext(PipelinesContext);
  if (context === undefined) {
    throw new Error('usePipelinesContext must be used within a PipelinesProvider');
  }
  return context;
}