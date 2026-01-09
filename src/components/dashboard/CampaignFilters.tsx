import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';

export type StatusFilter = 'all' | 'active' | 'paused' | 'unknown';

interface CampaignFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  profitFilter: 'all' | 'positive' | 'negative';
  onProfitFilterChange: (value: 'all' | 'positive' | 'negative') => void;
  roiFilter: 'all' | 'positive' | 'negative';
  onRoiFilterChange: (value: 'all' | 'positive' | 'negative') => void;
}

export function CampaignFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  profitFilter,
  onProfitFilterChange,
  roiFilter,
  onRoiFilterChange,
}: CampaignFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        
        <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>

        <Select value={profitFilter} onValueChange={(v) => onProfitFilterChange(v as 'all' | 'positive' | 'negative')}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Profit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Profit</SelectItem>
            <SelectItem value="positive">Profitable</SelectItem>
            <SelectItem value="negative">Losing</SelectItem>
          </SelectContent>
        </Select>

        <Select value={roiFilter} onValueChange={(v) => onRoiFilterChange(v as 'all' | 'positive' | 'negative')}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="ROI" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ROI</SelectItem>
            <SelectItem value="positive">Positive ROI</SelectItem>
            <SelectItem value="negative">Negative ROI</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
