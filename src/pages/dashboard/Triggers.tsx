import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { 
  Search, 
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';

interface RuleTrigger {
  id: string;
  rule_id: string;
  voluum_campaign_id: string;
  triggered_at: string;
  status: string;
  action_result: Record<string, unknown>;
  error: string | null;
}

interface Rule {
  id: string;
  name: string;
}

export default function Triggers() {
  const [search, setSearch] = useState('');

  const { data: triggers, isLoading: loadingTriggers, refetch } = useQuery({
    queryKey: ['rule-triggers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rule_triggers')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as RuleTrigger[];
    },
  });

  const { data: rules } = useQuery({
    queryKey: ['rules-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rules')
        .select('id, name');
      
      if (error) throw error;
      return data as Rule[];
    },
  });

  const getRuleName = (ruleId: string) => {
    return rules?.find(r => r.id === ruleId)?.name || 'Unknown Rule';
  };

  const filteredTriggers = React.useMemo(() => {
    if (!triggers) return [];
    return triggers.filter(t => 
      getRuleName(t.rule_id).toLowerCase().includes(search.toLowerCase()) ||
      t.voluum_campaign_id.toLowerCase().includes(search.toLowerCase()) ||
      t.status.toLowerCase().includes(search.toLowerCase())
    );
  }, [triggers, search, rules]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-warning" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rule Triggers</h1>
          <p className="text-muted-foreground">History of automated rule executions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Trigger History
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search triggers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTriggers ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTriggers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Rule</th>
                    <th>Campaign ID</th>
                    <th>Triggered At</th>
                    <th>Actions Taken</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTriggers.map((trigger) => (
                    <tr key={trigger.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(trigger.status)}
                          <StatusBadge
                            status={
                              trigger.status === 'completed' ? 'success' :
                              trigger.status === 'failed' ? 'danger' : 'warning'
                            }
                          >
                            {trigger.status}
                          </StatusBadge>
                        </div>
                      </td>
                      <td className="font-medium">{getRuleName(trigger.rule_id)}</td>
                      <td className="font-mono text-sm">{trigger.voluum_campaign_id.slice(0, 16)}...</td>
                      <td>
                        <div>
                          <p className="text-sm">
                            {format(new Date(trigger.triggered_at), 'MMM d, yyyy HH:mm')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(trigger.triggered_at), { addSuffix: true })}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {trigger.action_result && Object.keys(trigger.action_result).length > 0 ? (
                            Object.entries(trigger.action_result).map(([key, value]) => (
                              <StatusBadge key={key} status="info">
                                {key}: {String(value)}
                              </StatusBadge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {trigger.error ? (
                          <span className="text-destructive text-sm">{trigger.error}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No triggers yet</h3>
              <p className="text-muted-foreground">
                Triggers will appear here when rules are executed
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
