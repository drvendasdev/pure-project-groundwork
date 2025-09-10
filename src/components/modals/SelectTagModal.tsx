import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface SelectTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagAdded: () => void;
  contactId: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

export function SelectTagModal({ isOpen, onClose, onTagAdded, contactId }: SelectTagModalProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();

  // Fetch available tags (excluding ones already assigned to this contact)
  const fetchAvailableTags = async () => {
    if (!contactId || !selectedWorkspace) return;

    try {
      // Get all tags from workspace
      const { data: allTags, error: tagsError } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('workspace_id', selectedWorkspace.workspace_id)
        .order('name');

      if (tagsError) throw tagsError;

      // Get tags already assigned to this contact
      const { data: assignedTags, error: assignedError } = await supabase
        .from('contact_tags')
        .select('tag_id')
        .eq('contact_id', contactId);

      if (assignedError) throw assignedError;

      const assignedTagIds = assignedTags?.map(ct => ct.tag_id) || [];
      
      // Filter out already assigned tags
      const available = allTags?.filter(tag => !assignedTagIds.includes(tag.id)) || [];
      
      setAvailableTags(available);
    } catch (error) {
      console.error('Error fetching available tags:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAvailableTags();
      setSelectedTagId("");
    }
  }, [isOpen, contactId, selectedWorkspace]);

  const handleAddTag = async () => {
    if (!selectedTagId || !contactId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('contact_tags')
        .insert({
          contact_id: contactId,
          tag_id: selectedTagId
        });

      if (error) throw error;

      const selectedTag = availableTags.find(tag => tag.id === selectedTagId);
      toast({
        title: "Tag adicionada",
        description: `A tag "${selectedTag?.name}" foi adicionada com sucesso.`,
      });

      onTagAdded();
      onClose();
    } catch (error: any) {
      console.error('Error adding tag to contact:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a tag. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Tag ao Contato</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="tag-select" className="text-sm font-medium">
              Selecione uma tag
            </Label>
            <Select value={selectedTagId} onValueChange={setSelectedTagId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Escolha uma tag..." />
              </SelectTrigger>
              <SelectContent className="z-50 bg-background border border-border">
                {availableTags.length === 0 ? (
                  <SelectItem value="no-tags" disabled>
                    Nenhuma tag disponível
                  </SelectItem>
                ) : (
                  availableTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAddTag}
            disabled={!selectedTagId || isLoading || availableTags.length === 0}
            className="bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            {isLoading ? "Adicionando..." : "Adicionar Tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}