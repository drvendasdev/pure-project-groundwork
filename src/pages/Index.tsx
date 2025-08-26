import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
          {/* Main Heading */}
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Hello, World
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
              Bem-vindo à sua nova landing page criada com React, TypeScript e Tailwind CSS
            </p>
          </div>
          
          {/* CTA Buttons */}
          <div className="flex gap-4 flex-wrap justify-center">
            <Button size="lg" className="text-lg px-8 py-3">
              Começar Agora
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-3">
              Saiba Mais
            </Button>
          </div>
        </div>
        
        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Moderno</h3>
            <p className="text-muted-foreground">
              Construído com as tecnologias mais recentes para máxima performance
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Responsivo</h3>
            <p className="text-muted-foreground">
              Design que se adapta perfeitamente a qualquer dispositivo
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg border shadow-sm">
            <h3 className="text-xl font-semibold mb-3">Rápido</h3>
            <p className="text-muted-foreground">
              Otimizado para carregamento ultrarrápido e ótima experiência
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
