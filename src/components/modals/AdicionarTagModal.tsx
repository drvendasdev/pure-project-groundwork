import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AdicionarTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTag: (tag: string) => void;
  isDarkMode?: boolean;
}

const existingTags = ["IMPORTANTE", "URGENTE", "VIP", "FOLLOW-UP", "DESCONTO"];

export function AdicionarTagModal({ isOpen, onClose, onAddTag, isDarkMode = false }: AdicionarTagModalProps) {
  const [newTag, setNewTag] = useState("");

  const handleAddTag = (tag: string) => {
    onAddTag(tag);
    setNewTag("");
    onClose();
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

          {/* Tags existentes */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Tags sugeridas
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {existingTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "cursor-pointer hover:bg-primary hover:text-primary-foreground",
                    isDarkMode 
                      ? "border-gray-600 text-gray-300 hover:bg-primary" 
                      : "border-gray-300 text-gray-700 hover:bg-primary"
                  )}
                  onClick={() => handleAddTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Opção de criar nova tag */}
          {newTag.trim() && (
            <div>
              <Button
                variant="outline"
                onClick={handleCreateNew}
                className={cn(
                  "w-full",
                  isDarkMode 
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                    : "border-gray-300 text-gray-700 hover:bg-gray-100"
                )}
              >
                Criar "{newTag}"
              </Button>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}