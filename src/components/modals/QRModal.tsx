import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelName: string;
  instance: string;
  onConnectionSuccess: () => void;
}

export function QRModal({ isOpen, onClose, channelName, instance, onConnectionSuccess }: QRModalProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);
  const stateCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const generateQRCode = async (code: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(code, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Erro ao gerar QR code');
    }
  };

  const startSSEConnection = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log(`Starting SSE connection for instance: ${instance}`);
    const eventSource = new EventSource(
      `https://zldeaozqxjwvzgrblyrh.supabase.co/functions/v1/evo-stream?instance=${instance}`
    );

    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };

    eventSource.addEventListener('qrcode', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received QR code update:', data);
        
        if (data.code) {
          generateQRCode(data.code);
        }
        if (data.pairingCode) {
          setPairingCode(data.pairingCode);
        }
      } catch (error) {
        console.error('Error parsing QR code event:', error);
      }
    });

    eventSource.addEventListener('state', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received state update:', data);
        
        if (data.state === 'open') {
          setConnectionStatus('connected');
          toast.success('WhatsApp conectado com sucesso!');
          onConnectionSuccess();
          onClose();
        } else if (data.state === 'connecting') {
          setConnectionStatus('connecting');
        } else {
          setConnectionStatus('disconnected');
        }
      } catch (error) {
        console.error('Error parsing state event:', error);
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };

    eventSourceRef.current = eventSource;
  };

  const startStatePolling = () => {
    if (stateCheckIntervalRef.current) {
      clearInterval(stateCheckIntervalRef.current);
    }

    stateCheckIntervalRef.current = setInterval(async () => {
      try {
        const response = await supabase.functions.invoke('evo-state', {
          body: { instance }
        });

        if (response.data?.state === 'open') {
          setConnectionStatus('connected');
          toast.success('WhatsApp conectado com sucesso!');
          onConnectionSuccess();
          onClose();
        }
      } catch (error) {
        console.error('Error checking state:', error);
      }
    }, 5000);
  };

  const connectInstance = async () => {
    setIsLoading(true);
    try {
      console.log(`Connecting instance: ${instance}`);
      const response = await supabase.functions.invoke('evo-connect', {
        body: { instance }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      console.log('Connect response:', data);

      if (data.code) {
        await generateQRCode(data.code);
      }
      if (data.pairingCode) {
        setPairingCode(data.pairingCode);
      }

      setConnectionStatus('connecting');
    } catch (error) {
      console.error('Error connecting instance:', error);
      toast.error('Erro ao conectar instância');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshQR = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('evo-refresh-qr', {
        body: { instance }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      if (data.code) {
        await generateQRCode(data.code);
      }
      if (data.pairingCode) {
        setPairingCode(data.pairingCode);
      }

      toast.success('QR Code atualizado');
    } catch (error) {
      console.error('Error refreshing QR:', error);
      toast.error('Erro ao atualizar QR Code');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Start SSE connection
      startSSEConnection();
      
      // Start state polling as backup
      startStatePolling();
      
      // Connect instance to get initial QR
      connectInstance();

      // Fallback: if no QR received in 3 seconds, start polling
      fallbackTimeoutRef.current = setTimeout(() => {
        if (!qrCodeDataUrl) {
          console.log('No QR received via SSE, starting fallback polling');
          // Start polling every 20 seconds as fallback
          const pollInterval = setInterval(async () => {
            try {
              const response = await supabase.functions.invoke('evo-connect', {
                body: { instance }
              });
              
              if (response.data?.code) {
                await generateQRCode(response.data.code);
                if (response.data.pairingCode) {
                  setPairingCode(response.data.pairingCode);
                }
              }
            } catch (error) {
              console.error('Error in fallback polling:', error);
            }
          }, 20000);

          return () => clearInterval(pollInterval);
        }
      }, 3000);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (stateCheckIntervalRef.current) {
        clearInterval(stateCheckIntervalRef.current);
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, [isOpen, instance]);

  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (stateCheckIntervalRef.current) {
      clearInterval(stateCheckIntervalRef.current);
    }
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {connectionStatus === 'connected' ? (
              <Wifi className="h-5 w-5 text-emerald-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-slate-500" />
            )}
            Conectar: {channelName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          {qrCodeDataUrl ? (
            <div className="flex flex-col items-center space-y-4">
              <img 
                src={qrCodeDataUrl} 
                alt="QR Code do WhatsApp" 
                className="border border-slate-200 rounded-lg"
              />
              
              {pairingCode && (
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-1">Código de pareamento:</p>
                  <code className="bg-slate-100 px-3 py-1 rounded text-sm font-mono">
                    {pairingCode}
                  </code>
                </div>
              )}
              
              <p className="text-sm text-slate-600 text-center max-w-xs">
                Escaneie o QR Code com o WhatsApp ou use o código de pareamento. 
                Mantenha esta janela aberta até confirmar a conexão.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-slate-600">Gerando QR Code...</p>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={refreshQR}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar QR
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}