import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { LastSyncedBadge } from '@/components/dashboard/LastSyncedBadge';
import { CampaignFilters, StatusFilter } from '@/components/dashboard/CampaignFilters';
import { MetricsTrendChart } from '@/components/dashboard/MetricsTrendChart';
import { 
  ArrowUpDown, 
  Target,
  RefreshCw,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  voluum_campaign_id: string;
  name: string;
  status_cache: string;
  tags: string[];
  updated_at: string;
}

interface MetricsSnapshot {
  voluum_campaign_id: string;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  profit: number;
  roi: number;
  epc: number;
  cvr: number;
  created_at?: string;
}

type SortField = 'name' | 'profit' | 'roi' | 'clicks' | 'conversions';
type SortDirection = 'asc' | 'desc';

export default function Campaigns() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [profitFilter, setProfitFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [roiFilter, setRoiFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [sortField, setSortField] = useState<SortField>('profit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

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
        queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        queryClient.invalidateQueries({ queryKey: ['aggregated-metrics'] });
        queryClient.invalidateQueries({ queryKey: ['metrics-snapshots-campaigns'] });
      } else {
        toast.error(data?.error || 'Sync failed');
      }
    } catch (err) {
      toast.error('Failed to sync: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['campaigns'],
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const { data: metricsSnapshots, isLoading: loadingSnapshots } = useQuery({
    queryKey: ['metrics-snapshots-campaigns'],
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metrics_snapshots')
        .select('voluum_campaign_id, clicks, conversions, cost, revenue, profit, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as MetricsSnapshot[];
    },
  });

  const { data: aggregatedMetrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['aggregated-metrics'],
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metrics_snapshots')
        .select('voluum_campaign_id, clicks, conversions, cost, revenue, profit');
      
      if (error) throw error;
      
      const metricsByCampaign = new Map<string, MetricsSnapshot>();
      for (const snapshot of data) {
        const campaignId = snapshot.voluum_campaign_id;
        const existing = metricsByCampaign.get(campaignId);
        
        if (existing) {
          existing.clicks += Number(snapshot.clicks) || 0;
          existing.conversions += Number(snapshot.conversions) || 0;
          existing.cost += Number(snapshot.cost) || 0;
          existing.revenue += Number(snapshot.revenue) || 0;
          existing.profit += Number(snapshot.profit) || 0;
        } else {
          metricsByCampaign.set(campaignId, {
            voluum_campaign_id: campaignId,
            clicks: Number(snapshot.clicks) || 0,
            conversions: Number(snapshot.conversions) || 0,
            cost: Number(snapshot.cost) || 0,
            revenue: Number(snapshot.revenue) || 0,
            profit: Number(snapshot.profit) || 0,
            roi: 0,
            epc: 0,
            cvr: 0,
          });
        }
      }
      
      for (const [, metrics] of metricsByCampaign) {
        metrics.roi = metrics.cost > 0 ? ((metrics.revenue - metrics.cost) / metrics.cost) * 100 : 0;
        metrics.epc = metrics.clicks > 0 ? metrics.revenue / metrics.clicks : 0;
        metrics.cvr = metrics.clicks > 0 ? (metrics.conversions / metrics.clicks) * 100 : 0;
      }
      
      return metricsByCampaign;
    },
  });

  // Calculate trend data for charts
  const chartData = React.useMemo(() => {
    if (!metricsSnapshots || metricsSnapshots.length === 0) return [];

    const byDate = new Map<string, { revenue: number; profit: number; cost: number }>();
    
    for (const snapshot of metricsSnapshots) {
      if (!snapshot.created_at) continue;
      const date = format(new Date(snapshot.created_at), 'MM/dd');
      const existing = byDate.get(date) || { revenue: 0, profit: 0, cost: 0 };
      existing.revenue += Number(snapshot.revenue) || 0;
      existing.profit += Number(snapshot.profit) || 0;
      existing.cost += Number(snapshot.cost) || 0;
      byDate.set(date, existing);
    }

    return Array.from(byDate.entries())
      .map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        profit: Math.round(data.profit * 100) / 100,
        roi: data.cost > 0 ? Math.round(((data.revenue - data.cost) / data.cost) * 100 * 10) / 10 : 0,
      }))
      .reverse()
      .slice(-7);
  }, [metricsSnapshots]);

  // Get last synced time
  const lastSyncedTime = React.useMemo(() => {
    if (!metricsSnapshots || metricsSnapshots.length === 0) return null;
    return metricsSnapshots[0]?.created_at || null;
  }, [metricsSnapshots]);

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

  const getMetricsForCampaign = (campaignId: string) => {
    return aggregatedMetrics?.get(campaignId) || {
      clicks: 0,
      conversions: 0,
      cost: 0,
      revenue: 0,
      profit: 0,
      roi: 0,
      epc: 0,
      cvr: 0,
    };
  };

  const sortedCampaigns = React.useMemo(() => {
    if (!campaigns) return [];

    let filtered = campaigns.filter(c => {
      // Search filter
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.voluum_campaign_id.toLowerCase().includes(search.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || c.status_cache === statusFilter;
      
      // Profit filter
      const metrics = getMetricsForCampaign(c.voluum_campaign_id);
      const matchesProfit = profitFilter === 'all' ||
        (profitFilter === 'positive' && metrics.profit > 0) ||
        (profitFilter === 'negative' && metrics.profit <= 0);
      
      // ROI filter
      const matchesRoi = roiFilter === 'all' ||
        (roiFilter === 'positive' && metrics.roi > 0) ||
        (roiFilter === 'negative' && metrics.roi <= 0);

      return matchesSearch && matchesStatus && matchesProfit && matchesRoi;
    });

    return filtered.sort((a, b) => {
      const metricsA = getMetricsForCampaign(a.voluum_campaign_id);
      const metricsB = getMetricsForCampaign(b.voluum_campaign_id);

      let valueA: number | string;
      let valueB: number | string;

      switch (sortField) {
        case 'name':
          valueA = a.name;
          valueB = b.name;
          break;
        case 'profit':
          valueA = Number(metricsA.profit);
          valueB = Number(metricsB.profit);
          break;
        case 'roi':
          valueA = Number(metricsA.roi);
          valueB = Number(metricsB.roi);
          break;
        case 'clicks':
          valueA = Number(metricsA.clicks);
          valueB = Number(metricsB.clicks);
          break;
        case 'conversions':
          valueA = Number(metricsA.conversions);
          valueB = Number(metricsB.conversions);
          break;
        default:
          valueA = 0;
          valueB = 0;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }

      return sortDirection === 'asc' 
        ? (valueA as number) - (valueB as number) 
        : (valueB as number) - (valueA as number);
    });
  }, [campaigns, search, statusFilter, profitFilter, roiFilter, sortField, sortDirection, aggregatedMetrics]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  const isLoading = loadingCampaigns || loadingMetrics;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground">Monitor and manage your campaigns</p>
            <LastSyncedBadge timestamp={lastSyncedTime} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={handleSync} disabled={syncing}>
            <Download className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Voluum'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['aggregated-metrics'] });
            queryClient.invalidateQueries({ queryKey: ['metrics-snapshots-campaigns'] });
          }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Trend Chart */}
      <MetricsTrendChart data={chartData} isLoading={loadingSnapshots} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                All Campaigns ({sortedCampaigns.length})
              </CardTitle>
            </div>
            <CampaignFilters
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              profitFilter={profitFilter}
              onProfitFilterChange={setProfitFilter}
              roiFilter={roiFilter}
              onRoiFilterChange={setRoiFilter}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedCampaigns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th><SortHeader field="name">Campaign</SortHeader></th>
                    <th>Status</th>
                    <th className="text-right"><SortHeader field="clicks">Clicks</SortHeader></th>
                    <th className="text-right"><SortHeader field="conversions">Conv</SortHeader></th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right"><SortHeader field="profit">Profit</SortHeader></th>
                    <th className="text-right"><SortHeader field="roi">ROI</SortHeader></th>
                    <th className="text-right">Last Update</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCampaigns.map((campaign) => {
                    const metrics = getMetricsForCampaign(campaign.voluum_campaign_id);
                    const profit = Number(metrics.profit);
                    const roi = Number(metrics.roi);

                    return (
                      <tr key={campaign.id}>
                        <td>
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {campaign.voluum_campaign_id.slice(0, 12)}...
                            </p>
                          </div>
                        </td>
                        <td>
                          <StatusBadge
                            status={
                              campaign.status_cache === 'active' ? 'success' :
                              campaign.status_cache === 'paused' ? 'warning' : 'neutral'
                            }
                          >
                            {campaign.status_cache}
                          </StatusBadge>
                        </td>
                        <td className="text-right font-mono">{formatNumber(Number(metrics.clicks))}</td>
                        <td className="text-right font-mono">{formatNumber(Number(metrics.conversions))}</td>
                        <td className="text-right font-mono">{formatCurrency(Number(metrics.cost))}</td>
                        <td className="text-right font-mono">{formatCurrency(Number(metrics.revenue))}</td>
                        <td className={`text-right font-mono font-medium ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatCurrency(profit)}
                        </td>
                        <td className={`text-right font-mono font-medium ${roi >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {roi.toFixed(1)}%
                        </td>
                        <td className="text-right text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(campaign.updated_at), { addSuffix: true })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No campaigns found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter !== 'all' || profitFilter !== 'all' || roiFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Campaigns will appear here once metrics are pulled from Voluum'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
