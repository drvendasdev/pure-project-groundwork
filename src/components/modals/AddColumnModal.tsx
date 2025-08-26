import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pipette } from "lucide-react";
import { ColorPickerModal } from "./ColorPickerModal";

interface AddColumnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddColumn: (name: string, color: string) => void;
  isDarkMode?: boolean;
}

export function AddColumnModal({ open, onOpenChange, onAddColumn, isDarkMode = false }: AddColumnModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#ff0000");
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleSubmit = () => {
    if (name.trim()) {
      onAddColumn(name.trim(), color);
      setName("");
      setColor("#ff0000");
      onOpenChange(false);
    }
  };

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
    setShowColorPicker(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`sm:max-w-md ${isDarkMode ? 'bg-[#2d2d2d] border-gray-600' : 'bg-white'}`}>
          <DialogHeader>
            <DialogTitle className={isDarkMode ? 'text-white' : 'text-gray-900'}>
              Adicionar Coluna
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={isDarkMode ? 'bg-[#3d3d3d] border-gray-600 text-white' : ''}
              />
            </div>
            
            <div>
              <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Cor
              </label>
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: color }}
                  onClick={() => setShowColorPicker(true)}
                >
                  <Pipette 
                    className="w-4 h-4 text-white drop-shadow-lg" 
                    onClick={() => setShowColorPicker(true)}
                  />
                </div>
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className={`flex-1 ${isDarkMode ? 'bg-[#3d3d3d] border-gray-600 text-white' : ''}`}
                  placeholder="#000000"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className={isDarkMode ? 'border-gray-600 text-white hover:bg-gray-700' : ''}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit}
                className="bg-warning hover:bg-yellow-500 text-black"
                disabled={!name.trim()}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ColorPickerModal
        open={showColorPicker}
        onOpenChange={setShowColorPicker}
        onColorSelect={handleColorSelect}
        isDarkMode={isDarkMode}
      />
    </>
  );
}