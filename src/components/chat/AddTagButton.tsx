import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AdicionarTagModal } from "@/components/modals/AdicionarTagModal";

interface AddTagButtonProps {
  contactId: string;
  isDarkMode?: boolean;
  onTagAdded?: () => void;
}

export function AddTagButton({ contactId, isDarkMode = false, onTagAdded }: AddTagButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTagAdded = (tagName: string) => {
    console.log(`Tag "${tagName}" adicionada ao contato ${contactId}`);
    setIsModalOpen(false);
    onTagAdded?.();
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsModalOpen(true)}
              className="h-8 w-8 hover:bg-muted"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Adicionar tag</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AdicionarTagModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddTag={handleTagAdded}
        isDarkMode={isDarkMode}
      />
    </>
  );
}