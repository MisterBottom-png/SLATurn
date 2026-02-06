import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const BACKGROUND_COLOR = '#ffffff';

export interface PdfExportOptions {
  /** Default: "SampleKPI_results" */
  filenamePrefix?: string;
  /** Default: landscape ("l") to keep tables readable. */
  orientation?: 'p' | 'l';
  /** Default: 250. Increase if charts are still blank in the export. */
  chartsRenderDelayMs?: number;
}

const waitForCharts = async (delayMs: number) => {
  // Ensure fonts are loaded; otherwise text measurement differs vs on-screen rendering.
  // (document.fonts is supported in all modern Chromium-based browsers.)
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const formatTimestamp = (date: Date) => {
  // Local time (not UTC) to match what's shown in the UI.
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
};

type AvoidBreakRange = { top: number; bottom: number };

const collectAvoidBreakRanges = (root: HTMLElement): AvoidBreakRange[] => {
  const rootRect = root.getBoundingClientRect();
  const rootTop = rootRect.top;
  const ranges: AvoidBreakRange[] = [];

  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-pdf-avoid-break="true"]'));
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    const top = Math.max(0, rect.top - rootTop + root.scrollTop);
    const bottom = Math.max(top, rect.bottom - rootTop + root.scrollTop);
    if (bottom - top > 0) {
      ranges.push({ top, bottom });
    }
  }

  return ranges.sort((a, b) => a.top - b.top);
};

const sliceCanvas = (canvas: HTMLCanvasElement, pageHeightPx: number, avoidBreakRanges: AvoidBreakRange[] = []) => {
  const slices: HTMLCanvasElement[] = [];
  let offsetY = 0;

  const minPageFillRatio = 0.2; // don't create ultra-short pages unless unavoidable

  while (offsetY < canvas.height) {
    let sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
    const proposedEnd = offsetY + sliceHeight;

    // Avoid breaking through marked sections by shifting the page break.
    // If the break cuts through a marked range [top, bottom), move the break to either:
    // - the start of the range, or
    // - the end of the range (if moving to the start would create an extremely short page).
    for (const range of avoidBreakRanges) {
      const overlapsBreak = range.top < proposedEnd && range.bottom > proposedEnd;
      if (!overlapsBreak) continue;

      const heightToRangeStart = range.top - offsetY;
      const shortPage = heightToRangeStart < pageHeightPx * minPageFillRatio;

      if (!shortPage && heightToRangeStart > 0) {
        sliceHeight = Math.min(heightToRangeStart, canvas.height - offsetY);
      } else {
        const heightToRangeEnd = range.bottom - offsetY;
        if (heightToRangeEnd > 0) {
          sliceHeight = Math.min(heightToRangeEnd, canvas.height - offsetY);
        }
      }
      break;
    }

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const context = pageCanvas.getContext('2d');
    if (context) {
      context.fillStyle = BACKGROUND_COLOR;
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      context.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    }

    slices.push(pageCanvas);
    offsetY += sliceHeight;
  }

  return slices;
};

export const exportResultsToPdf = async (element: HTMLElement, options: PdfExportOptions = {}) => {
  const {
    filenamePrefix = 'SampleKPI_results',
    orientation = 'l',
    chartsRenderDelayMs = 250
  } = options;

  await waitForCharts(chartsRenderDelayMs);

  // Marked sections we should not split across pages.
  const avoidBreakRanges = collectAvoidBreakRanges(element);

  const captureWidth = Math.max(element.scrollWidth, element.offsetWidth);
  const captureHeight = Math.max(element.scrollHeight, element.offsetHeight);

  const canvas = await html2canvas(element, {
    backgroundColor: BACKGROUND_COLOR,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY
  });

  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageHeightPx = Math.floor((pageHeight * canvas.width) / pageWidth);
  const slices = sliceCanvas(canvas, pageHeightPx, avoidBreakRanges);

  slices.forEach((slice, index) => {
    const imgData = slice.toDataURL('image/png');
    const imgHeight = (slice.height * pageWidth) / slice.width;
    if (index > 0) {
      pdf.addPage();
    }
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);
  });

  const filename = `${filenamePrefix}_${formatTimestamp(new Date())}.pdf`;
  pdf.save(filename);
};
