import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 border">
            <h1 className="text-2xl font-bold text-destructive mb-4">Oops! Something went wrong</h1>
            <p className="text-muted-foreground mb-4">
              An error occurred while rendering the application.
            </p>
            
            {this.state.error && (
              <details className="mb-4 p-3 bg-muted rounded border">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 text-sm overflow-auto whitespace-pre-wrap">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre className="mt-2 text-xs text-muted-foreground overflow-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                variant="outline"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="default"
              >
                Go Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}