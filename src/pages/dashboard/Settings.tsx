import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { 
  Settings as SettingsIcon, 
  Wifi, 
  WifiOff, 
  Loader2, 
  CheckCircle, 
  XCircle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface TestResult {
  success: boolean;
  message?: string;
  error?: string;
  help?: string;
  user?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    timezone?: string;
    workspaceId?: string;
  };
  config?: {
    baseUrl?: string;
    authHeader?: string;
  };
}

export default function SettingsPage() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const testVoluumConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('voluum-test');

      if (error) {
        setTestResult({
          success: false,
          error: 'Failed to call test function',
          message: error.message,
          help: 'Make sure the edge function is deployed'
        });
        toast.error('Connection test failed');
      } else {
        setTestResult(data as TestResult);
        if (data.success) {
          toast.success('Voluum connection successful!');
        } else {
          toast.error(data.error || 'Connection failed');
        }
      }
    } catch (err) {
      setTestResult({
        success: false,
        error: 'Unexpected error',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure API connections and integrations</p>
      </div>

      {/* Voluum Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Voluum API Connection
          </CardTitle>
          <CardDescription>
            Test your Voluum API connection to verify credentials are working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testVoluumConnection} 
            disabled={testing}
            className="w-full sm:w-auto"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2" />
                Test Voluum Connection
              </>
            )}
          </Button>

          {testResult && (
            <div className={`p-4 rounded-lg border ${
              testResult.success 
                ? 'bg-success/5 border-success/20' 
                : 'bg-destructive/5 border-destructive/20'
            }`}>
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                    </span>
                    <StatusBadge status={testResult.success ? 'success' : 'danger'}>
                      {testResult.success ? 'Connected' : 'Error'}
                    </StatusBadge>
                  </div>
                  
                  {testResult.message && (
                    <p className="text-sm text-muted-foreground">{testResult.message}</p>
                  )}
                  
                  {testResult.error && (
                    <p className="text-sm text-destructive">{testResult.error}</p>
                  )}

                  {testResult.help && (
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                      💡 {testResult.help}
                    </p>
                  )}

                  {testResult.success && testResult.user && (
                    <div className="mt-3 p-3 rounded bg-muted/30 space-y-1">
                      <p className="text-sm font-medium">Account Info:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {testResult.user.email && (
                          <div>
                            <span className="text-muted-foreground">Email:</span>{' '}
                            <span className="font-mono">{testResult.user.email}</span>
                          </div>
                        )}
                        {testResult.user.firstName && (
                          <div>
                            <span className="text-muted-foreground">Name:</span>{' '}
                            {testResult.user.firstName} {testResult.user.lastName}
                          </div>
                        )}
                        {testResult.user.timezone && (
                          <div>
                            <span className="text-muted-foreground">Timezone:</span>{' '}
                            {testResult.user.timezone}
                          </div>
                        )}
                        {testResult.user.workspaceId && (
                          <div>
                            <span className="text-muted-foreground">Workspace:</span>{' '}
                            <span className="font-mono text-xs">{testResult.user.workspaceId.slice(0, 12)}...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {testResult.config && (
                    <div className="text-xs text-muted-foreground mt-2">
                      <span>Base URL: {testResult.config.baseUrl}</span>
                      <span className="mx-2">•</span>
                      <span>Auth Header: {testResult.config.authHeader}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment Info */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Status</CardTitle>
          <CardDescription>Required secrets and environment variables</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <ConfigItem name="VOLUUM_ACCESS_KEY" description="Voluum API access token" />
            <ConfigItem name="LINE_NOTIFY_TOKEN" description="LINE Notify API token for alerts" />
            <ConfigItem name="VOLUUM_BASE_URL" description="Voluum API base URL (optional)" defaultValue="https://api.voluum.com" />
            <ConfigItem name="VOLUUM_AUTH_HEADER" description="Auth header name (optional)" defaultValue="cwauth-token" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigItem({ 
  name, 
  description, 
  defaultValue 
}: { 
  name: string; 
  description: string; 
  defaultValue?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
      <div>
        <p className="font-mono text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {defaultValue ? (
        <span className="text-xs text-muted-foreground">Default: {defaultValue}</span>
      ) : (
        <StatusBadge status="info">Required</StatusBadge>
      )}
    </div>
  );
}
