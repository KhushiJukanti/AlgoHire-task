import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';

export interface DataColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  className?: string;
  render: (item: T) => React.ReactNode;
  mobileLabel?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  getRowKey: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?: (nextPage: number) => void;
  isFetching?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  onRowClick,
  page = 1,
  limit = 20,
  total,
  onPageChange,
  isFetching = false,
}: DataTableProps<T>) {
  const hasTotal = typeof total === 'number' && !Number.isNaN(total);
  const totalPages = hasTotal ? Math.max(1, Math.ceil(total / limit)) : undefined;
  const canGoPrev = page > 1;
  const canGoNext = totalPages ? page < totalPages : data.length >= limit;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 whitespace-nowrap',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((item, idx) => (
              <tr
                key={getRowKey(item, idx)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(item);
                        }
                      }
                    : undefined
                }
                className={cn(
                  'transition-colors',
                  onRowClick
                    ? 'cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50'
                    : 'hover:bg-muted/30'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 align-middle text-foreground',
                      col.align === 'right' ? 'text-right tabular-nums' : 'text-left',
                      col.className
                    )}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="divide-y divide-border md:hidden">
        {data.map((item, idx) => (
          <div
            key={getRowKey(item, idx)}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            className={cn(
              'p-4 space-y-2.5',
              onRowClick && 'cursor-pointer active:bg-muted/60'
            )}
          >
            {columns.map((col) => (
              <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-xs font-medium text-muted-foreground shrink-0">
                  {col.mobileLabel || col.header}
                </span>
                <div className="text-right text-foreground min-w-0 break-words">
                  {col.render(item)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      {onPageChange && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-muted/25 px-4 py-3 text-xs text-muted-foreground sm:flex-row">
          <div className="tabular-nums">
            {hasTotal ? (
              <span>
                Page {page} of {totalPages} · {total} total records
              </span>
            ) : (
              <span>
                Page {page} · Showing {data.length} {data.length === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={!canGoPrev || isFetching}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={!canGoNext || isFetching}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
