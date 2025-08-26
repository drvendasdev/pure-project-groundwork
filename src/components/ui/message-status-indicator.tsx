import { Check, CheckCheck, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageStatusIndicatorProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  className?: string;
}

export const MessageStatusIndicator = ({ status, className }: MessageStatusIndicatorProps) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Clock className="w-4 h-4 text-muted-foreground animate-spin" />;
      case 'sent':
        return <Check className="w-4 h-4 text-muted-foreground" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <X className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex items-center justify-end", className)}>
      {getStatusIcon()}
    </div>
  );
};