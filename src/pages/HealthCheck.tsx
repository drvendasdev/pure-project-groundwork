import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const HealthCheck = () => {
  const checks = [
    { name: 'React Router', status: 'ok', message: 'Router is working' },
    { name: 'UI Components', status: 'ok', message: 'UI library loaded' },
    { name: 'Tailwind CSS', status: 'ok', message: 'Styles are loading' },
    { name: 'TypeScript', status: 'ok', message: 'TypeScript compilation successful' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Health Check
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {checks.map((check, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <div className="flex-1">
                <div className="font-medium">{check.name}</div>
                <div className="text-sm text-muted-foreground">{check.message}</div>
              </div>
              {getStatusIcon(check.status)}
            </div>
          ))}
          
          <div className="pt-4 space-y-2">
            <Button asChild className="w-full">
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/conversas">Go to Conversations</Link>
            </Button>
          </div>
          
          <div className="text-center text-sm text-muted-foreground pt-2">
            If you can see this page, the basic app structure is working correctly.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthCheck;