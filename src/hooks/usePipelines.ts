import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
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

export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  const fetchPipelines = async () => {
    try {
      setIsLoading(true);
      const headers = getHeaders();
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers
      });

      if (error) throw error;

      setPipelines(data || []);
      
      // Auto-select first pipeline if none selected
      if (data?.length > 0 && !selectedPipeline) {
        setSelectedPipeline(data[0]);
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pipelines",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createPipeline = async (name: string, type: string) => {
    try {
      const headers = getHeaders();
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'POST',
        headers,
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
  };

  const selectPipeline = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
  };

  useEffect(() => {
    fetchPipelines();
  }, [getHeaders]); // Add dependency to ensure proper reloading

  return {
    pipelines,
    selectedPipeline,
    isLoading,
    fetchPipelines,
    createPipeline,
    selectPipeline,
  };
}