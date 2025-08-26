import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ColorPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColorSelect: (color: string) => void;
  isDarkMode?: boolean;
}

export function ColorPickerModal({ open, onOpenChange, onColorSelect, isDarkMode = false }: ColorPickerModalProps) {
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open) {
      drawColorPicker();
      drawHueBar();
    }
  }, [open]);

  const drawColorPicker = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Create gradient from white to black (left to right)
    const horizontalGradient = ctx.createLinearGradient(0, 0, width, 0);
    horizontalGradient.addColorStop(0, 'white');
    horizontalGradient.addColorStop(1, 'red');

    ctx.fillStyle = horizontalGradient;
    ctx.fillRect(0, 0, width, height);

    // Create gradient from transparent to black (top to bottom)
    const verticalGradient = ctx.createLinearGradient(0, 0, 0, height);
    verticalGradient.addColorStop(0, 'transparent');
    verticalGradient.addColorStop(1, 'black');

    ctx.fillStyle = verticalGradient;
    ctx.fillRect(0, 0, width, height);
  };

  const drawHueBar = () => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.17, '#ff8800');
    gradient.addColorStop(0.33, '#ffff00');
    gradient.addColorStop(0.5, '#00ff00');
    gradient.addColorStop(0.67, '#00ffff');
    gradient.addColorStop(0.83, '#0088ff');
    gradient.addColorStop(1, '#ff00ff');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(x, y, 1, 1);
    const [r, g, b] = imageData.data;
    
    const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    setSelectedColor(color);
  };

  const handleHueClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(x, 10, 1, 1);
    const [r, g, b] = imageData.data;
    
    const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    setSelectedColor(color);
    
    // Redraw main picker with new hue
    const mainCanvas = canvasRef.current;
    const mainCtx = mainCanvas?.getContext('2d');
    if (!mainCtx || !mainCanvas) return;

    const width = mainCanvas.width;
    const height = mainCanvas.height;

    // Clear and redraw with new hue
    mainCtx.clearRect(0, 0, width, height);
    
    const horizontalGradient = mainCtx.createLinearGradient(0, 0, width, 0);
    horizontalGradient.addColorStop(0, 'white');
    horizontalGradient.addColorStop(1, color);

    mainCtx.fillStyle = horizontalGradient;
    mainCtx.fillRect(0, 0, width, height);

    const verticalGradient = mainCtx.createLinearGradient(0, 0, 0, height);
    verticalGradient.addColorStop(0, 'transparent');
    verticalGradient.addColorStop(1, 'black');

    mainCtx.fillStyle = verticalGradient;
    mainCtx.fillRect(0, 0, width, height);
  };

  const handleConfirm = () => {
    onColorSelect(selectedColor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-md ${isDarkMode ? 'bg-[#2d2d2d] border-gray-600' : 'bg-white'}`}>
        <DialogHeader>
          <DialogTitle className={isDarkMode ? 'text-white' : 'text-gray-900'}>
            Escolha uma cor
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Main color picker */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={300}
              height={200}
              className="w-full h-48 border border-gray-300 rounded cursor-crosshair"
              onClick={handleCanvasClick}
            />
          </div>
          
          {/* Hue bar */}
          <div className="relative">
            <canvas
              ref={hueCanvasRef}
              width={300}
              height={20}
              className="w-full h-5 border border-gray-300 rounded cursor-crosshair"
              onClick={handleHueClick}
            />
          </div>
          
          {/* Selected color preview */}
          <div className="flex items-center gap-2">
            <div 
              className="w-8 h-8 border border-gray-300 rounded"
              style={{ backgroundColor: selectedColor }}
            />
            <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {selectedColor}
            </span>
          </div>
          
          <div className="flex justify-end">
            <Button 
              onClick={handleConfirm}
              className="bg-warning hover:bg-yellow-500 text-black"
            >
              Concluir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}