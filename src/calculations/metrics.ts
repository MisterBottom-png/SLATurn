import { formatMonthKey, getAxisDate, parseDateSafe } from '@/parsing/date';
import { normalizeCellValue } from '@/parsing/rows';
import type { CalculationResult, EnrichedRow, FieldMapping, FiltersConfig, MonthlySummary, RulesConfig } from '@/types';

// Required mapping columns for the calculation flow.
// NOTE: the Excel required arrival date is mapped (for comparison), but is NOT mandatory per-row.
const REQUIRED_MAPPED_FIELDS: Array<keyof FieldMapping> = [
  'order_date',
  'shipping_date',
  'required_arrival_date',
  'status',
  'method',
  'product',
  'destination_country'
];

// Fields that must be present per-row to be included in the KPIs.
// Per requirements: order date + ship date are mandatory; Excel required date can be missing.
const REQUIRED_VALUE_FIELDS: Array<keyof FieldMapping> = [
  'order_date',
  'shipping_date',
  'status',
  'method',
  'product',
  'destination_country'
];

function getEnrichedValue(row: EnrichedRow, field: keyof FieldMapping) {
  switch (field) {
    case 'order_date':
      return row.orderDate;
    case 'shipping_date':
      return row.shippingDate;
    case 'required_arrival_date':
      return row.requiredArrivalDate;
    case 'status':
      return row.status;
    case 'method':
      return row.method;
    case 'product':
      return row.product;
    case 'destination_country':
      return row.destinationCountry;
    case 'order_id':
      return row.orderId;
    case 'customer':
      return row.customer;
    default:
      return null;
  }
}

function getMappedValue(row: Record<string, unknown>, mapping: FieldMapping, key: string) {
  const column = mapping[key];
  if (!column) return '';
  return row[column] ?? '';
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchStatus(status: string, rules: RulesConfig) {
  const listMatch = rules.statusMatchers.some((matcher) => {
    const normalizedMatcher = matcher.trim().toLowerCase();
    if (!normalizedMatcher) return false;
    if (status.trim().toLowerCase() === normalizedMatcher) return true;
    const regex = new RegExp(`\\b${escapeRegex(normalizedMatcher)}\\b`, 'i');
    return regex.test(status);
  });
  if (rules.statusRegex) {
    try {
      const regex = new RegExp(rules.statusRegex, 'i');
      return regex.test(status) || listMatch;
    } catch {
      return listMatch;
    }
  }
  return listMatch;
}

function daysBetween(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / 86400000);
}

function cleanShippingMethod(method: string) {
  return method.trim().replace(/\s+/g, ' ');
}

function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function getSlaDaysForProduct(product: string): number {
  // Confirmed rule:
  // - Pillows -> 14 days (matches both "pillow" and common Estonian stems like "padj...")
  // - Default -> 28 days
  const normalized = product.trim().toLowerCase();
  if (normalized.includes('pillow') || normalized.includes('padj') || normalized.includes('padi')) return 14;
  return 28;
}

export function calculateMetrics(
  rawRows: Record<string, unknown>[],
  mapping: FieldMapping,
  rules: RulesConfig,
  filters: FiltersConfig
): CalculationResult {
  const exclusions = new Map<string, number>();
  const excludedRows: Array<{ row: EnrichedRow; reason: string }> = [];

  const trackExclusion = (reason: string) => {
    exclusions.set(reason, (exclusions.get(reason) ?? 0) + 1);
  };

  const enriched: EnrichedRow[] = rawRows.map((row) => {
    const orderDate = parseDateSafe(getMappedValue(row, mapping, 'order_date'));
    const shippingDate = parseDateSafe(getMappedValue(row, mapping, 'shipping_date'));
    const requiredArrivalDate = parseDateSafe(getMappedValue(row, mapping, 'required_arrival_date'));

    const status = normalizeCellValue(getMappedValue(row, mapping, 'status'));
    const method = normalizeCellValue(getMappedValue(row, mapping, 'method'));
    const product = normalizeCellValue(getMappedValue(row, mapping, 'product'));
    const destinationCountry = normalizeCellValue(getMappedValue(row, mapping, 'destination_country'));
    const orderId = normalizeCellValue(getMappedValue(row, mapping, 'order_id'));
    const customer = normalizeCellValue(getMappedValue(row, mapping, 'customer'));

    const turnoverDays = orderDate && shippingDate ? Math.max(daysBetween(orderDate, shippingDate), 0) : null;

    const slaDays = getSlaDaysForProduct(product);
    const calculatedRequiredArrivalDate = orderDate ? addDaysUTC(orderDate, slaDays) : null;

    // Excel-based vs calculated on-time results.
    const isOnTime = shippingDate && requiredArrivalDate ? shippingDate <= requiredArrivalDate : null;
    const isOnTimeCalculated =
      shippingDate && calculatedRequiredArrivalDate ? shippingDate <= calculatedRequiredArrivalDate : null;

    const mismatchType =
      isOnTime !== null && isOnTimeCalculated !== null && isOnTime !== isOnTimeCalculated
        ? isOnTimeCalculated
          ? 'Calculated OK, Excel NOT OK'
          : 'Calculated NOT OK, Excel OK'
        : null;

    const axisDate = getAxisDate(filters.monthBasis, {
      orderDate,
      shippingDate,
      requiredArrivalDate
    });

    return {
      orderDate,
      shippingDate,
      requiredArrivalDate,
      calculatedRequiredArrivalDate,
      slaDays,
      status,
      method,
      product,
      destinationCountry,
      orderId: orderId || undefined,
      customer: customer || undefined,
      turnoverDays,
      isOnTime,
      isOnTimeCalculated,
      mismatchType,
      monthKey: formatMonthKey(axisDate)
    };
  });

  const validRows = enriched.filter((row) => {
    const missingMapped = REQUIRED_MAPPED_FIELDS.some((field) => !mapping[field]);
    if (missingMapped) return false;

    const missingRequiredValues = REQUIRED_VALUE_FIELDS.some((field) => {
      const value = getEnrichedValue(row, field);
      return !value;
    });
    if (missingRequiredValues) return false;

    // Mandatory dates per requirements.
    if (!row.orderDate || !row.shippingDate) return false;

    return true;
  });

  const includedRows = enriched.filter((row) => {
    const missingMapped = REQUIRED_MAPPED_FIELDS.some((field) => !mapping[field]);
    if (missingMapped) {
      trackExclusion('Missing required fields');
      excludedRows.push({ row, reason: 'Missing required fields' });
      return false;
    }

    const missingRequiredValues = REQUIRED_VALUE_FIELDS.some((field) => {
      const value = getEnrichedValue(row, field);
      return !value;
    });
    if (missingRequiredValues) {
      trackExclusion('Missing required fields');
      excludedRows.push({ row, reason: 'Missing required fields' });
      return false;
    }

    // Mandatory dates per requirements: order date + ship date.
    if (!row.orderDate || !row.shippingDate) {
      trackExclusion('Unparseable or missing dates');
      excludedRows.push({ row, reason: 'Unparseable or missing dates' });
      return false;
    }

    if (!matchStatus(row.status, rules)) {
      trackExclusion('Status mismatch');
      excludedRows.push({ row, reason: 'Status mismatch' });
      return false;
    }

    if (rules.excludeChina && row.destinationCountry.toLowerCase().includes('china')) {
      trackExclusion('Excluded country');
      excludedRows.push({ row, reason: 'Excluded country' });
      return false;
    }

    if (!filters.deliveryNotRequired && cleanShippingMethod(row.method) === 'Delivery not required') {
      trackExclusion('Excluded delivery not required');
      excludedRows.push({ row, reason: 'Excluded delivery not required' });
      return false;
    }

    if (filters.methods.length && !filters.methods.includes(row.method)) {
      trackExclusion('Filtered out by method');
      excludedRows.push({ row, reason: 'Filtered out by method' });
      return false;
    }

    if (filters.products.length && !filters.products.includes(row.product)) {
      trackExclusion('Filtered out by product');
      excludedRows.push({ row, reason: 'Filtered out by product' });
      return false;
    }

    if (filters.monthRange[0] && row.monthKey && row.monthKey < filters.monthRange[0]) {
      trackExclusion('Filtered out by month');
      excludedRows.push({ row, reason: 'Filtered out by month' });
      return false;
    }

    if (filters.monthRange[1] && row.monthKey && row.monthKey > filters.monthRange[1]) {
      trackExclusion('Filtered out by month');
      excludedRows.push({ row, reason: 'Filtered out by month' });
      return false;
    }

    if (!row.monthKey) {
      trackExclusion('Missing month basis');
      excludedRows.push({ row, reason: 'Missing month basis' });
      return false;
    }

    return true;
  });

  const monthly = buildMonthlySummary(includedRows);

  return {
    monthly,
    rows: includedRows,
    quality: {
      rawRows: rawRows.length,
      validRows: validRows.length,
      includedRows: includedRows.length,
      exclusions: Array.from(exclusions.entries()).map(([reason, count]) => ({ reason, count }))
    },
    excludedRows
  };
}

function buildMonthlySummary(rows: EnrichedRow[]): MonthlySummary[] {
  const grouped = new Map<string, EnrichedRow[]>();
  rows.forEach((row) => {
    if (!row.monthKey) return;
    if (!grouped.has(row.monthKey)) grouped.set(row.monthKey, []);
    grouped.get(row.monthKey)?.push(row);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, monthRows]) => {
      const shipped = monthRows.length;
      // Excel required date variant.
      const onTime = monthRows.filter((row) => row.isOnTime).length;
      const late = monthRows.filter((row) => row.isOnTime === false).length;

      // Calculated SLA/turnover variant.
      const onTimeCalculated = monthRows.filter((row) => row.isOnTimeCalculated).length;
      const lateCalculated = monthRows.filter((row) => row.isOnTimeCalculated === false).length;

      const mismatchCount = monthRows.filter((row) => row.mismatchType).length;
      const turnoverValues = monthRows
        .map((row) => row.turnoverDays)
        .filter((value): value is number => typeof value === 'number');
      const averageTurnover = turnoverValues.length
        ? turnoverValues.reduce((acc, value) => acc + value, 0) / turnoverValues.length
        : null;
      return {
        month,
        shipped,
        onTime,
        late,
        onTimeRate: shipped ? onTime / shipped : 0,
        onTimeCalculated,
        lateCalculated,
        onTimeRateCalculated: shipped ? onTimeCalculated / shipped : 0,
        mismatchCount,
        averageTurnover: averageTurnover !== null ? Number(averageTurnover.toFixed(1)) : null
      };
    });
}
