import { useMemo, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import type { MonthlySummary } from '@/types';

interface MonthlyTableProps {
  data: MonthlySummary[];
}

export default function MonthlyTable({ data }: MonthlyTableProps) {
  const [showDetails, setShowDetails] = useState(false);

  const columns = useMemo<ColumnDef<MonthlySummary>[]>(() => {
    const monthCol: ColumnDef<MonthlySummary> = {
      accessorKey: 'month',
      header: 'Month',
      meta: { minWidth: 110, sticky: true }
    };

    const shippedCol: ColumnDef<MonthlySummary> = {
      accessorKey: 'shipped',
      header: 'Shipped',
      meta: { minWidth: 90 }
    };

    const avgTurnoverCol: ColumnDef<MonthlySummary> = {
      accessorKey: 'averageTurnover',
      header: 'Avg turnover',
      cell: (info) => info.getValue<number | null>()?.toFixed(1) ?? '—',
      meta: { minWidth: 120 }
    };

    const mismatchCol: ColumnDef<MonthlySummary> = {
      accessorKey: 'mismatchCount',
      header: 'Mismatches',
      meta: { minWidth: 110 }
    };

    const excelRateCol: ColumnDef<MonthlySummary> = {
      accessorKey: 'onTimeRate',
      header: 'On-time % (Excel)',
      cell: (info) => `${Math.round((info.getValue<number>() ?? 0) * 100)}%`,
      meta: { minWidth: 140 }
    };

    const calculatedRateCol: ColumnDef<MonthlySummary> = {
      accessorKey: 'onTimeRateCalculated',
      header: 'On-time % (Calculated)',
      cell: (info) => `${Math.round((info.getValue<number>() ?? 0) * 100)}%`,
      meta: { minWidth: 170 }
    };

    if (!showDetails) {
      // Default view: keep it compact and readable.
      return [monthCol, shippedCol, excelRateCol, calculatedRateCol, mismatchCol, avgTurnoverCol];
    }

    // Expanded view: grouped columns + horizontal scrolling.
    return [
      monthCol,
      shippedCol,
      {
        header: 'Excel required date',
        columns: [
          { accessorKey: 'onTime', header: 'On-time', meta: { minWidth: 110 } },
          { accessorKey: 'late', header: 'Late', meta: { minWidth: 90 } },
          excelRateCol
        ]
      },
      {
        header: 'Calculated SLA',
        columns: [
          { accessorKey: 'onTimeCalculated', header: 'On-time', meta: { minWidth: 130 } },
          { accessorKey: 'lateCalculated', header: 'Late', meta: { minWidth: 110 } },
          calculatedRateCol
        ]
      },
      mismatchCol,
      avgTurnoverCol
    ];
  }, [showDetails]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const getMinWidth = (column: any): number | undefined => {
    return column?.columnDef?.meta?.minWidth;
  };

  const isSticky = (column: any): boolean => {
    return Boolean(column?.columnDef?.meta?.sticky);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Monthly summary</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowDetails((v) => !v)}>
          {showDetails ? 'Hide details' : 'Show details'}
        </Button>
      </div>

      <div className={`rounded-lg border border-border ${showDetails ? 'overflow-auto' : 'overflow-hidden'}`}>
        <table className={`w-full text-left text-xs ${showDetails ? 'min-w-[980px]' : ''}`}>
          <thead className="bg-card text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup, groupIndex) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sticky = isSticky(header.column);
                  // With grouped headers we may have 2 rows. Offset sticky headers per row to avoid overlap.
                  const topOffset = groupIndex * 32;
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 align-bottom bg-card sticky ${sticky ? 'left-0 z-30 border-r border-border' : 'z-20'}`}
                      style={{ minWidth: getMinWidth(header.column), top: `${topOffset}px` }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                {row.getVisibleCells().map((cell) => {
                  const sticky = isSticky(cell.column);
                  return (
                    <td
                      key={cell.id}
                      className={`px-3 py-2 ${sticky ? 'sticky left-0 z-10 bg-background border-r border-border' : ''}`}
                      style={{ minWidth: getMinWidth(cell.column) }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
