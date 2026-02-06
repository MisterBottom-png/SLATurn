import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as XLSX from 'xlsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import FiltersPanel from '@/components/FiltersPanel';
import StepResults from '@/steps/StepResults';
import StepRules from '@/steps/StepRules';
import StepReview from '@/steps/StepReview';
import StepUpload from '@/steps/StepUpload';
import { calculateMetrics } from '@/calculations/metrics';
import { DEFAULT_FILTERS, DEFAULT_RULES, REQUIRED_FIELDS } from '@/common/constants';
import { getSheetRows, readWorkbook } from '@/excel/workbook';
import { detectHeaderRow } from '@/parsing/headerDetection';
import { mapRowsToObjects, normalizeCellValue } from '@/parsing/rows';
import { suggestMapping } from '@/parsing/normalize';
import {
  addPreset,
  deletePreset,
  getPreset,
  loadFilters,
  loadMapping,
  loadPresets,
  loadRules,
  saveFilters,
  saveMapping,
  saveRules
} from '@/lib/storage';
import type { CalculationResult, FieldMapping, FiltersConfig, Preset, RulesConfig, WorkbookInfo } from '@/types';

const emptyMapping: FieldMapping = {
  order_date: null,
  shipping_date: null,
  required_arrival_date: null,
  status: null,
  method: null,
  product: null,
  destination_country: null,
  order_id: null,
  customer: null
};

function makeSignature(payload: unknown) {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(Date.now());
  }
}

export default function App() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [workbookInfo, setWorkbookInfo] = useState<WorkbookInfo | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [sheetRows, setSheetRows] = useState<unknown[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [mapping, setMapping] = useState<FieldMapping>(emptyMapping);
  const [rules, setRules] = useState<RulesConfig>(DEFAULT_RULES);
  const [filters, setFilters] = useState<FiltersConfig>(DEFAULT_FILTERS);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [lastRunSignature, setLastRunSignature] = useState<string | null>(null);
  const [hasSavedFilters, setHasSavedFilters] = useState<boolean | null>(null);
  const autoAppliedFilters = useRef(false);
  const rulesRef = useRef<HTMLDivElement | null>(null);
  const reviewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedMapping = loadMapping();
    if (storedMapping) setMapping({ ...emptyMapping, ...storedMapping });
    const storedRules = loadRules();
    if (storedRules) setRules(storedRules);
    const storedFilters = loadFilters();
    if (storedFilters) {
      setFilters(storedFilters);
      setHasSavedFilters(true);
    } else {
      setHasSavedFilters(false);
    }
    setPresets(loadPresets());
  }, []);

  useEffect(() => {
    saveMapping(mapping);
  }, [mapping]);

  useEffect(() => {
    saveRules(rules);
  }, [rules]);

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  useEffect(() => {
    if (!workbook || !selectedSheet) return;
    const rows = getSheetRows(workbook, selectedSheet);
    setSheetRows(rows);
    const detected = detectHeaderRow(rows);
    setHeaderRowIndex(detected.rowIndex);
  }, [workbook, selectedSheet]);

  const parsed = useMemo(() => {
    if (!sheetRows.length) return null;
    return mapRowsToObjects(sheetRows, headerRowIndex);
  }, [sheetRows, headerRowIndex]);

  useEffect(() => {
    if (!parsed?.headers?.length) return;
    const suggestions = suggestMapping(parsed.headers);
    setMapping((prev) => {
      const next = { ...prev };
      Object.entries(suggestions).forEach(([key, value]) => {
        const current = (next as any)[key] as string | null | undefined;
        const isRequired = REQUIRED_FIELDS.some((field) => field.key === key);

        if (isRequired) {
          // Fully automated mapping for required fields.
          if (value && value !== current) {
            (next as any)[key] = value;
          }
          return;
        }

        if (!current || !parsed.headers.includes(current)) {
          (next as any)[key] = value;
        }
      });
      return next;
    });
  }, [parsed?.headers]);

  const missingRequired = useMemo(() => {
    const headers = parsed?.headers ?? [];
    return REQUIRED_FIELDS.filter((field) => {
      const col = mapping[field.key];
      return !(col && headers.includes(col));
    });
  }, [mapping, parsed]);

  const requiredMapped = missingRequired.length === 0;

  const availableMethods = useMemo(() => {
    if (!parsed || !mapping.method) return [] as string[];
    const cleanedMethods = parsed.rows
      .map((row) => normalizeCellValue(row.raw[mapping.method!] ?? ''))
      .filter((value) => value !== '' && !/^\d+$/.test(value));
    return Array.from(new Set(cleanedMethods)).sort();
  }, [parsed, mapping.method]);

  const availableProducts = useMemo(() => {
    if (!parsed || !mapping.product) return [] as string[];
    return Array.from(
      new Set(parsed.rows.map((row) => String(row.raw[mapping.product!] ?? '').trim()).filter(Boolean))
    ).sort();
  }, [parsed, mapping.product]);

  const availableMonths = useMemo(() => {
    if (!parsed || !mapping.order_date || !mapping.shipping_date || !mapping.required_arrival_date) {
      return [] as string[];
    }
    const rawRows = parsed.rows.map((entry) => entry.raw);
    const result = calculateMetrics(rawRows, mapping, rules, {
      ...filters,
      monthRange: [null, null]
    });
    return result.monthly.map((row) => row.month);
  }, [parsed, mapping, rules, filters]);

  useEffect(() => {
    if (!availableMonths.length) return;
    const clampMonth = (value: string | null) => {
      if (!value) return null;
      if (availableMonths.includes(value)) return value;
      const next = availableMonths.find((month) => month >= value);
      return next ?? availableMonths[availableMonths.length - 1] ?? null;
    };
    const nextStart = clampMonth(filters.monthRange[0]);
    const nextEnd = clampMonth(filters.monthRange[1]);
    if (nextStart !== filters.monthRange[0] || nextEnd !== filters.monthRange[1]) {
      setFilters((prev) => ({
        ...prev,
        monthRange: [nextStart, nextEnd]
      }));
    }
  }, [availableMonths, filters.monthRange]);

  useEffect(() => {
    if (hasSavedFilters !== false) return;
    if (autoAppliedFilters.current) return;
    if (!parsed) return;
    const estoniaMethods = availableMethods.filter((method) =>
      method.toLowerCase().includes('estonia')
    );
    setFilters((prev) => ({
      ...prev,
      methods: estoniaMethods,
      deliveryNotRequired: true
    }));
    autoAppliedFilters.current = true;
  }, [availableMethods, hasSavedFilters, parsed]);

  const currentSignature = useMemo(() => {
    return makeSignature({ selectedSheet, headerRowIndex, mapping, rules, filters });
  }, [selectedSheet, headerRowIndex, mapping, rules, filters]);

  const resultsDirty = Boolean(calculation && lastRunSignature && lastRunSignature !== currentSignature);

  const handleFile = async (file?: File) => {
    if (!file) return;
    const wb = await readWorkbook(file);
    setWorkbook(wb);
    setWorkbookInfo({ name: file.name, size: file.size, sheetNames: wb.SheetNames });
    const feed = wb.SheetNames.find((name) => name.toLowerCase() === 'feed');
    setSelectedSheet(feed ?? wb.SheetNames[0] ?? null);
    setCalculation(null);
    setLastRunSignature(null);
    setShowAdvanced(false);
  };

  const handleClear = () => {
    setWorkbook(null);
    setWorkbookInfo(null);
    setSelectedSheet(null);
    setSheetRows([]);
    setHeaderRowIndex(0);
    setMapping(emptyMapping);
    setRules(DEFAULT_RULES);
    setFilters(DEFAULT_FILTERS);
    setCalculation(null);
    setLastRunSignature(null);
    setShowAdvanced(false);
  };

  const handleSavePreset = (name: string) => {
    addPreset(name, mapping, rules, filters);
    setPresets(loadPresets());
  };

  const handleLoadPreset = (id: string) => {
    const preset = getPreset(id);
    if (!preset) return;
    setMapping({ ...emptyMapping, ...preset.mapping });
    setRules(preset.rules);
    setFilters(preset.filters);
  };

  const handleDeletePreset = (id: string) => {
    deletePreset(id);
    setPresets(loadPresets());
  };

  const canRun = Boolean(parsed?.rows?.length && requiredMapped);

  const handleCalculate = useCallback(() => {
    if (!parsed || !requiredMapped) return;
    const rawRows = parsed.rows.map((entry) => entry.raw);
    const result = calculateMetrics(rawRows, mapping, rules, filters);
    setCalculation(result);
    setLastRunSignature(currentSignature);
  }, [parsed, requiredMapped, mapping, rules, filters, currentSignature]);

  const readyToRun = Boolean(workbook && selectedSheet && parsed?.headers?.length && requiredMapped);

  useEffect(() => {
    if (!readyToRun) return;
    if (lastRunSignature === currentSignature) return;
    handleCalculate();
  }, [readyToRun, lastRunSignature, currentSignature, handleCalculate]);

  const scrollToRef = (ref: RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <h1 className="text-center text-2xl font-semibold">Turnover &amp; SLA Dashboard</h1>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-6 px-6 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="min-w-0 space-y-4">
          {/* "Quick Run" is only shown before a dataset is chosen to reduce confusion after upload. */}
          {!workbookInfo ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold">Quick Run</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload a workbook and we’ll auto-run as soon as the required columns are detected.
              </p>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="font-semibold">Upload</span>
                  <span className={workbookInfo ? 'text-primary' : 'text-muted-foreground'}>
                    {workbookInfo ? 'Ready' : 'Waiting'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span className="font-semibold">Results</span>
                  <span className={calculation ? 'text-primary' : 'text-muted-foreground'}>
                    {calculation ? 'Generated' : canRun ? 'Auto-running' : 'Waiting'}
                  </span>
                </div>
                {missingRequired.length ? (
                  <p className="text-muted-foreground">
                    {missingRequired.length} required column{missingRequired.length === 1 ? '' : 's'} not detected yet.
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => setShowAdvanced((prev) => !prev)}
              >
                {showAdvanced ? 'Hide Settings' : 'Show Settings'}
              </Button>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Dataset</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {workbookInfo ? 'Loaded workbook' : 'No file selected'}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleClear}>
                Reset
              </Button>
            </div>
            {workbookInfo ? (
              <div className="mt-3 space-y-1 text-xs">
                <p className="font-semibold">{workbookInfo.name}</p>
                <p className="text-muted-foreground">{(workbookInfo.size / 1024).toFixed(1)} KB · {workbookInfo.sheetNames.length} sheets</p>
                {selectedSheet ? (
                  <p className="text-muted-foreground">Current sheet: <span className="font-semibold text-foreground">{selectedSheet}</span></p>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>{workbookInfo ? 'Results' : 'Quick Run'}</CardTitle>
              {!workbookInfo ? (
                <p className="text-sm text-muted-foreground">
                  Upload a workbook to generate KPI results automatically once the required fields are mapped.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  To load a different workbook, press <span className="font-semibold">Reset</span> in the Dataset panel.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {!workbookInfo ? (
                <StepUpload workbookInfo={workbookInfo} onFile={handleFile} onClear={handleClear} />
              ) : null}

              {resultsDirty ? (
                <Alert>
                  <AlertTitle>Settings changed</AlertTitle>
                  <AlertDescription>
                    Rules or filters changed since the last run. Results will auto-refresh once ready.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Results</p>
                  <p className="text-xs text-muted-foreground">
                    {canRun ? 'Auto-run is enabled.' : 'Upload a compatible feed to enable auto-run.'}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={handleCalculate} disabled={!canRun}>
                  {calculation ? 'Re-run now' : 'Run now'}
                </Button>
              </div>

              {parsed ? (
                <FiltersPanel
                  filters={filters}
                  onChangeFilters={(next) => {
                    setFilters(next);
                    setCalculation(null);
                    setLastRunSignature(null);
                  }}
                  availableMethods={availableMethods}
                  availableProducts={availableProducts}
                  availableMonths={availableMonths}
                />
              ) : null}

              <StepResults calculation={calculation} filters={filters} />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Settings &amp; Advanced</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Adjust shipped status matching rules and manage presets. Hidden by default.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvanced((prev) => !prev)}>
                {showAdvanced ? 'Collapse' : 'Expand'}
              </Button>
            </CardHeader>
            {showAdvanced ? (
              <CardContent className="space-y-6">
                <div ref={rulesRef} className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold">Rules</p>
                    <p className="text-xs text-muted-foreground">
                      Adjust shipped status matching. Filters are available directly above the results.
                    </p>
                  </div>
                  <StepRules
                    rules={rules}
                    onChangeRules={(next) => {
                      setRules(next);
                      setCalculation(null);
                      setLastRunSignature(null);
                    }}
                  />
                </div>

                <Separator />

                <div ref={reviewRef} className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold">Review &amp; presets</p>
                    <p className="text-xs text-muted-foreground">
                      Save reusable presets or validate the run summary before sharing results.
                    </p>
                  </div>
                  <StepReview
                    workbookName={workbookInfo?.name ?? null}
                    totalRows={parsed?.rows?.length ?? 0}
                    rules={rules}
                    filters={filters}
                    presets={presets}
                    canRun={canRun}
                    onSavePreset={handleSavePreset}
                    onLoadPreset={handleLoadPreset}
                    onDeletePreset={handleDeletePreset}
                    onJumpToRules={() => {
                      setShowAdvanced(true);
                      scrollToRef(rulesRef);
                    }}
                  />
                </div>
              </CardContent>
            ) : null}
          </Card>
        </section>
      </main>
    </div>
  );
}
