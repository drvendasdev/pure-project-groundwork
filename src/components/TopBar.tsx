import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { WalletModal } from "./modals/WalletModal";
import { WorkspaceSelector } from "./WorkspaceSelector";

interface TopBarProps {
  onNavigateToConversation?: (conversationId: string) => void;
}

export function TopBar({ onNavigateToConversation }: TopBarProps) {
  const [showWalletModal, setShowWalletModal] = useState(false);

  return (
    <>
      <div className="flex gap-2 mx-4 mt-4 mb-4">
        {/* Workspace Selector */}
        <div className="flex items-center">
          <WorkspaceSelector />
        </div>
        
        {/* Welcome Card */}
        <Card className="flex-1 relative overflow-hidden">
          <div 
            className="absolute right-0 top-0 w-1/2 h-full bg-cover bg-center bg-no-repeat opacity-100"
            style={{
              backgroundImage: "url('/lovable-uploads/0350fce5-76d3-4f93-a3d4-7a28486539b9.png')",
              filter: 'brightness(0.7)'
            }}
          />
          <CardContent className="p-6 relative z-10">
            <p className="text-xs font-semibold mb-2" style={{ color: 'black' }}>
              Bem Vindo
            </p>
            <h3 className="text-xl font-semibold mb-1" style={{ color: 'black' }}>
              CDE - Centro de Desenvolvimento Empresarial
            </h3>
            <p className="text-xs" style={{ color: 'rgb(107, 114, 128)' }}>
              Aqui estão algumas estatísticas da sua empresa
            </p>
          </CardContent>
        </Card>

        {/* Wallet Card */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-xl" style={{ color: 'black' }}>
              Minha carteira
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="flex items-center justify-between"
              style={{
                backgroundColor: 'rgb(245, 245, 245)',
                padding: 15,
                borderRadius: 14
              }}
            >
              <div className="text-2xl font-bold" style={{ color: 'black' }}>
                R$ 0
              </div>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setShowWalletModal(true)}
              >
                Adicionar Saldo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <WalletModal 
        open={showWalletModal} 
        onOpenChange={setShowWalletModal} 
      />
    </>
  );
}