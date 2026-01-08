import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const statusStyles = {
    success: 'status-success',
    warning: 'status-warning',
    danger: 'status-danger',
    info: 'status-info',
    neutral: 'bg-muted text-muted-foreground border border-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        statusStyles[status],
        className
      )}
    >
      {children}
    </span>
  );
}
