import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { WorkbookInfo } from '@/types';

interface StepUploadProps {
  workbookInfo: WorkbookInfo | null;
  onFile: (file: File) => void;
  onClear: () => void;
}

export default function StepUpload({ workbookInfo, onFile, onClear }: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    // Allow selecting the same file again after Reset (input change won't fire if value is unchanged).
    if (inputRef.current) inputRef.current.value = '';
    inputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    // IMPORTANT: in some browsers FileList behaves like a live view of the input.
    // If we clear the input before we copy the File out, files[0] can become undefined
    // and downstream code will crash (e.g. file.arrayBuffer()).
    const file = files?.[0];
    if (!file) return;
    // Clear immediately so re-selecting the same file works.
    if (inputRef.current) inputRef.current.value = '';
    onFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <div
        className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-5 text-center text-sm"
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') openPicker();
        }}
        onClick={() => openPicker()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <p className="font-semibold">Drag and drop your Excel file</p>
        <p className="text-xs text-muted-foreground">or click to browse .xlsx files</p>
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={(event) => {
            // Prevent bubbling to the container (which would call openPicker twice).
            event.stopPropagation();
            openPicker();
          }}
        >
          Choose file
        </Button>
      </div>

      {workbookInfo ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-xs">
          <div>
            <p className="font-semibold">{workbookInfo.name}</p>
            <p className="text-muted-foreground">{(workbookInfo.size / 1024).toFixed(1)} KB</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{workbookInfo.sheetNames.length} sheets</Badge>
            <Button type="button" variant="outline" onClick={onClear}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
