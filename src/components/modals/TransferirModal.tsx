import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface TransferirModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

export function TransferirModal({ isOpen, onClose, isDarkMode = false }: TransferirModalProps) {
  const [searchUser, setSearchUser] = useState("");
  const [selectedSector, setSelectedSector] = useState("vendas");
  const [selectedConnection, setSelectedConnection] = useState("");

  const handleTransfer = () => {
    // Lógica para transferir ticket
    console.log("Ticket transferido");
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
            Transferir Ticket
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campo de busca de usuários */}
          <div>
            <Label htmlFor="searchUser" className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Buscar Usuário
            </Label>
            <div className="relative mt-1">
              <Search className={cn(
                "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                isDarkMode ? "text-gray-400" : "text-gray-500"
              )} />
              <Input
                id="searchUser"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Digite para buscar usuários"
                className={cn(
                  "pl-10",
                  isDarkMode 
                    ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" 
                    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                )}
              />
            </div>
          </div>

          {/* Seleção de setor */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Setor
            </Label>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                <SelectItem value="vendas" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Vendas
                </SelectItem>
                <SelectItem value="suporte" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Suporte
                </SelectItem>
                <SelectItem value="financeiro" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Financeiro
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Seleção de conexão */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Conexão
            </Label>
            <Select value={selectedConnection} onValueChange={setSelectedConnection}>
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Selecione uma Conexão" />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                <SelectItem value="conexao1" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Conexão 1
                </SelectItem>
                <SelectItem value="conexao2" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Conexão 2
                </SelectItem>
              </SelectContent>
            </Select>
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
            onClick={handleTransfer}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Transferir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}