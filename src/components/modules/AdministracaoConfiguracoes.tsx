import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WebhooksEvolutionConfig } from "./WebhooksEvolutionConfig";
import { EvolutionApiConfig } from "./EvolutionApiConfig";
import { WorkspaceSelector } from "@/components/WorkspaceSelector";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceConfig } from "@/hooks/useWorkspaceConfig";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useUnifiedTheme } from "@/hooks/useUnifiedTheme";

export function AdministracaoConfiguracoes() {
  const [connectionLimit, setConnectionLimit] = useState("1");
  const [loading, setLoading] = useState(false);
  const { selectedWorkspace } = useWorkspace();
  const { isMaster } = useWorkspaceRole();
  const { workspaces } = useWorkspaces();
  
  // Use workspace config
  const { 
    primaryColor: workspacePrimaryColor, 
    contrastColor: workspaceContrastColor,
    backgroundSolidEnabled: workspaceBackgroundSolidEnabled,
    backgroundSolidColor: workspaceBackgroundSolidColor,
    loginBanner: workspaceLoginBanner,
    favicon: workspaceFavicon,
    loading: configLoading
  } = useWorkspaceConfig();

  const { applyThemeColors } = useUnifiedTheme();
  
  // Local state for form inputs
  const [primaryColor, setPrimaryColor] = useState(workspacePrimaryColor || "");
  const [contrastColor, setContrastColor] = useState(workspaceContrastColor || "");
  const [backgroundSolidEnabled, setBackgroundSolidEnabled] = useState(false);
  const [backgroundSolidColor, setBackgroundSolidColor] = useState("");
  const [loginBannerUrl, setLoginBannerUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  
  // File upload refs
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const faviconFileRef = useRef<HTMLInputElement>(null);

  // Apply colors immediately when selected
  const handleColorChange = (colorType: 'primary' | 'contrast' | 'background', color: string) => {
    console.log(`🎨 Color changed: ${colorType} = ${color}`);
    
    if (colorType === 'primary') {
      setPrimaryColor(color);
      applyThemeColors?.(color, contrastColor, backgroundSolidEnabled, backgroundSolidColor);
    } else if (colorType === 'contrast') {
      setContrastColor(color);
      applyThemeColors?.(primaryColor, color, backgroundSolidEnabled, backgroundSolidColor);
    } else if (colorType === 'background') {
      setBackgroundSolidColor(color);
      applyThemeColors?.(primaryColor, contrastColor, backgroundSolidEnabled, color);
    }
    
    // Try to save to database
    saveWorkspaceConfig(colorType === 'primary' ? 'primary_color' : 
                       colorType === 'contrast' ? 'contrast_color' : 
                       'background_solid_color', color);
  };

  const handleBackgroundToggle = (enabled: boolean) => {
    setBackgroundSolidEnabled(enabled);
    applyThemeColors?.(primaryColor, contrastColor, enabled, backgroundSolidColor);
    saveWorkspaceConfig('background_solid_enabled', enabled);
  };

  // Sync form inputs with workspace config when it loads
  useEffect(() => {
    if (!configLoading) {
      console.log('🎨 Syncing form with workspace config');
      setPrimaryColor(workspacePrimaryColor || "");
      setContrastColor(workspaceContrastColor || "");
      setBackgroundSolidEnabled(workspaceBackgroundSolidEnabled || false);
      setBackgroundSolidColor(workspaceBackgroundSolidColor || "");
      setLoginBannerUrl(workspaceLoginBanner || "");
      setFaviconUrl(workspaceFavicon || "");
    }
  }, [configLoading, workspacePrimaryColor, workspaceContrastColor, workspaceBackgroundSolidEnabled, workspaceBackgroundSolidColor, workspaceLoginBanner, workspaceFavicon]);

  // Load GLOBAL limits
  useEffect(() => {
    const loadData = async () => {
      const GLOBAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';
      
      try {
        const userData = localStorage.getItem('currentUser');
        const currentUserData = userData ? JSON.parse(userData) : null;
        
        if (!currentUserData?.id) return;

        const headers = {
          'x-system-user-id': currentUserData.id,
          'x-system-user-email': currentUserData.email || '',
          'x-workspace-id': GLOBAL_CONFIG_ID
        };

        const { data: limitsData, error: limitsError } = await supabase.functions.invoke('get-workspace-limits', {
          body: { workspaceId: GLOBAL_CONFIG_ID },
          headers
        });

        if (!limitsError && limitsData?.connection_limit) {
          setConnectionLimit(limitsData.connection_limit.toString());
        }
      } catch (error) {
        console.error('❌ Error loading GLOBAL settings:', error);
      }
    };
    
    loadData();
  }, []);

  const handleConnectionLimitChange = async (value: string) => {
    const GLOBAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';

    setLoading(true);
    try {
      const numericValue = value === "unlimited" ? 999 : parseInt(value);
      
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      const headers = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || '',
        'x-workspace-id': GLOBAL_CONFIG_ID
      };

      const { error } = await supabase.functions.invoke('update-workspace-limits', {
        body: { 
          workspaceId: GLOBAL_CONFIG_ID,
          connectionLimit: numericValue 
        },
        headers
      });

      if (error) throw error;

      setConnectionLimit(value);
      toast({
        title: 'Configuração atualizada',
        description: 'Limite de conexões atualizado globalmente para todos os usuários'
      });
    } catch (error: any) {
      console.error('❌ Error updating connection limit:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Save GLOBAL workspace configuration via Edge Function
  const saveWorkspaceConfig = async (field: string, value: string | boolean) => {
    // GLOBAL CONFIG - ID fixo para todos os usuários
    const GLOBAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';

    try {
      console.log(`💾 Saving GLOBAL config: ${field} = ${value}`);

      const { data, error } = await supabase.functions.invoke('save-workspace-config', {
        body: {
          workspaceId: GLOBAL_CONFIG_ID,
          [field]: value
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Falha ao salvar configuração');
      }

      console.log('✅ GLOBAL Configuration saved successfully');
      
      toast({
        title: 'Configuração salva',
        description: 'A configuração foi atualizada globalmente para todos os usuários'
      });

    } catch (error: any) {
      console.error('❌ Error saving GLOBAL config:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Handle GLOBAL file upload
  const handleFileUpload = async (file: File, type: 'banner' | 'favicon') => {
    // GLOBAL CONFIG - ID fixo para todos os usuários
    const GLOBAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${GLOBAL_CONFIG_ID}-${Date.now()}.${fileExt}`;
      const filePath = `${GLOBAL_CONFIG_ID}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('workspace-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('workspace-media')
        .getPublicUrl(filePath);

      const url = data.publicUrl;

      if (type === 'banner') {
        setLoginBannerUrl(url);
        await saveWorkspaceConfig('login_banner_url', url);
      } else {
        setFaviconUrl(url);
        await saveWorkspaceConfig('favicon_url', url);
        updateFaviconInDOM(url);
      }

      toast({
        title: 'Upload realizado',
        description: `${type === 'banner' ? 'Banner' : 'Favicon'} atualizado com sucesso`
      });

    } catch (error: any) {
      console.error(`❌ Error uploading ${type}:`, error);
      toast({
        title: 'Erro no upload',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Function to update favicon in DOM
  const updateFaviconInDOM = (faviconUrl: string) => {
    const existingFavicon = document.querySelector('link[rel="icon"]');
    if (existingFavicon) {
      existingFavicon.remove();
    }

    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = faviconUrl;
    document.head.appendChild(link);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Configurações Globais</h1>
        <div className="text-sm text-muted-foreground bg-amber-100 dark:bg-amber-900/20 px-3 py-1 rounded-md">
          ⚠️ Configurações aplicadas para todos os usuários
        </div>
      </div>
      
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <Tabs defaultValue="opcoes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-primary/10 rounded-t-lg rounded-b-none h-auto p-0">
            <TabsTrigger value="opcoes" className="rounded-t-lg rounded-b-none py-4 px-6 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Opções
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="rounded-t-lg rounded-b-none py-4 px-6 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Webhooks (Evolution)
            </TabsTrigger>
            <TabsTrigger value="evolution-api" className="rounded-t-lg rounded-b-none py-4 px-6 text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Evolution API
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="opcoes" className="p-6 mt-0">
            <div className="space-y-8">
              {/* Configurações básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">Limite de Conexões WhatsApp (Global)</Label>
                  <Select value={connectionLimit} onValueChange={handleConnectionLimitChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o limite" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 conexão</SelectItem>
                      <SelectItem value="2">2 conexões</SelectItem>
                      <SelectItem value="5">5 conexões</SelectItem>
                      <SelectItem value="10">10 conexões</SelectItem>
                      <SelectItem value="unlimited">Ilimitado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Personalização Visual */}
              <div className="space-y-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-foreground">Personalização Visual Global</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Cor primária */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Cor primária</Label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={primaryColor || '#142976'}
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="w-12 h-8 rounded border border-input cursor-pointer flex-shrink-0"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => handleColorChange('primary', e.target.value)}
                        className="flex-1 bg-white text-gray-900 border-gray-300 focus:bg-white"
                        placeholder="#142976"
                      />
                    </div>
                  </div>

                  {/* Cor de contraste */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Cor de contraste (primária)</Label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={contrastColor || '#ffffff'}
                        onChange={(e) => handleColorChange('contrast', e.target.value)}
                        className="w-12 h-8 rounded border border-input cursor-pointer flex-shrink-0"
                      />
                      <Input
                        value={contrastColor}
                        onChange={(e) => handleColorChange('contrast', e.target.value)}
                        className="flex-1 bg-white text-gray-900 border-gray-300 focus:bg-white"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                </div>

                {/* Background solid */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Switch
                      checked={backgroundSolidEnabled}
                      onCheckedChange={handleBackgroundToggle}
                    />
                    <Label className="text-sm font-medium text-foreground">
                      Ativar cor sólida (Plano de fundo)
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-foreground">Cor sólida (Plano de fundo)</Label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={backgroundSolidColor || '#ffffff'}
                        onChange={(e) => handleColorChange('background', e.target.value)}
                        className={`w-12 h-8 rounded border border-input cursor-pointer flex-shrink-0 ${!backgroundSolidEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!backgroundSolidEnabled}
                      />
                      <Input
                        value={backgroundSolidColor}
                        onChange={(e) => handleColorChange('background', e.target.value)}
                        className={`flex-1 bg-white text-gray-900 border-gray-300 focus:bg-white ${!backgroundSolidEnabled ? 'opacity-50' : ''}`}
                        placeholder="#ffffff"
                        disabled={!backgroundSolidEnabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Global Theme Sync Button */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Sincronização Global</h4>
                      <p className="text-xs text-blue-700">Force a sincronização das cores em todos os dispositivos</p>
                    </div>
                    <Button
                      onClick={() => {
                        console.log('🔄 Manual global theme sync triggered');
                        applyThemeColors?.(primaryColor, contrastColor, backgroundSolidEnabled, backgroundSolidColor);
                        toast({
                          title: 'Sincronização forçada',
                          description: 'Cores foram sincronizadas globalmente'
                        });
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2"
                      size="sm"
                    >
                      🔄 Sincronizar
                    </Button>
                  </div>
                </div>

                {/* Logos e imagens */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Banner de Login */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground">Banner de Login</Label>
                    <div className="border border-input rounded-lg p-4 min-h-[120px] flex items-center justify-center bg-muted/30">
                      {loginBannerUrl ? (
                        <img src={loginBannerUrl} alt="Banner de Login" className="max-h-20 max-w-full object-contain" />
                      ) : (
                        <span className="text-muted-foreground font-bold text-2xl">TEZEUS</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={loginBannerUrl}
                        onChange={(e) => {
                          setLoginBannerUrl(e.target.value);
                          saveWorkspaceConfig('login_banner_url', e.target.value);
                        }}
                        placeholder="https://..."
                        className="flex-1 bg-white text-gray-900 border-gray-300 focus:bg-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => bannerFileRef.current?.click()}
                      >
                        📎
                      </Button>
                    </div>
                  </div>

                  {/* Favicon */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-foreground">Favicon</Label>
                    <div className="border border-input rounded-lg p-4 min-h-[120px] flex items-center justify-center bg-primary/20">
                      {faviconUrl ? (
                        <img src={faviconUrl} alt="Favicon" className="w-12 h-12 object-contain" />
                      ) : (
                        <div className="w-12 h-12 bg-primary rounded flex items-center justify-center">
                          <span className="text-primary-foreground font-bold text-sm">DR</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        value={faviconUrl}
                        onChange={(e) => {
                          setFaviconUrl(e.target.value);
                          saveWorkspaceConfig('favicon_url', e.target.value);
                          updateFaviconInDOM(e.target.value);
                        }}
                        placeholder="https://..."
                        className="flex-1 bg-white text-gray-900 border-gray-300 focus:bg-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => faviconFileRef.current?.click()}
                      >
                        📎
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Hidden file inputs */}
                <input
                  ref={bannerFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'banner');
                  }}
                />
                <input
                  ref={faviconFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'favicon');
                  }}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="webhooks" className="p-0 mt-0">
            <WebhooksEvolutionConfig />
          </TabsContent>

          <TabsContent value="evolution-api" className="p-0 mt-0">
            <EvolutionApiConfig />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}