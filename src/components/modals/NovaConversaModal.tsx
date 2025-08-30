import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';

interface NovaConversaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateConversation: (titulo: string, selectedUser: string) => void;
}

export function NovaConversaModal({ open, onOpenChange, onCreateConversation }: NovaConversaModalProps) {
  const [titulo, setTitulo] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  
  // Estados para floating labels
  const [tituloIsFocused, setTituloIsFocused] = useState(false);
  const [userIsFocused, setUserIsFocused] = useState(false);

  // Reset floating label states quando modal fechar
  useEffect(() => {
    if (!open) {
      setTituloIsFocused(false);
      setUserIsFocused(false);
      setTitulo('');
      setSelectedUser('');
    }
  }, [open]);

  const handleSubmit = () => {
    onCreateConversation(titulo, selectedUser);
    onOpenChange(false);
  };

  const isFormValid = titulo.trim() !== '' && selectedUser !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Conversa</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Campo Título com Floating Label */}
          <div className="relative">
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onFocus={() => setTituloIsFocused(true)}
              onBlur={() => setTituloIsFocused(false)}
              className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
            />
            <label 
              className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                tituloIsFocused || titulo ? 
                '-top-2 text-xs text-yellow-500 font-medium' : 
                'top-1/2 -translate-y-1/2 text-gray-500'
              }`}
              style={{ backgroundColor: 'white' }}
            >
              Título
            </label>
          </div>
          
          {/* Campo Users com Floating Label */}
          <div className="relative">
            <div className="relative">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                onFocus={() => setUserIsFocused(true)}
                onBlur={() => setUserIsFocused(false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 appearance-none bg-white"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              >
                <option value=""></option>
                <option value="user1">Usuário 1</option>
                <option value="user2">Usuário 2</option>
                <option value="user3">Usuário 3</option>
              </select>
              <label 
                className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                  userIsFocused || selectedUser ? 
                  '-top-2 text-xs text-yellow-500 font-medium' : 
                  'top-1/2 -translate-y-1/2 text-gray-500'
                }`}
                style={{ backgroundColor: 'white' }}
              >
                Filtro por Users
              </label>
              {/* Seta dropdown personalizada */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-white">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isFormValid}
            variant="yellow"
          >
            Criar Conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}