import { useMemo } from 'react';
import type { CalculationResult, FiltersConfig, MonthlySummary } from '@/types';
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

interface PdfReportProps {
  calculation: CalculationResult;
  filters: FiltersConfig;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function MonthlyTablesForPdf({ data }: { data: MonthlySummary[] }) {
  const chunkSize = 20;
  const chunks: MonthlySummary[][] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Monthly summary (key KPIs)</p>
        <div className="space-y-4">
          {chunks.map((rows, chunkIndex) => (
            <div key={`compact-chunk-${chunkIndex}`} className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-card text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Shipped</th>
                    <th className="px-3 py-2">On-time % (Excel)</th>
                    <th className="px-3 py-2">On-time % (Calculated)</th>
                    <th className="px-3 py-2">Mismatches</th>
                    <th className="px-3 py-2">Avg turnover (days)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`compact-${chunkIndex}-${row.month}`} className="border-t border-border">
                      <td className="px-3 py-2">{row.month}</td>
                      <td className="px-3 py-2">{row.shipped}</td>
                      <td className="px-3 py-2">{formatPercent(row.onTimeRate)}</td>
                      <td className="px-3 py-2">{formatPercent(row.onTimeRateCalculated)}</td>
                      <td className="px-3 py-2">{row.mismatchCount}</td>
                      <td className="px-3 py-2">{row.averageTurnover !== null ? row.averageTurnover.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Monthly summary (details)</p>
        <div className="space-y-4">
          {chunks.map((rows, chunkIndex) => (
            <div key={`details-chunk-${chunkIndex}`} className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-card text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2" rowSpan={2}>Month</th>
                    <th className="px-3 py-2" rowSpan={2}>Shipped</th>
                    <th className="px-3 py-2" colSpan={3}>Excel required date</th>
                    <th className="px-3 py-2" colSpan={3}>Calculated SLA</th>
                    <th className="px-3 py-2" rowSpan={2}>Mismatches</th>
                    <th className="px-3 py-2" rowSpan={2}>Avg turnover (days)</th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2">On-time</th>
                    <th className="px-3 py-2">Late</th>
                    <th className="px-3 py-2">On-time %</th>
                    <th className="px-3 py-2">On-time</th>
                    <th className="px-3 py-2">Late</th>
                    <th className="px-3 py-2">On-time %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`details-${chunkIndex}-${row.month}`} className="border-t border-border">
                      <td className="px-3 py-2">{row.month}</td>
                      <td className="px-3 py-2">{row.shipped}</td>
                      <td className="px-3 py-2">{row.onTime}</td>
                      <td className="px-3 py-2">{row.late}</td>
                      <td className="px-3 py-2">{formatPercent(row.onTimeRate)}</td>
                      <td className="px-3 py-2">{row.onTimeCalculated}</td>
                      <td className="px-3 py-2">{row.lateCalculated}</td>
                      <td className="px-3 py-2">{formatPercent(row.onTimeRateCalculated)}</td>
                      <td className="px-3 py-2">{row.mismatchCount}</td>
                      <td className="px-3 py-2">{row.averageTurnover !== null ? row.averageTurnover.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PdfReport({ calculation, filters }: PdfReportProps) {
  const kpis = useMemo(() => {
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

  const monthTickInterval = useMemo(() => {
    const len = calculation.monthly.length;
    return len > 8 ? Math.floor(len / 6) : 0;
  }, [calculation.monthly.length]);

  const filtersSummary = useMemo(() => {
    const products = filters.products;
    const productLabel = products.length
      ? `${products.length} selected — ${products.slice(0, 5).join(', ')}${products.length > 5 ? ` +${products.length - 5} more` : ''}`
      : 'All';
    const monthBasisLabel =
      filters.monthBasis === 'shipped' ? 'Shipped' : filters.monthBasis === 'sla_due' ? 'SLA due' : 'Order';
    const months = calculation.monthly.map((row) => row.month);
    const startMonth = filters.monthRange[0] ?? months[0] ?? '—';
    const endMonth = filters.monthRange[1] ?? months[months.length - 1] ?? '—';
    return {
      productLabel,
      monthBasisLabel,
      monthRange: `${startMonth} → ${endMonth}`,
      deliveryLabel: filters.deliveryNotRequired ? 'Included' : 'Excluded'
    };
  }, [filters, calculation.monthly]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xl font-semibold">SLA & Turnover Report</p>
        <p className="text-xs text-muted-foreground">Generated {new Date().toISOString().slice(0, 16).replace('T', ' ')}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="font-semibold">Products:</span> {filtersSummary.productLabel}
          </p>
          <p>
            <span className="font-semibold">Months ({filtersSummary.monthBasisLabel}):</span> {filtersSummary.monthRange}
          </p>
          <p>
            <span className="font-semibold">Delivery not required:</span> {filtersSummary.deliveryLabel}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Shipped rows</p>
          <p className="text-2xl font-semibold">{kpis.shipped}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg turnover (days)</p>
          <p className="text-2xl font-semibold">{kpis.avgTurnover}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">On-time rate (Excel required date)</p>
          <p className="text-2xl font-semibold">{kpis.onTimeRateExcel}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Late rate (Excel required date)</p>
          <p className="text-2xl font-semibold">{kpis.lateRateExcel}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">On-time rate (Calculated SLA)</p>
          <p className="text-2xl font-semibold">{kpis.onTimeRateCalculated}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Late rate (Calculated SLA)</p>
          <p className="text-2xl font-semibold">{kpis.lateRateCalculated}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">On-time vs late by month</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Excel required date</p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
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
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="late"
                    name="Late"
                    stackId="a"
                    fill="hsl(var(--chart-late-fill))"
                    stroke="hsl(var(--chart-late))"
                    fillOpacity={0.75}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Calculated SLA</p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
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
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="lateCalculated"
                    name="Late"
                    stackId="a"
                    fill="hsl(var(--chart-late-fill))"
                    stroke="hsl(var(--chart-late))"
                    fillOpacity={0.55}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Average turnover by month</p>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
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
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <MonthlyTablesForPdf data={calculation.monthly} />
    </div>
  );
}
