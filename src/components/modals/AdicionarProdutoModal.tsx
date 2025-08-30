import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AdicionarProdutoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (produto: { nome: string; valor: number }) => void;
}

export function AdicionarProdutoModal({ 
  isOpen, 
  onClose, 
  onAddProduct 
}: AdicionarProdutoModalProps) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  
  // Estados para floating labels
  const [nomeIsFocused, setNomeIsFocused] = useState(false);
  const [valorIsFocused, setValorIsFocused] = useState(false); // Para controlar cor amarela

  // Reset floating label states quando modal fechar
  useEffect(() => {
    if (!isOpen) {
      setNomeIsFocused(false);
      setValorIsFocused(false); // Reset focus state
      setNome("");
      setValor("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nome && valor) {
      const valorNumerico = parseFloat(valor.replace(",", "."));
      if (!isNaN(valorNumerico)) {
        onAddProduct({ nome, valor: valorNumerico });
        setNome("");
        setValor("");
        setNomeIsFocused(false);
        setValorIsFocused(false); // Reset focus state
        onClose();
      }
    }
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers, comma and dot
    if (/^[\d.,]*$/.test(value)) {
      setValor(value);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-left">
            Novo Produto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Campo Nome com Floating Label */}
            <div className="relative">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onFocus={() => setNomeIsFocused(true)}
                onBlur={() => setNomeIsFocused(false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              />
              <label 
                className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                  nomeIsFocused || nome ? 
                  '-top-2 text-xs text-yellow-500 font-medium' : 
                  'top-1/2 -translate-y-1/2 text-gray-500'
                }`}
                style={{ backgroundColor: 'white' }}
              >
                Nome
              </label>
            </div>

            {/* Campo Valor com Floating Label e Prefixo R$ */}
            <div className="relative">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none z-10">
                  R$
                </span>
                <input
                  type="text"
                  value={valor}
                  onChange={handleValorChange}
                  onFocus={() => setValorIsFocused(true)}
                  onBlur={() => setValorIsFocused(false)}
                  className="w-full h-12 pt-2 pb-2 pl-10 pr-3 border border-input text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
                  placeholder=""
                />
              </div>
              <label 
                className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 -top-2 text-xs font-medium ${
                  valorIsFocused ? 'text-yellow-500' : 'text-gray-500'
                }`}
                style={{ backgroundColor: 'white' }}
              >
                Valor
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-red-500 border-red-500 hover:bg-red-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-yellow-500 text-black hover:bg-yellow-600"
              disabled={!nome || !valor}
            >
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}