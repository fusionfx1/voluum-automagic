import React from 'react';
import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LastSyncedBadgeProps {
  timestamp: string | null;
}

export function LastSyncedBadge({ timestamp }: LastSyncedBadgeProps) {
  if (!timestamp) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>Never synced</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>Last synced {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</span>
    </div>
  );
}
