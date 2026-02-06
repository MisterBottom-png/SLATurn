import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { exportResultsToPdf } from '@/exports/pdf';
import MonthlyTable from '@/results/MonthlyTable';
import RowTable from '@/results/RowTable';
import ExcludedRowTable from '@/results/ExcludedRowTable';
import MismatchRowTable from '@/results/MismatchRowTable';
import type { CalculationResult, FiltersConfig } from '@/types';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface StepResultsProps {
  calculation: CalculationResult | null;
  filters: FiltersConfig;
}

export default function StepResults({ calculation, filters }: StepResultsProps) {
  const [activeTab, setActiveTab] = useState('summary');
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyFallback, setCopyFallback] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const kpis = useMemo(() => {
    if (!calculation) return null;
    const rows = calculation.rows;
    const turnover = rows
      .map((row) => row.turnoverDays)
      .filter((value): value is number => typeof value === 'number');
    const avgTurnover = turnover.length ? turnover.reduce((acc, value) => acc + value, 0) / turnover.length : null;
    const onTimeExcel = rows.filter((row) => row.isOnTime).length;
    const lateExcel = rows.filter((row) => row.isOnTime === false).length;
    const onTimeCalculated = rows.filter((row) => row.isOnTimeCalculated).length;
    const lateCalculated = rows.filter((row) => row.isOnTimeCalculated === false).length;
    const shipped = rows.length;
    return {
      shipped,
      avgTurnover: avgTurnover !== null ? avgTurnover.toFixed(1) : '—',
      onTimeRateExcel: shipped ? `${Math.round((onTimeExcel / shipped) * 100)}%` : '—',
      lateRateExcel: shipped ? `${Math.round((lateExcel / shipped) * 100)}%` : '—',
      onTimeRateCalculated: shipped ? `${Math.round((onTimeCalculated / shipped) * 100)}%` : '—',
      lateRateCalculated: shipped ? `${Math.round((lateCalculated / shipped) * 100)}%` : '—'
    };
  }, [calculation]);

  const mismatchRows = useMemo(() => {
    if (!calculation) return [];
    return calculation.rows.filter((row) => row.mismatchType);
  }, [calculation]);

  const monthTickInterval = useMemo(() => {
    const len = calculation?.monthly.length ?? 0;
    // Recharts interval is "show every N+1 tick". Keep ~6-8 ticks.
    return len > 8 ? Math.floor(len / 6) : 0;
  }, [calculation]);

  const filtersSummary = useMemo(() => {
    const products = filters.products;
    const productLabel = products.length
      ? `${products.length} selected — ${products
          .slice(0, 5)
          .join(', ')}${products.length > 5 ? ` +${products.length - 5} more` : ''}`
      : 'All';
    const monthBasisLabel =
      filters.monthBasis === 'shipped'
        ? 'Shipped'
        : filters.monthBasis === 'sla_due'
          ? 'SLA due'
          : 'Order';
    const months = calculation?.monthly.map((row) => row.month) ?? [];
    const startMonth = filters.monthRange[0] ?? months[0] ?? '—';
    const endMonth = filters.monthRange[1] ?? months[months.length - 1] ?? '—';
    return {
      productLabel,
      monthBasisLabel,
      monthRange: `${startMonth} → ${endMonth}`,
      deliveryLabel: filters.deliveryNotRequired ? 'Included' : 'Excluded'
    };
  }, [filters, calculation]);

  if (!calculation) {
    return (
      <Alert>
        <AlertDescription>Run the calculation to view results.</AlertDescription>
      </Alert>
    );
  }

  const handleExport = () => {
    const workbook = XLSX.utils.book_new();
    // Per requirements: keep export schema unchanged (Excel required date variant only).
    const exportedMonthly = calculation.monthly.map((row) => ({
      month: row.month,
      shipped: row.shipped,
      onTime: row.onTime,
      late: row.late,
      onTimeRate: row.onTimeRate,
      averageTurnover: row.averageTurnover
    }));
    const monthlySheet = XLSX.utils.json_to_sheet(exportedMonthly);
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'monthly_summary');

    const includedRows = calculation.rows.map((row) => ({
      orderDate: row.orderDate?.toISOString().slice(0, 10) ?? '',
      shippingDate: row.shippingDate?.toISOString().slice(0, 10) ?? '',
      requiredArrivalDate: row.requiredArrivalDate?.toISOString().slice(0, 10) ?? '',
      status: row.status,
      method: row.method,
      product: row.product,
      destinationCountry: row.destinationCountry,
      orderId: row.orderId ?? '',
      customer: row.customer ?? '',
      turnoverDays: row.turnoverDays ?? '',
      isOnTime: row.isOnTime === null ? '' : row.isOnTime ? 'Yes' : 'No',
      monthKey: row.monthKey ?? ''
    }));
    const includedSheet = XLSX.utils.json_to_sheet(includedRows);
    XLSX.utils.book_append_sheet(workbook, includedSheet, 'included_rows');

    XLSX.writeFile(workbook, 'turnover_sla_export.xlsx');
  };

  const handleCopy = async () => {
    const header = ['Month', 'Shipped', 'On-time', 'Late', 'On-time %', 'Avg turnover'];
    const rows = calculation.monthly.map((row) => [
      row.month,
      row.shipped,
      row.onTime,
      row.late,
      `${Math.round(row.onTimeRate * 100)}%`,
      row.averageTurnover ?? ''
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      setCopyFeedback({ type: 'success', message: 'Summary copied to clipboard.' });
      setCopyDialogOpen(false);
    } catch (error) {
      console.error('Failed to copy summary CSV', error);
      setCopyFallback(csv);
      setCopyFeedback({ type: 'error', message: 'Could not copy. Use the manual copy dialog instead.' });
      setCopyDialogOpen(true);
    }
  };

  const handleExportPdf = async () => {
    setActiveTab('summary');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (resultsRef.current) {
      await exportResultsToPdf(resultsRef.current);
    }
  };

  const coverageRatio = calculation.quality.rawRows ? calculation.quality.includedRows / calculation.quality.rawRows : 1;
  const coverageWarning = calculation.quality.rawRows && coverageRatio < 0.6;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="rows">Included rows</TabsTrigger>
          <TabsTrigger value="mismatches">Mismatch report</TabsTrigger>
          <TabsTrigger value="excluded">Excluded rows</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handleExport} disabled={!calculation.rows.length}>
            Export summary
          </Button>
          <Button type="button" variant="secondary" onClick={handleExportPdf} disabled={!calculation.rows.length}>
            Export PDF
          </Button>
          <Button type="button" variant="outline" onClick={handleCopy} disabled={!calculation.rows.length}>
            Copy summary
          </Button>
        </div>
        {copyFeedback ? (
          <p
            className={`text-xs ${copyFeedback.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}
            role="status"
          >
            {copyFeedback.message}
          </p>
        ) : null}
      </div>
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy the summary CSV</DialogTitle>
            <DialogDescription>
              Clipboard access was blocked. Select and copy the CSV data below.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[200px] w-full rounded-md border border-border bg-background p-3 text-xs"
            readOnly
            value={copyFallback}
          />
        </DialogContent>
      </Dialog>

      <TabsContent value="summary" className="space-y-6">
        <div ref={resultsRef} className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Products:</span> {filtersSummary.productLabel}
                </p>
                <p>
                  <span className="font-semibold">Months ({filtersSummary.monthBasisLabel}):</span>{' '}
                  {filtersSummary.monthRange}
                </p>
                <p>
                  <span className="font-semibold">Delivery not required:</span> {filtersSummary.deliveryLabel}
                </p>
              </div>
            </div>
          </div>

          {coverageWarning ? (
            <Alert>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <AlertDescription>
                  Coverage warning: only {Math.round(coverageRatio * 100)}% of raw rows were included.
                </AlertDescription>
                <Dialog open={coverageOpen} onOpenChange={setCoverageOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="sm">Explain</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Why rows were excluded</DialogTitle>
                      <DialogDescription>
                        Most exclusions come from missing dates/status matches or filtered methods/products.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-card">
                          <tr>
                            <th className="px-3 py-2 text-muted-foreground">Reason</th>
                            <th className="px-3 py-2 text-muted-foreground">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculation.quality.exclusions.map((item) => (
                            <tr key={item.reason} className="border-t border-border">
                              <td className="px-3 py-2">{item.reason}</td>
                              <td className="px-3 py-2">{item.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => setCoverageOpen(false)}>
                        Close
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </Alert>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Shipped rows</p>
              <p className="text-2xl font-semibold">{kpis?.shipped ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Avg turnover (days)</p>
              <p className="text-2xl font-semibold">{kpis?.avgTurnover}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">On-time rate (Excel required date)</p>
              <p className="text-2xl font-semibold">{kpis?.onTimeRateExcel}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Late rate (Excel required date)</p>
              <p className="text-2xl font-semibold">{kpis?.lateRateExcel}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">On-time rate (Calculated SLA)</p>
              <p className="text-2xl font-semibold">{kpis?.onTimeRateCalculated}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Late rate (Calculated SLA)</p>
              <p className="text-2xl font-semibold">{kpis?.lateRateCalculated}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">On-time vs late by month</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Excel required date</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={calculation.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                      <XAxis
                        dataKey="month"
                        interval={monthTickInterval}
                        angle={-35}
                        height={60}
                        textAnchor="end"
                        axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                        tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
                        tick={{ fill: 'hsl(var(--chart-axis))', fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                        tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
                        tick={{ fill: 'hsl(var(--chart-axis))', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: 12
                        }}
                        labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                      />
                      <Bar
                        dataKey="onTime"
                        name="On-time"
                        stackId="a"
                        fill="hsl(var(--chart-ontime-fill))"
                        stroke="hsl(var(--chart-ontime))"
                        fillOpacity={0.75}
                      />
                      <Bar
                        dataKey="late"
                        name="Late"
                        stackId="a"
                        fill="hsl(var(--chart-late-fill))"
                        stroke="hsl(var(--chart-late))"
                        fillOpacity={0.75}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Calculated SLA</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={calculation.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                      <XAxis
                        dataKey="month"
                        interval={monthTickInterval}
                        angle={-35}
                        height={60}
                        textAnchor="end"
                        axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                        tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
                        tick={{ fill: 'hsl(var(--chart-axis))', fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                        tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
                        tick={{ fill: 'hsl(var(--chart-axis))', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: 12
                        }}
                        labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                      />
                      <Bar
                        dataKey="onTimeCalculated"
                        name="On-time"
                        stackId="a"
                        fill="hsl(var(--chart-ontime-fill))"
                        stroke="hsl(var(--chart-ontime))"
                        fillOpacity={0.55}
                      />
                      <Bar
                        dataKey="lateCalculated"
                        name="Late"
                        stackId="a"
                        fill="hsl(var(--chart-late-fill))"
                        stroke="hsl(var(--chart-late))"
                        fillOpacity={0.55}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-3 text-sm font-semibold">Average turnover by month</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={calculation.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                  <XAxis
                    dataKey="month"
                    interval={monthTickInterval}
                    angle={-35}
                    height={60}
                    textAnchor="end"
                    axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                    tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
                    tick={{ fill: 'hsl(var(--chart-axis))', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={{ stroke: 'hsl(var(--chart-grid))' }}
                    tickLine={{ stroke: 'hsl(var(--chart-grid))' }}
                    tick={{ fill: 'hsl(var(--chart-axis))', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 12
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="averageTurnover"
                    stroke="hsl(var(--chart-turnover))"
                    strokeWidth={3}
                    dot={{ r: 2, stroke: 'hsl(var(--chart-turnover))', fill: 'hsl(var(--chart-turnover))' }}
                    activeDot={{ r: 4, stroke: 'hsl(var(--chart-turnover))', fill: 'hsl(var(--chart-turnover))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <MonthlyTable data={calculation.monthly} />
        </div>
      </TabsContent>

      <TabsContent value="rows" className="space-y-4">
        <RowTable data={calculation.rows} />
      </TabsContent>

      <TabsContent value="mismatches" className="space-y-4">
        {mismatchRows.length ? (
          <MismatchRowTable data={mismatchRows} />
        ) : (
          <Alert>
            <AlertDescription>No mismatches found between Excel required date vs calculated SLA date.</AlertDescription>
          </Alert>
        )}
      </TabsContent>

      <TabsContent value="excluded" className="space-y-4">
        {calculation.excludedRows.length ? (
          <ExcludedRowTable data={calculation.excludedRows} />
        ) : (
          <Alert>
            <AlertDescription>No excluded rows recorded.</AlertDescription>
          </Alert>
        )}
      </TabsContent>
    </Tabs>
  );
}
