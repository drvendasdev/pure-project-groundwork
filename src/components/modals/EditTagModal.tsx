import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { ColorPickerModal } from "./ColorPickerModal";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface EditTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tag: Tag | null;
  onTagUpdated: (tag: { id?: string; name: string; color: string }) => void;
  isCreateMode?: boolean;
}

export function EditTagModal({ isOpen, onClose, tag, onTagUpdated, isCreateMode = false }: EditTagModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#079df9");
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [focusedFields, setFocusedFields] = useState({
    name: false,
    color: false,
  });

  useEffect(() => {
    if (tag && !isCreateMode) {
      setName(tag.name);
      setColor(tag.color);
    } else if (isCreateMode) {
      setName("");
      setColor("#079df9");
    }
  }, [tag, isCreateMode]);

  const updateFocus = (field: string, focused: boolean) => {
    setFocusedFields(prev => ({ ...prev, [field]: focused }));
  };

  const handleSave = () => {
    if (!name.trim()) return;

    if (isCreateMode) {
      onTagUpdated({
        name: name.trim(),
        color: color
      });
    } else {
      if (!tag) return;
      onTagUpdated({
        id: tag.id,
        name: name.trim(),
        color: color
      });
    }
    
    // Close modal after save
    onClose();
  };

  const handleCancel = () => {
    if (tag && !isCreateMode) {
      setName(tag.name);
      setColor(tag.color);
    } else {
      setName("");
      setColor("#079df9");
    }
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {isCreateMode ? 'Criar Tag' : 'Editar Tag'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Nome Field */}
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => updateFocus('name', true)}
                onBlur={() => updateFocus('name', false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(209, 213, 219)' }}
              />
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.name || name
                    ? 'text-xs text-primary -top-2 bg-background px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
              >
                Nome
              </label>
            </div>

            {/* Cor Field */}
            <div className="relative">
              <input
                type="text"
                value={color.toUpperCase()}
                readOnly
                onFocus={() => updateFocus('color', true)}
                onBlur={() => updateFocus('color', false)}
                onClick={() => setIsColorPickerOpen(true)}
                className="w-full h-12 pt-2 pb-2 pl-12 pr-12 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(209, 213, 219)' }}
              />
              
              {/* Color Circle */}
              <div 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full border border-gray-300"
                style={{ backgroundColor: color }}
              />
              
              {/* Edit Icon */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                onClick={() => setIsColorPickerOpen(true)}
              >
                <Edit className="h-4 w-4 text-gray-500" />
              </Button>
              
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.color || color
                    ? 'text-xs text-primary -top-2 bg-background px-1'
                    : 'text-sm text-gray-500 top-3 left-12'
                }`}
              >
                Cor
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="border-red-500 text-red-500 hover:bg-red-50"
            >
              Cancelar
            </Button>
            <Button
              variant="warning"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ColorPickerModal
        open={isColorPickerOpen}
        onOpenChange={setIsColorPickerOpen}
        onColorSelect={setColor}
      />
    </>
  );
}