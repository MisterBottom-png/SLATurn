import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FiltersConfig, Preset, RulesConfig } from '@/types';

interface StepReviewProps {
  workbookName: string | null;
  totalRows: number;
  rules: RulesConfig;
  filters: FiltersConfig;
  presets: Preset[];
  canRun: boolean;
  onSavePreset: (name: string) => void;
  onLoadPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onJumpToRules?: () => void;
}

export default function StepReview({
  workbookName,
  totalRows,
  rules,
  filters,
  presets,
  canRun,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onJumpToRules
}: StepReviewProps) {
  const [presetId, setPresetId] = useState<string>('__none__');
  const [presetName, setPresetName] = useState('');

  const filtersSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.methods.length) parts.push(`${filters.methods.length} method(s)`);
    if (filters.products.length) parts.push(`${filters.products.length} product(s)`);
    if (filters.monthRange[0] || filters.monthRange[1]) {
      parts.push(`months ${filters.monthRange[0] ?? '…'} → ${filters.monthRange[1] ?? '…'}`);
    }
    parts.push(
      filters.monthBasis === 'shipped'
        ? 'basis: shipped'
        : filters.monthBasis === 'sla_due'
          ? 'basis: SLA due'
          : 'basis: order'
    );
    if (!filters.deliveryNotRequired) parts.push('exclude "Delivery not required"');
    return parts.length ? parts.join(', ') : 'None';
  }, [filters]);

  return (
    <div className="space-y-4">
      {!canRun ? (
        <Alert>
          <AlertTitle>Not ready to run</AlertTitle>
          <AlertDescription>
            Upload a workbook that contains the required feed columns. Results will auto-run once detected.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>Ready to run</AlertTitle>
          <AlertDescription>
            Results will auto-run as soon as the workbook is ready.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Run summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-secondary/70">File</Badge>
              <span className="font-semibold">{workbookName ?? '—'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-secondary/70">Rows</Badge>
              <span className="font-semibold">{totalRows}</span>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Rules & filters</span>
                <span className="text-muted-foreground">Rules in settings, filters above results</span>
              </div>
              <div className="mt-2 grid gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Exclude China</span>
                  <span className="font-semibold">{rules.excludeChina ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status matchers</span>
                  <span className="font-semibold">{rules.statusMatchers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Filters</span>
                  <span className="font-semibold">{filtersSummary}</span>
                </div>
              </div>
            </div>

            {onJumpToRules ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onJumpToRules}>
                  Edit rules
                </Button>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-card p-3 text-xs">
              <p className="font-semibold">Next: run analysis</p>
              <p className="mt-1 text-muted-foreground">
                Results auto-run once required columns are detected, or use the <span className="font-semibold">Run now</span> button in Quick Run.
                After running, you’ll see coverage and excluded-row reasons.
              </p>
              {!canRun ? (
                <p className="mt-2 text-destructive">
                  Run is disabled until required columns are detected.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Presets (local)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Save your current mapping + rules + filters for reuse. Presets are stored in this browser only.
              </p>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Preset name (e.g., JP Feed)"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    onSavePreset(presetName);
                    setPresetName('');
                  }}
                >
                  Save
                </Button>
              </div>
            </div>

            {presets.length ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Load a preset</p>
                  <span className="text-xs text-muted-foreground">{presets.length} saved</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="min-w-[220px] flex-1">
                    <Select value={presetId} onValueChange={setPresetId}>
                      <SelectTrigger aria-label="Select preset">
                        <SelectValue className="truncate" placeholder="Select a preset" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select a preset</SelectItem>
                        {presets.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={presetId === '__none__'}
                    onClick={() => {
                      if (presetId === '__none__') return;
                      onLoadPreset(presetId);
                    }}
                  >
                    Load
                  </Button>
                </div>

                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-card text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Created</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {presets.slice(0, 8).map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-3 py-2 font-semibold">{p.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {new Date(p.createdAt).toISOString().slice(0, 10)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button type="button" size="sm" variant="ghost" onClick={() => onDeletePreset(p.id)}>
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {presets.length > 8 ? (
                  <p className="text-xs text-muted-foreground">Showing 8 of {presets.length} presets.</p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-3 text-sm">
                <p className="font-semibold">No presets yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Save one after you finish configuring rules and filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
