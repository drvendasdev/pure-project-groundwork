import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CriarNegocioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBusiness: (business: any) => void;
  isDarkMode?: boolean;
}

export function CriarNegocioModal({ isOpen, onClose, onCreateBusiness, isDarkMode = false }: CriarNegocioModalProps) {
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedResponsible, setSelectedResponsible] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const newBusiness = {
      stage: selectedStage,
      responsible: selectedResponsible,
      product: selectedProduct,
      value: value
    };
    
    onCreateBusiness(newBusiness);
    
    // Reset form
    setSelectedStage("");
    setSelectedResponsible("");
    setSelectedProduct("");
    setValue("");
    
    onClose();
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
            Criar Negócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de etapa */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Selecione a Etapa
            </Label>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Selecione uma etapa" />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                <SelectItem value="prospeccao" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Prospecção
                </SelectItem>
                <SelectItem value="qualificacao" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Qualificação
                </SelectItem>
                <SelectItem value="proposta" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Proposta
                </SelectItem>
                <SelectItem value="negociacao" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Negociação
                </SelectItem>
                <SelectItem value="fechamento" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Fechamento
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de responsável */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Selecione o responsável
            </Label>
            <Select value={selectedResponsible} onValueChange={setSelectedResponsible}>
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Selecione um responsável" />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                <SelectItem value="joao" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  João Silva
                </SelectItem>
                <SelectItem value="maria" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Maria Santos
                </SelectItem>
                <SelectItem value="pedro" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Pedro Costa
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de produto (opcional) */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Selecione o produto (Opcional)
            </Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                <SelectItem value="produto1" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Produto A
                </SelectItem>
                <SelectItem value="produto2" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Produto B
                </SelectItem>
                <SelectItem value="produto3" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Produto C
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campo de valor */}
          <div>
            <Label htmlFor="value" className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Valor
            </Label>
            <Input
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="R$ 0,00"
              className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" 
                  : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
              )}
            />
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className={cn(
              isDarkMode 
                ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            )}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}