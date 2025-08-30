import { MessageCircle, Users, Edit2, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NovaConversaModal } from '@/components/modals/NovaConversaModal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

interface Conversation {
  id: string;
  titulo: string;
  users: string[];
  lastMessage?: string;
}

export function RecursosChats() {
  const [novaConversaOpen, setNovaConversaOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');

  const handleCreateConversation = (titulo: string, selectedUser: string) => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      titulo,
      users: [selectedUser],
      lastMessage: undefined
    };
    setConversations([...conversations, newConversation]);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(conversations.filter(conv => conv.id !== id));
    if (selectedConversation?.id === id) {
      setSelectedConversation(null);
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && selectedConversation) {
      // TODO: Implement message sending logic
      console.log('Sending message:', message);
      setMessage('');
    }
  };

  const getInitials = (titulo: string) => {
    return titulo.substring(0, 2).toUpperCase();
  };
  
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 flex">
        {/* Lado Esquerdo - Nova Conversa e Lista */}
        <div className="w-80 border-r border-border flex flex-col bg-slate-50">
          <div className="p-4">
            <Button 
              className="w-auto bg-yellow-500 hover:bg-yellow-600 text-black"
              onClick={() => setNovaConversaOpen(true)}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Nova Conversa
            </Button>
          </div>
          
          {/* Lista de Conversas */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <Users className="w-16 h-16 text-gray-400 mb-4" />
                <h6 className="text-lg font-medium mb-2">Nenhuma conversa</h6>
                <p className="text-sm text-muted-foreground">
                  Crie uma nova conversa para começar a conversar com sua equipe
                </p>
              </div>
            ) : (
              <div className="px-2">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`relative group p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                      selectedConversation?.id === conversation.id
                        ? 'bg-yellow-100'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10 bg-yellow-500 text-black">
                        <AvatarFallback>{getInitials(conversation.titulo)}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1 mb-1">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-sm truncate">
                            {conversation.titulo}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {conversation.lastMessage || 'Sem mensagens'}
                        </p>
                      </div>
                      
                      {/* Ações - aparecem no hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implementar edição
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 hover:bg-red-100 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(conversation.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Área de Chat - Lado Direito */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Header da Conversa */}
              <div className="p-4 border-b border-border bg-white flex items-center space-x-2">
                <MessageCircle className="w-5 h-5 text-yellow-500" />
                <span className="font-medium">{selectedConversation.titulo}</span>
              </div>
              
              {/* Área de Mensagens */}
              <div className="flex-1 bg-gray-50 p-4">
                {/* TODO: Implementar lista de mensagens */}
              </div>
              
              {/* Input de Mensagem */}
              <div className="p-4 bg-white border-t border-border">
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <Textarea
                      placeholder="Digite sua mensagem..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="min-h-[40px] max-h-[120px] resize-none bg-white"
                    />
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    size="icon"
                    className="h-10 w-10"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-50">
              <div className="text-center">
                <div className="w-32 h-32 bg-yellow-100 rounded-lg flex items-center justify-center mb-6 mx-auto">
                  <MessageCircle className="w-16 h-16 text-yellow-600" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Bem-vindo ao Chat</h2>
                <p className="text-muted-foreground max-w-md">
                  Selecione uma conversa existente ou crie uma nova para começar a conversar com sua equipe
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <NovaConversaModal 
        open={novaConversaOpen}
        onOpenChange={setNovaConversaOpen}
        onCreateConversation={handleCreateConversation}
      />
    </div>
  );
}