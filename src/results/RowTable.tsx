import { useMemo, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable
} from '@tanstack/react-table';
import type { EnrichedRow } from '@/types';

interface RowTableProps {
  data: EnrichedRow[];
}

export default function RowTable({ data }: RowTableProps) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const columns = useMemo<ColumnDef<EnrichedRow>[]>(
    () => [
      {
        accessorKey: 'orderId',
        header: 'Order number',
        cell: (info) => info.getValue<string | undefined>()?.trim() || '—'
      },
      { accessorKey: 'orderDate', header: 'Order date', cell: (info) => formatDate(info.getValue()) },
      {
        accessorKey: 'requiredArrivalDate',
        header: 'Required date (Excel)',
        cell: (info) => formatDate(info.getValue())
      },
      {
        accessorKey: 'calculatedRequiredArrivalDate',
        header: 'Calculated SLA/turnover date',
        cell: (info) => formatDate(info.getValue())
      },
      { accessorKey: 'shippingDate', header: 'Ship date', cell: (info) => formatDate(info.getValue()) },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'method', header: 'Method' },
      { accessorKey: 'product', header: 'Product' },
      { accessorKey: 'destinationCountry', header: 'Country' },
      {
        accessorKey: 'turnoverDays',
        header: 'Turnover (days)',
        cell: (info) => info.getValue<number | null>() ?? '—'
      },
      {
        accessorKey: 'slaDays',
        header: 'SLA days',
        cell: (info) => info.getValue<number | null>() ?? '—'
      },
      {
        accessorKey: 'isOnTime',
        header: 'On-time (Excel)',
        cell: (info) => formatBool(info.getValue())
      },
      {
        accessorKey: 'isOnTimeCalculated',
        header: 'On-time (Calculated)',
        cell: (info) => formatBool(info.getValue())
      },
      {
        accessorKey: 'mismatchType',
        header: 'Mismatch',
        cell: (info) => info.getValue<string | null>() ?? '—'
      }
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination },
    onPaginationChange: setPagination
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Rows: {data.length}</span>
        <label className="flex items-center gap-2">
          Page size
          <select
            className="rounded-md border border-border bg-background px-2 py-1"
            value={pagination.pageSize}
            onChange={(event) => setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })}
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-card text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          className="underline disabled:opacity-50"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button
          className="underline disabled:opacity-50"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function formatDate(value: unknown) {
  if (!value || !(value instanceof Date)) return '—';
  return value.toISOString().slice(0, 10);
}

function formatBool(value: unknown) {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'boolean') return '—';
  return value ? 'Yes' : 'No';
}
