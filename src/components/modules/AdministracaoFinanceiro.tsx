export function AdministracaoFinanceiro() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Administração - Financeiro</h1>
      <div className="bg-error/10 border border-error/20 rounded-lg p-4">
        <p className="text-error font-medium">Você não possui permissão para acessar este recurso!</p>
      </div>
    </div>
  );
}