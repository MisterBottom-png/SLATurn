import { useMemo, useState } from 'react';
import { AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import type { RulesConfig } from '@/types';

interface StepRulesProps {
  rules: RulesConfig;
  onChangeRules: (rules: RulesConfig) => void;
}

export default function StepRules({
  rules,
  onChangeRules
}: StepRulesProps) {
  const [regexDraft, setRegexDraft] = useState(rules.statusRegex);

  const regexError = useMemo(() => {
    if (!regexDraft) return '';
    try {
      new RegExp(regexDraft, 'i');
      return '';
    } catch {
      return 'Invalid regex pattern.';
    }
  }, [regexDraft]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[hsl(var(--primary))]"
            checked={rules.excludeChina}
            onChange={(event) => onChangeRules({ ...rules, excludeChina: event.target.checked })}
          />
          Exclude China shipments
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Useful for isolating EU/UK performance when China adds long lead times.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Shipped status matching</p>
            <p className="text-xs text-muted-foreground">
              Enter phrases to match against the status column (case-insensitive).
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Advanced
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Advanced status matching</DialogTitle>
                <DialogDescription>
                  Provide a regular expression to match statuses. Leave empty to use only the list
                  below.
                </DialogDescription>
              </DialogHeader>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={regexDraft}
                onChange={(event) => setRegexDraft(event.target.value)}
              />
              {regexError ? (
                <AlertDescription className="text-destructive">{regexError}</AlertDescription>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (regexError) return;
                    onChangeRules({ ...rules, statusRegex: regexDraft });
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <textarea
          className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          rows={3}
          value={rules.statusMatchers.join(', ')}
          onChange={(event) =>
            onChangeRules({
              ...rules,
              statusMatchers: event.target.value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            })
          }
        />
      </div>
    </div>
  );
}
