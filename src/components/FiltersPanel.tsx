import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_FILTERS } from '@/common/constants';
import type { FiltersConfig } from '@/types';

interface FiltersPanelProps {
  filters: FiltersConfig;
  onChangeFilters: (filters: FiltersConfig) => void;
  availableMethods: string[];
  availableProducts: string[];
  availableMonths: string[];
}

export default function FiltersPanel({
  filters,
  onChangeFilters,
  availableMethods,
  availableProducts,
  availableMonths
}: FiltersPanelProps) {
  const [newMethod, setNewMethod] = useState('');
  const [newProduct, setNewProduct] = useState('');

  const addFilter = (type: 'methods' | 'products', value: string) => {
    if (!value) return false;
    const list = filters[type];
    if (list.includes(value)) return false;
    onChangeFilters({ ...filters, [type]: [...list, value] });
    return true;
  };

  const removeFilter = (type: 'methods' | 'products', value: string) => {
    onChangeFilters({ ...filters, [type]: filters[type].filter((item) => item !== value) });
  };

  const clearFilters = () => {
    onChangeFilters({
      ...filters,
      methods: [],
      products: [],
      monthRange: [null, null],
      deliveryNotRequired: DEFAULT_FILTERS.deliveryNotRequired,
      monthBasis: DEFAULT_FILTERS.monthBasis
    });
  };

  const hasFiltersApplied = useMemo(() => {
    return Boolean(
      filters.methods.length ||
        filters.products.length ||
        filters.monthRange[0] ||
        filters.monthRange[1] ||
        !filters.deliveryNotRequired ||
        filters.monthBasis !== DEFAULT_FILTERS.monthBasis
    );
  }, [filters]);

  const isMethodAddDisabled = !newMethod || filters.methods.includes(newMethod);
  const isProductAddDisabled = !newProduct || filters.products.includes(newProduct);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Filters</p>
          <p className="text-xs text-muted-foreground">Narrow the dataset before calculating metrics.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
          Clear all
        </Button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(var(--primary))]"
              checked={filters.deliveryNotRequired}
              onChange={(event) => onChangeFilters({ ...filters, deliveryNotRequired: event.target.checked })}
            />
            Include "Delivery not required"
          </label>
          <p className="text-xs text-muted-foreground">
            When unchecked, rows using this shipping method will be excluded.
          </p>
        </div>

        <div className="space-y-2">
          <Select value={newMethod} onValueChange={(value) => setNewMethod(value)}>
            <SelectTrigger aria-label="Filter by method">
              <SelectValue className="truncate" placeholder="Select method" />
            </SelectTrigger>
            <SelectContent>
              {availableMethods.length ? (
                availableMethods.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__none__" disabled>
                  No methods detected
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isMethodAddDisabled}
            onClick={() => {
              if (addFilter('methods', newMethod)) {
                setNewMethod('');
              }
            }}
          >
            Add method
          </Button>
          <div className="flex flex-wrap gap-2">
            {filters.methods.map((method) => (
              <Badge
                key={method}
                className="max-w-full cursor-pointer truncate hover:bg-muted/70"
                onClick={() => removeFilter('methods', method)}
              >
                {method} ×
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Select value={newProduct} onValueChange={(value) => setNewProduct(value)}>
            <SelectTrigger aria-label="Filter by product">
              <SelectValue className="truncate" placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {availableProducts.length ? (
                availableProducts.map((product) => (
                  <SelectItem key={product} value={product}>
                    {product}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__none__" disabled>
                  No products detected
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isProductAddDisabled}
            onClick={() => {
              if (addFilter('products', newProduct)) {
                setNewProduct('');
              }
            }}
          >
            Add product
          </Button>
          <div className="flex flex-wrap gap-2">
            {filters.products.map((product) => (
              <Badge
                key={product}
                className="max-w-full cursor-pointer truncate hover:bg-muted/70"
                onClick={() => removeFilter('products', product)}
              >
                {product} ×
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Start month</label>
          <Select
            value={filters.monthRange[0] ?? ''}
            onValueChange={(value) =>
              onChangeFilters({
                ...filters,
                monthRange: [value === '__none__' ? null : value, filters.monthRange[1]]
              })
            }
          >
            <SelectTrigger aria-label="Start month">
              <SelectValue className="truncate" placeholder="Start month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {availableMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">End month</label>
          <Select
            value={filters.monthRange[1] ?? ''}
            onValueChange={(value) =>
              onChangeFilters({
                ...filters,
                monthRange: [filters.monthRange[0], value === '__none__' ? null : value]
              })
            }
          >
            <SelectTrigger aria-label="End month">
              <SelectValue className="truncate" placeholder="End month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {availableMonths.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <label className="text-xs text-muted-foreground">Month basis</label>
        <Select
          value={filters.monthBasis}
          onValueChange={(value) => onChangeFilters({ ...filters, monthBasis: value as FiltersConfig['monthBasis'] })}
        >
          <SelectTrigger aria-label="Month basis">
            <SelectValue className="truncate" placeholder="Shipped month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shipped">Shipped month</SelectItem>
            <SelectItem value="sla_due">SLA due month</SelectItem>
            <SelectItem value="order">Order month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{hasFiltersApplied ? 'Filters applied.' : 'No filters applied.'}</p>
    </div>
  );
}
