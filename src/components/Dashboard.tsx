
import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { DollarSign, Handshake, TrendingUp, Plus, BarChart3, Tag, ChevronDown, UserCheck, X } from "lucide-react";
import { Badge } from "./ui/badge";
import Chart from "react-apexcharts";
import { MetricModal } from "./modals/MetricModal";
import { PeriodFilterModal } from "./modals/PeriodFilterModal";
import { WalletModal } from "./modals/WalletModal";

export function Dashboard({ isDarkMode }: { isDarkMode?: boolean }) {
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("01/07/2025 - 17/07/2025");
  const [usuarioValue, setUsuarioValue] = useState("");
  const [usuarioFocused, setUsuarioFocused] = useState(false);
  const [metricasValue, setMetricasValue] = useState("vendas");
  const [metricasFocused, setMetricasFocused] = useState(false);
const [tags, setTags] = useState<{ name: string, contacts: number, conversations: number, color: string }[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const suggestedTags = [
    "Cliente revendedor", 
    "Cliente varejo", 
    "Guia turístico", 
    "Lojista do Feirão do 1ª", 
    "Lojista outro Feirão", 
    "TESTE INTERNO"
  ];

  const tagColors = [
    "#9333ea", // purple
    "#dc2626", // red
    "#059669", // green
    "#ea580c", // orange
    "#0284c7", // blue
    "#7c2d12"  // brown
  ];

  const handlePeriodSelect = (period: { startDate: Date; endDate: Date; label: string }) => {
    setSelectedPeriod(period.label);
  };

  const addTag = (tagName: string) => {
    if (!tags.find(tag => tag.name === tagName)) {
      const newTag = {
        name: tagName,
        contacts: tagName === "TESTE INTERNO" ? 12 : 0,
        conversations: tagName === "TESTE INTERNO" ? 17 : 0,
        color: tagColors[tags.length % tagColors.length]
      };
      setTags([...tags, newTag]);
    }
    setNewTagName("");
    setShowTagModal(false);
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag.name !== tagToRemove));
  };

  const openTagModal = () => {
    setShowTagModal(true);
    setNewTagName("");
    setShowSuggestions(false);
  };

  const chartOptions = {
    chart: {
      type: 'line' as const,
      height: 320,
      toolbar: {
        show: false
      },
      background: 'transparent'
    },
    colors: ['#10B981'],
    stroke: {
      curve: 'smooth' as const,
      width: 3
    },
    grid: {
      show: true,
      borderColor: isDarkMode ? '#374151' : '#E5E7EB',
      strokeDashArray: 5
    },
    xaxis: {
      categories: ['1/jul', '2/jul', '3/jul', '4/jul', '5/jul', '6/jul', '7/jul', '8/jul', '9/jul', '10/jul', '11/jul', '12/jul', '13/jul', '14/jul', '15/jul', '16/jul', '17/jul', '18/jul', '19/jul', '20/jul'],
      labels: {
        style: {
          colors: isDarkMode ? '#9CA3AF' : '#6B7280',
          fontSize: '12px'
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      min: 0,
      max: 5000,
      labels: {
        style: {
          colors: isDarkMode ? '#9CA3AF' : '#6B7280',
          fontSize: '12px'
        },
        formatter: (value: number) => value.toLocaleString()
      }
    },
    markers: {
      size: 0,
      hover: {
        size: 8
      }
    },
    tooltip: {
      theme: isDarkMode ? 'dark' : 'light'
    }
  };

  const chartSeries = [{
    name: 'Vendas',
    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 850, 0, 0, 5000, 0, 5000, 0, 0]
  }];

  const metrics = [
    {
      title: "Vendas",
      value: "0",
      icon: <UserCheck className="w-5 h-5" />,
    },
    {
      title: "Conversão de negócios", 
      value: "0",
      icon: <Handshake className="w-5 h-5" />,
    },
    {
      title: "Ticket médio",
      value: "R$ 0",
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      title: "Valor de Vendas",
      value: "R$ 0", 
      icon: <DollarSign className="w-5 h-5" />,
    }
  ];

  return (
    <>
      <div 
        className="mr-2 mt-2 mb-2 space-y-2" 
        style={{ backgroundColor: isDarkMode ? '#333' : 'rgb(228, 219, 244)' }}
      >
        {/* TopBar Cards */}
        <div className="flex gap-2">
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
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  onClick={() => setShowWalletModal(true)}
                >
                  Adicionar Saldo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card style={{ 
          backgroundColor: isDarkMode ? '#424242' : 'white',
          border: isDarkMode ? '1px solid #424242' : '1px solid rgb(229, 231, 235)'
        }}>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="relative">
                <Input 
                  value={selectedPeriod} 
                  className="w-64 h-12 pt-2 pb-2 peer placeholder-transparent border border-input cursor-pointer"
                  placeholder="Período"
                  readOnly
                  onClick={() => setShowPeriodModal(true)}
                  style={{ 
                    backgroundColor: isDarkMode ? '#424242' : 'white',
                    color: isDarkMode ? 'white' : 'black',
                    borderColor: isDarkMode ? '#D1D5DB' : 'rgb(229, 231, 235)'
                  }}
                />
                <label 
                  className="absolute left-3 -top-2 text-xs text-yellow-500 font-medium px-2 transition-all duration-200 pointer-events-none"
                  style={{ 
                    backgroundColor: isDarkMode ? '#424242' : 'white'
                  }}
                >
                  Período
                </label>
              </div>
              
              <div className="relative">
                <select 
                  value={usuarioValue}
                  onChange={(e) => setUsuarioValue(e.target.value)}
                  onFocus={() => setUsuarioFocused(true)}
                  onBlur={() => setUsuarioFocused(false)}
                  className="w-64 h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  style={{ 
                    backgroundColor: isDarkMode ? '#424242' : 'white',
                    color: isDarkMode ? 'white' : 'black',
                    borderColor: isDarkMode ? '#D1D5DB' : 'rgb(229, 231, 235)'
                  }}
                >
                  <option value="" disabled hidden></option>
                  <option value="cde">CDE - Centro de Desenvolvimento Empresarial</option>
                  <option value="kamilla">Kamilla Oliveira</option>
                  <option value="luciano">Luciano</option>
                  <option value="brayam">Brayam</option>
                  <option value="sergio">Sergio Ricardo Rocha</option>
                </select>
                <label 
                  className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                    usuarioFocused || usuarioValue ? 
                    '-top-2 text-xs text-yellow-500 font-medium' : 
                    'top-1/2 -translate-y-1/2 text-gray-500'
                  }`}
                  style={{ backgroundColor: isDarkMode ? '#424242' : 'white' }}
                >
                  Usuário
                </label>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              <Button className="bg-yellow-500 hover:bg-yellow-600 text-black flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Métricas
              </Button>
              
              <div className="relative">
                <select 
                  value={metricasValue}
                  onChange={(e) => setMetricasValue(e.target.value)}
                  onFocus={() => setMetricasFocused(true)}
                  onBlur={() => setMetricasFocused(false)}
                  className="w-64 h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  style={{ 
                    backgroundColor: isDarkMode ? '#424242' : 'white',
                    color: isDarkMode ? 'white' : 'black',
                    borderColor: isDarkMode ? '#D1D5DB' : 'rgb(229, 231, 235)'
                  }}
                >
                  <option value="vendas">Vendas</option>
                  <option value="conversao">Conversão</option>
                  <option value="ticket">Ticket Médio</option>
                </select>
                <label 
                  className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                    metricasFocused || metricasValue ? 
                    '-top-2 text-xs text-yellow-500 font-medium' : 
                    'top-1/2 -translate-y-1/2 text-gray-500'
                  }`}
                  style={{ backgroundColor: isDarkMode ? '#424242' : 'white' }}
                >
                  Métricas
                </label>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {metrics.map((metric, index) => (
            <Card 
              key={index} 
              className="shadow-sm"
              style={{ 
                backgroundColor: isDarkMode ? '#424242' : 'white',
                border: isDarkMode ? '1px solid #424242' : '1px solid rgb(229, 231, 235)'
              }}
            >
              <CardContent className="p-[0.6rem]">
                <div className="flex items-center justify-between">
                  <div>
                    <p 
                      className="text-sm font-medium mb-2"
                      style={{ color: isDarkMode ? 'rgb(229, 231, 235)' : 'rgb(31, 41, 55)' }}
                    >
                      {metric.title}
                    </p>
                    <p 
                      className="text-2xl font-bold"
                      style={{ color: isDarkMode ? 'white' : 'rgb(17, 24, 39)' }}
                    >
                      {metric.value}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-black">
                    {metric.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart Section */}
        <Card style={{ 
          backgroundColor: isDarkMode ? '#424242' : 'white',
          border: isDarkMode ? '1px solid #424242' : '1px solid rgb(229, 231, 235)'
        }}>
          <CardHeader>
            <CardTitle style={{ color: isDarkMode ? 'white' : 'black' }}>
              Visão geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Chart
                options={chartOptions}
                series={chartSeries}
                type="line"
                height={320}
              />
            </div>
          </CardContent>
        </Card>

        {/* Add Tag Section */}
        <div className="space-y-4">
          {/* Tags criadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tags.map((tag, index) => (
              <Card 
                key={index} 
                className="relative"
                style={{
                  backgroundColor: tag.color,
                  border: 'none'
                }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-white/20 text-white"
                  onClick={() => removeTag(tag.name)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    {tag.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-white">
                  <div className="space-y-1 text-sm">
                    <div>Contatos: <span className="font-bold">{tag.contacts}</span></div>
                    <div>Conversas: <span className="font-bold">{tag.conversations}</span></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Botão Adicionar Tag */}
          <Card 
            className="border-2 border-dashed cursor-pointer hover:opacity-80 transition-opacity"
            style={{ 
              backgroundColor: isDarkMode ? '#424242' : 'rgb(250, 245, 255)',
              borderColor: isDarkMode ? '#555' : 'rgb(196, 181, 253)'
            }}
            onClick={openTagModal}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-purple-600">
                <Tag className="w-5 h-5" />
                <span className="font-medium">Adicionar Tag</span>
                <Plus className="w-4 h-4" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Sections */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          {/* SDRs Performance */}
          <Card style={{ 
            backgroundColor: isDarkMode ? '#424242' : 'white',
            border: isDarkMode ? '1px solid #424242' : '1px solid rgb(229, 231, 235)'
          }}>
            <CardHeader>
              <CardTitle style={{ color: isDarkMode ? 'white' : 'black' }}>
                Desempenho dos SDRs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div 
                  className="flex justify-between text-sm font-medium"
                  style={{ color: isDarkMode ? 'rgb(156, 163, 175)' : 'rgb(75, 85, 99)' }}
                >
                  <span>Nome</span>
                  <span>Leads</span>
                  <span>Ligações</span>
                  <span>Conexões</span>
                  <span>Reuniões</span>
                </div>
                <div className="text-center py-8 text-gray-500">
                  Nenhum SDR encontrado
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Closers Performance */}
          <Card style={{ 
            backgroundColor: isDarkMode ? '#424242' : 'white',
            border: isDarkMode ? '1px solid #424242' : '1px solid rgb(229, 231, 235)'
          }}>
            <CardHeader>
              <CardTitle style={{ color: isDarkMode ? 'white' : 'black' }}>
                Desempenho dos Closers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div 
                  className="flex justify-between text-sm font-medium"
                  style={{ color: isDarkMode ? 'rgb(156, 163, 175)' : 'rgb(75, 85, 99)' }}
                >
                  <span>Nome</span>
                  <span>Leads</span>
                  <span>Reuniões realizadas</span>
                  <span>Vendas</span>
                </div>
                <div className="text-center py-8 text-gray-500">
                  Nenhum closer encontrado
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products Sold */}
        <Card style={{ 
          backgroundColor: isDarkMode ? '#424242' : 'white',
          border: isDarkMode ? '1px solid #424242' : '1px solid rgb(229, 231, 235)'
        }}>
          <CardHeader>
            <CardTitle style={{ color: isDarkMode ? 'white' : 'black' }}>
              Produtos vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div 
                className="grid grid-cols-5 gap-4 text-sm font-medium"
                style={{ color: isDarkMode ? 'rgb(156, 163, 175)' : 'rgb(75, 85, 99)' }}
              >
                <span>Nome</span>
                <span>Negociações</span>
                <span>Quantidade vendida</span>
                <span>Valor vendido</span>
                <span>Situação</span>
              </div>
              <div className="text-center py-8 text-gray-500">
                Nenhum produto vendido
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <MetricModal 
        open={showMetricModal} 
        onOpenChange={setShowMetricModal} 
      />

      <PeriodFilterModal 
        open={showPeriodModal} 
        onOpenChange={setShowPeriodModal} 
        onPeriodSelect={handlePeriodSelect}
      />

      <WalletModal 
        open={showWalletModal} 
        onOpenChange={setShowWalletModal} 
      />

      {/* Dialog for adding tags */}
      <Dialog open={showTagModal} onOpenChange={setShowTagModal}>
        <DialogContent 
          className="max-w-md"
          style={{
            backgroundColor: isDarkMode ? '#424242' : 'white',
            borderColor: isDarkMode ? '#555' : 'rgb(229, 231, 235)'
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: isDarkMode ? 'white' : 'black' }}>
              Nome
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Input
                value={newTagName}
                onChange={(e) => {
                  setNewTagName(e.target.value);
                  setShowSuggestions(e.target.value.length > 0);
                }}
                placeholder="Digite o nome da tag"
                className="w-full"
                style={{
                  backgroundColor: isDarkMode ? '#333' : 'white',
                  borderColor: '#fbbf24',
                  color: isDarkMode ? 'white' : 'black'
                }}
              />
              
              {/* Dropdown de sugestões */}
              {showSuggestions && (
                <div 
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
                  style={{
                    backgroundColor: isDarkMode ? '#333' : 'white',
                    borderColor: isDarkMode ? '#555' : 'rgb(229, 231, 235)'
                  }}
                >
                  {suggestedTags
                    .filter(tag => tag.toLowerCase().includes(newTagName.toLowerCase()))
                    .map((tag, index) => (
                      <div
                        key={index}
                        className="px-4 py-3 cursor-pointer hover:bg-gray-100 text-sm border-b border-gray-200"
                        style={{
                          color: isDarkMode ? 'white' : 'black',
                          backgroundColor: isDarkMode ? '#333' : 'white'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isDarkMode ? '#555' : '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : 'white';
                        }}
                        onClick={() => addTag(tag)}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tagColors[index % tagColors.length] }}
                          ></div>
                          {tag}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowTagModal(false)}
                style={{
                  borderColor: isDarkMode ? '#555' : 'rgb(229, 231, 235)',
                  color: isDarkMode ? 'white' : 'black'
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => newTagName.trim() && addTag(newTagName.trim())}
                disabled={!newTagName.trim()}
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
              >
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
