import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function AdministracaoConfiguracoes() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
      </div>
      
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <Tabs defaultValue="opcoes" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50 rounded-t-lg rounded-b-none h-auto p-0">
            <TabsTrigger 
              value="opcoes" 
              className="rounded-t-lg rounded-b-none py-4 px-6 text-sm font-medium uppercase tracking-wide data-[state=active]:bg-transparent data-[state=active]:text-brand-yellow data-[state=active]:border-b-2 data-[state=active]:border-brand-yellow data-[state=active]:shadow-none"
            >
              Opções
            </TabsTrigger>
            <TabsTrigger 
              value="whitelabel" 
              className="rounded-t-lg rounded-b-none py-4 px-6 text-sm font-medium uppercase tracking-wide data-[state=active]:bg-transparent data-[state=active]:text-brand-yellow data-[state=active]:border-b-2 data-[state=active]:border-brand-yellow data-[state=active]:shadow-none"
            >
              White Label
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="opcoes" className="p-6 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Moeda */}
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-xs font-medium text-foreground">
                  Moeda
                </Label>
                <Select defaultValue="brl">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a moeda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brl">BRL (R$)</SelectItem>
                    <SelectItem value="usd">USD ($)</SelectItem>
                    <SelectItem value="eur">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Agendamento */}
              <div className="space-y-2">
                <Label htmlFor="schedule-type" className="text-xs font-medium text-foreground">
                  Tipo de Agendamento
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                    <SelectItem value="automatic">Automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Enviar Mensagens no Horário Comercial */}
              <div className="space-y-2">
                <Label htmlFor="business-hours" className="text-xs font-medium text-foreground">
                  Enviar Mensagens no Horário Comercial
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Enviar Saudação ao Aceitar */}
              <div className="space-y-2">
                <Label htmlFor="greeting-accept" className="text-xs font-medium text-foreground">
                  Enviar Saudação ao Aceitar
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Enviar Saudação na Transferência */}
              <div className="space-y-2">
                <Label htmlFor="greeting-transfer" className="text-xs font-medium text-foreground">
                  Enviar Saudação na Transferência
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sincronizar responsável da conversa com o negócio */}
              <div className="space-y-2">
                <Label htmlFor="sync-responsible" className="text-xs font-medium text-foreground">
                  Sincronizar o responsável da conversa com o negócio
                </Label>
                <Select defaultValue="disabled">
                  <SelectTrigger className="w-full border-t-0 border-l-0 border-r-0 border-b border-muted-foreground/40 bg-transparent rounded-none pt-1.5 pb-2 pr-6 pl-0 text-sm text-foreground select-none cursor-pointer shadow-none focus:ring-0 focus:outline-none">
                    <SelectValue placeholder="Selecione a opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desabilitado</SelectItem>
                    <SelectItem value="enabled">Habilitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="whitelabel" className="p-6 mt-0">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Configurações de White Label em desenvolvimento...</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}