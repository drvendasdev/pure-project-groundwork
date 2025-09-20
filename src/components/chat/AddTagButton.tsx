import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversationTags } from "@/hooks/useConversationTags";
import { cn } from "@/lib/utils";

interface AddTagButtonProps {
  conversationId: string;
  isDarkMode?: boolean;
  onTagAdded?: () => void;
}

export function AddTagButton({ conversationId, isDarkMode = false, onTagAdded }: AddTagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { 
    getFilteredTags, 
    addTagToConversation, 
    isLoading 
  } = useConversationTags(conversationId);

  const filteredTags = getFilteredTags(searchTerm);

  // Auto focus input when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleAddTag = async () => {
    if (!selectedTagId) return;
    
    const success = await addTagToConversation(selectedTagId);
    if (success) {
      setIsOpen(false);
      setSearchTerm("");
      setSelectedTagId("");
      onTagAdded?.();
    }
  };

  const handleTagSelect = (tagId: string) => {
    setSelectedTagId(tagId);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setSearchTerm("");
    setSelectedTagId("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div 
          className="relative flex items-center"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Botão circular com + */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full border border-gray-300 hover:bg-gray-50"
          >
            <Plus className="w-3 h-3" />
          </Button>
          
          {/* Pill hover - Imagem 2 */}
          {isHovered && (
            <div className="absolute left-8 top-0 flex items-center h-6 px-2 bg-white border border-dashed border-gray-300 rounded-full text-xs text-gray-600 whitespace-nowrap z-10">
              + Adicionar tag
            </div>
          )}
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 p-4" 
        align="start"
        onKeyDown={handleKeyDown}
      >
        <div className="space-y-4">
          {/* Input - Imagem 3 */}
          <Input
            ref={inputRef}
            placeholder="Digite o nome da tag"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-gray-300"
          />
          
          {/* Lista de tags - Imagem 4 */}
          {searchTerm && (
            <ScrollArea className="max-h-40">
              <div className="space-y-2">
                {filteredTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    style={{ 
                      backgroundColor: tag.color, 
                      borderColor: tag.color,
                      color: 'white'
                    }}
                    className={cn(
                      "cursor-pointer hover:opacity-80 transition-opacity text-xs px-2 py-1",
                      selectedTagId === tag.id && "ring-2 ring-offset-2 ring-blue-500"
                    )}
                    onClick={() => handleTagSelect(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {filteredTags.length === 0 && (
                  <p className="text-sm text-gray-500">Nenhuma tag encontrada</p>
                )}
              </div>
            </ScrollArea>
          )}
          
          {/* Botões - Imagem 3 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 text-red-600 border-red-600 hover:bg-red-50"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddTag}
              disabled={!selectedTagId || isLoading}
              className="flex-1 bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300"
            >
              {isLoading ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}