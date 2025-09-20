import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface AdicionarTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTag: (tag: string) => void;
  isDarkMode?: boolean;
  contactId?: string;
}

export function AdicionarTagModal({ isOpen, onClose, onAddTag, isDarkMode = false, contactId }: AdicionarTagModalProps) {
  const [newTag, setNewTag] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{id: string, name: string, color: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { tags } = useTags();
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();

  // Buscar sugestões baseadas no input
  useEffect(() => {
    if (newTag.trim().length > 0) {
      const filtered = tags.filter(tag => 
        tag.name.toLowerCase().includes(newTag.toLowerCase())
      );
      setSuggestions(filtered);
    } else {
      setSuggestions(tags.slice(0, 8)); // Mostrar primeiras 8 tags quando vazio
    }
  }, [newTag, tags]);

  const handleAddTag = async (tagName: string, tagId?: string) => {
    if (!contactId) {
      onAddTag(tagName);
      setNewTag("");
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      let finalTagId = tagId;
      
      // Se não tem ID, é uma tag nova - criar primeiro
      if (!finalTagId) {
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .single();

        if (existingTag) {
          finalTagId = existingTag.id;
        } else {
          // Criar nova tag
          const { data: newTagData, error: tagError } = await supabase
            .from('tags')
            .insert({ 
              name: tagName, 
              workspace_id: selectedWorkspace?.workspace_id
            })
            .select()
            .single();

          if (tagError) throw tagError;
          finalTagId = newTagData.id;
        }
      }

      // Associar tag ao contato
      const { error: linkError } = await supabase
        .from('contact_tags')
        .insert({
          contact_id: contactId,
          tag_id: finalTagId
        });

      if (linkError && !linkError.message.includes('duplicate')) {
        throw linkError;
      }

      toast({
        title: "Tag adicionada",
        description: `A tag "${tagName}" foi adicionada com sucesso.`,
      });

      onAddTag(tagName);
      setNewTag("");
      onClose();
    } catch (error: any) {
      console.error('Erro ao adicionar tag:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a tag. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    if (newTag.trim()) {
      handleAddTag(newTag.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-md",
        isDarkMode 
          ? "bg-gray-800 border-gray-600 text-white" 
          : "bg-white border-gray-200 text-gray-900"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-lg font-semibold",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            Adicionar Tag
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campo de entrada de nova tag */}
          <div>
            <Label htmlFor="newTag" className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Digite o nome da tag
            </Label>
            <Input
              id="newTag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nome da tag..."
              className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" 
                  : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
              )}
            />
          </div>

          {/* Tags sugeridas */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Tags sugeridas
            </Label>
            <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
              {suggestions.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  style={{ 
                    borderColor: tag.color, 
                    color: tag.color,
                    backgroundColor: `${tag.color}20`
                  }}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => handleAddTag(tag.name, tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Opção de criar nova tag */}
          {newTag.trim() && !suggestions.some(tag => tag.name.toLowerCase() === newTag.toLowerCase()) && (
            <div>
              <Button
                variant="outline"
                onClick={handleCreateNew}
                disabled={isLoading}
                className={cn(
                  "w-full",
                  isDarkMode 
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                    : "border-gray-300 text-gray-700 hover:bg-gray-100"
                )}
              >
                {isLoading ? "Criando..." : `Criar "${newTag}"`}
              </Button>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancelar
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}