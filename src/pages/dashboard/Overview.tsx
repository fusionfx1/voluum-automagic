import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { LastSyncedBadge } from '@/components/dashboard/LastSyncedBadge';
import { MetricsTrendChart } from '@/components/dashboard/MetricsTrendChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  MousePointerClick, 
  TrendingUp, 
  Target, 
  Zap,
  AlertTriangle,
  RefreshCw,
  Download,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface MetricsSnapshot {
  id: string;
  voluum_campaign_id: string;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  profit: number;
  roi: number;
  epc: number;
  cvr: number;
  window_end: string;
  created_at: string;
}

interface RuleTrigger {
  id: string;
  rule_id: string;
  voluum_campaign_id: string;
  triggered_at: string;
  status: string;
  action_result: Record<string, unknown>;
}

interface Rule {
  id: string;
  name: string;
}

export default function Overview() {
  const [syncing, setSyncing] = React.useState(false);
  const [evaluating, setEvaluating] = React.useState(false);

  const { data: snapshots, isLoading: loadingSnapshots, refetch: refetchSnapshots } = useQuery({
    queryKey: ['metrics-snapshots-overview'],
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metrics_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data as MetricsSnapshot[];
    },
  });

  const { data: triggers, isLoading: loadingTriggers, refetch: refetchTriggers } = useQuery({
    queryKey: ['rule-triggers-overview'],
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rule_triggers')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(10);
      
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

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('voluum-sync');
      
      if (error) {
        toast.error('Sync failed: ' + error.message);
        return;
      }

      if (data?.success) {
        toast.success(`Synced ${data.campaignsCount} campaigns, ${data.snapshotsInserted} snapshots`);
        refetchSnapshots();
      } else {
        toast.error(data?.error || 'Sync failed');
      }
    } catch (err) {
      toast.error('Failed to sync: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleEvaluateRules = async () => {
    setEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-rules');
      
      if (error) {
        toast.error('Rule evaluation failed: ' + error.message);
        return;
      }

      if (data?.success) {
        if (data.triggersCreated > 0) {
          toast.success(`${data.triggersCreated} rules triggered!`);
        } else {
          toast.info('No rules triggered');
        }
        refetchTriggers();
      } else {
        toast.error(data?.error || 'Rule evaluation failed');
      }
    } catch (err) {
      toast.error('Failed to evaluate rules: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setEvaluating(false);
    }
  };

  // Calculate aggregated metrics
  const aggregatedMetrics = React.useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      return {
        totalClicks: 0,
        totalConversions: 0,
        totalCost: 0,
        totalRevenue: 0,
        totalProfit: 0,
        avgRoi: 0,
        avgEpc: 0,
        avgCvr: 0,
      };
    }

    const totalClicks = snapshots.reduce((sum, s) => sum + Number(s.clicks), 0);
    const totalConversions = snapshots.reduce((sum, s) => sum + Number(s.conversions), 0);
    const totalCost = snapshots.reduce((sum, s) => sum + Number(s.cost), 0);
    const totalRevenue = snapshots.reduce((sum, s) => sum + Number(s.revenue), 0);
    const totalProfit = totalRevenue - totalCost;
    const avgRoi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
    const avgEpc = totalClicks > 0 ? totalRevenue / totalClicks : 0;
    const avgCvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    return {
      totalClicks,
      totalConversions,
      totalCost,
      totalRevenue,
      totalProfit,
      avgRoi,
      avgEpc,
      avgCvr,
    };
  }, [snapshots]);

  // Calculate trend data for charts
  const chartData = React.useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];

    // Group snapshots by date
    const byDate = new Map<string, { revenue: number; profit: number; cost: number }>();
    
    for (const snapshot of snapshots) {
      const date = format(new Date(snapshot.created_at), 'MM/dd');
      const existing = byDate.get(date) || { revenue: 0, profit: 0, cost: 0 };
      existing.revenue += Number(snapshot.revenue) || 0;
      existing.profit += Number(snapshot.profit) || 0;
      existing.cost += Number(snapshot.cost) || 0;
      byDate.set(date, existing);
    }

    // Convert to array and calculate ROI
    const result = Array.from(byDate.entries())
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        profit: Math.round(data.profit * 100) / 100,
        roi: data.cost > 0 ? Math.round(((data.revenue - data.cost) / data.cost) * 100 * 10) / 10 : 0,
      }))
      .reverse()
      .slice(-7); // Last 7 days

    return result;
  }, [snapshots]);

  // Get last synced time
  const lastSyncedTime = React.useMemo(() => {
    if (!snapshots || snapshots.length === 0) return null;
    return snapshots[0]?.created_at || null;
  }, [snapshots]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const getRuleName = (ruleId: string) => {
    return rules?.find(r => r.id === ruleId)?.name || 'Unknown Rule';
  };

  const isLoading = loadingSnapshots || loadingTriggers;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Overview</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground">Real-time campaign performance metrics</p>
            <LastSyncedBadge timestamp={lastSyncedTime} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleEvaluateRules} disabled={evaluating}>
            <Play className={`w-4 h-4 mr-2 ${evaluating ? 'animate-spin' : ''}`} />
            {evaluating ? 'Evaluating...' : 'Run Rules'}
          </Button>
          <Button variant="default" size="sm" onClick={handleSync} disabled={syncing}>
            <Download className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Voluum'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetchSnapshots()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Profit"
          value={formatCurrency(aggregatedMetrics.totalProfit)}
          variant={aggregatedMetrics.totalProfit >= 0 ? 'success' : 'danger'}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(aggregatedMetrics.totalRevenue)}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          label="Total Clicks"
          value={formatNumber(aggregatedMetrics.totalClicks)}
          icon={<MousePointerClick className="w-5 h-5" />}
        />
        <MetricCard
          label="Conversions"
          value={formatNumber(aggregatedMetrics.totalConversions)}
          icon={<Target className="w-5 h-5" />}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Average ROI"
          value={`${aggregatedMetrics.avgRoi.toFixed(1)}%`}
          variant={aggregatedMetrics.avgRoi >= 0 ? 'success' : 'danger'}
        />
        <MetricCard
          label="Average EPC"
          value={formatCurrency(aggregatedMetrics.avgEpc)}
        />
        <MetricCard
          label="Conversion Rate"
          value={`${aggregatedMetrics.avgCvr.toFixed(2)}%`}
        />
      </div>

      {/* Trend Chart */}
      <MetricsTrendChart data={chartData} isLoading={loadingSnapshots} />

      {/* Recent Triggers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" />
            <CardTitle>Recent Triggers</CardTitle>
          </div>
          {triggers && triggers.length > 0 && (
            <StatusBadge status="warning">{triggers.length} recent</StatusBadge>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : triggers && triggers.length > 0 ? (
            <div className="space-y-3">
              {triggers.slice(0, 5).map((trigger) => (
                <div
                  key={trigger.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <div>
                      <p className="text-sm font-medium">{getRuleName(trigger.rule_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        Campaign: {trigger.voluum_campaign_id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={
                        trigger.status === 'completed' ? 'success' :
                        trigger.status === 'failed' ? 'danger' : 'warning'
                      }
                    >
                      {trigger.status}
                    </StatusBadge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(trigger.triggered_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No recent triggers</p>
              <p className="text-xs text-muted-foreground mt-1">
                Rules will trigger when conditions are met
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
