import { useEffect, useRef } from 'react';

export const useNotificationSound = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Criar um som simples de notificação
    audioRef.current = new Audio();
    audioRef.current.volume = 0.3;
    
    // Som de notificação simples (usando Data URL para um beep básico)
    const beepSound = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAaBC2H0fPTgjMGHm7A7+OZSA0PVqzn77BdGAg+ltryxnkpBSl+zPLaizsIGGS57OihUgwKTKXh8bllHgg2jdXzzn0vBSF1xe/glEILElyx6OyrWBUIQ5zd8sFuIAUtg8/z3Y4+CRZiturqpVITC0ml4PK8aB4GM4nU8tGAMgYfcsLu45ZFDBFYr+ftrVoXCECY3PLEcSEELIHN8tiJOQcVYbbs6qNNDAhMpODytmccBziS1/LNeSsFJHfH7N2QQAoTXrPq66hWFAlFnt/yv2YbBSuEz/PVhDEGHXDA7eSXRgwSWK7o7q1aGAg/mNr0w28gBC2CzvHZijkHFWC37OqkTgwITaTg8rVoHAY3ktbyyHkqBSV2x+3gkEALE160p+OpWRUJRZ7f8r9nGAUrhNDz1YQxBh1wwO3kl0UOEViu6O6vWRgIPZja9MFwIAIth83w2Yo6BxZht+vpq1wMCMxj+TzjNWgcBjiS1/LMeCsEJXfH7N2QQQkTXLDt66hWFQlEnt/ywGYaBCuCz/PWhjEGHm7A7+OZRA0QVq3n7q9cFww8mNjzxHEhBSt+zPPZiTIHFWG26+mjTQ8LTKPi8bZqHAc4ktXyXow=="';
    
    audioRef.current.src = beepSound;
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => {
        console.log('Erro ao tocar som de notificação:', e);
      });
    }
  };

  return { playNotificationSound };
};