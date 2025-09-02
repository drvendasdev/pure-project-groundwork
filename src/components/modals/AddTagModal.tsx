import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getDefaultOrgId } from "@/lib/defaultOrg";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface AddTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  onTagAdded: (tag: Tag) => void;
  isDarkMode?: boolean;
}

export function AddTagModal({ 
  isOpen, 
  onClose, 
  contactId, 
  onTagAdded, 
  isDarkMode = false 
}: AddTagModalProps) {
  const [tagInput, setTagInput] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && tagInput.length > 0) {
      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [tagInput, isOpen]);

  const fetchSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .ilike('name', `%${tagInput}%`)
        .limit(5);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Erro ao buscar sugestões:', error);
    }
  };

  const handleAddTag = async (tagName: string, isExisting = false, existingTag?: Tag) => {
    setIsLoading(true);
    try {
      let tagId: string;

      if (isExisting && existingTag) {
        tagId = existingTag.id;
      } else {
        // Criar nova tag
        const orgId = await getDefaultOrgId();
        const { data: newTag, error: tagError } = await supabase
          .from('tags')
          .insert([{ name: tagName, color: '#808080', org_id: orgId }])
          .select()
          .single();

        if (tagError) throw tagError;
        tagId = newTag.id;
      }

      // Associar tag ao contato
      const { error: linkError } = await supabase
        .from('contact_tags')
        .insert([{ contact_id: contactId, tag_id: tagId }]);

      if (linkError && !linkError.message.includes('duplicate')) {
        throw linkError;
      }

      // Buscar a tag completa para retornar
      const { data: tag, error: fetchError } = await supabase
        .from('tags')
        .select('*')
        .eq('id', tagId)
        .single();

      if (fetchError) throw fetchError;

      onTagAdded(tag);
      
      toast({
        title: "Tag adicionada",
        description: `A tag "${tagName}" foi adicionada ao contato.`,
      });

      setTagInput("");
      onClose();
    } catch (error: any) {
      if (error.message.includes('duplicate')) {
        toast({
          title: "Tag já existe",
          description: "Esta tag já está associada ao contato.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível adicionar a tag.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-md",
        isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white"
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
          <div className="space-y-2">
            <Input
              placeholder="Digite o nome da tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className={cn(
                isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
              )}
              disabled={isLoading}
            />

            {suggestions.length > 0 && (
              <div className={cn(
                "border rounded-md p-2 space-y-1",
                isDarkMode ? "border-gray-600 bg-[#1f1f1f]" : "border-gray-200 bg-gray-50"
              )}>
                <p className={cn(
                  "text-xs font-medium",
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  Sugestões:
                </p>
                {suggestions.map((tag) => (
                  <Button
                    key={tag.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start h-auto p-1",
                      isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"
                    )}
                    onClick={() => handleAddTag(tag.name, true, tag)}
                    disabled={isLoading}
                  >
                    <Badge 
                      variant="secondary" 
                      className="mr-2"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </Badge>
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className={cn(
                isDarkMode ? "border-gray-600 text-gray-300" : ""
              )}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => tagInput.trim() && handleAddTag(tagInput.trim())}
              disabled={!tagInput.trim() || isLoading}
              className="bg-yellow-400 text-black hover:bg-yellow-500"
            >
              {isLoading ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}