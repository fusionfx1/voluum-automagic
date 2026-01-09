import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { 
  Search, 
  ArrowUpDown, 
  Target,
  RefreshCw,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
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
}

type SortField = 'name' | 'profit' | 'roi' | 'clicks' | 'conversions';
type SortDirection = 'asc' | 'desc';

export default function Campaigns() {
  const [search, setSearch] = useState('');
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
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const { data: aggregatedMetrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['aggregated-metrics'],
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    queryFn: async () => {
      // Get all snapshots and aggregate by campaign
      const { data, error } = await supabase
        .from('metrics_snapshots')
        .select('voluum_campaign_id, clicks, conversions, cost, revenue, profit');
      
      if (error) throw error;
      
      // Aggregate metrics per campaign
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
      
      // Calculate derived metrics
      for (const [, metrics] of metricsByCampaign) {
        metrics.roi = metrics.cost > 0 ? ((metrics.revenue - metrics.cost) / metrics.cost) * 100 : 0;
        metrics.epc = metrics.clicks > 0 ? metrics.revenue / metrics.clicks : 0;
        metrics.cvr = metrics.clicks > 0 ? (metrics.conversions / metrics.clicks) * 100 : 0;
      }
      
      return metricsByCampaign;
    },
  });

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

    let filtered = campaigns.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.voluum_campaign_id.toLowerCase().includes(search.toLowerCase())
    );

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
  }, [campaigns, search, sortField, sortDirection, aggregatedMetrics]);

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
          <p className="text-muted-foreground">Monitor and manage your campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={handleSync} disabled={syncing}>
            <Download className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Voluum'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            queryClient.invalidateQueries({ queryKey: ['aggregated-metrics'] });
          }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              All Campaigns
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
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
                Campaigns will appear here once metrics are pulled from Voluum
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
