import { useEffect, useRef, useState } from 'react';
import { readStorage, writeStorage } from '@/lib/storage';

const LEVELS = [0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5];
type Preference = number | 'fit';

export function useBoardZoom(boardId: string, columnCount: number) {
  const key = `jobward-board-zoom:${boardId}`;
  const [preference, setPreference] = useState<Preference>(() => {
    const saved = readStorage(key);
    if (saved === 'fit') return saved;
    const value = Number(saved);
    return LEVELS.includes(value) ? value : 1;
  });
  const [fitZoom, setFitZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    writeStorage(key, String(preference));
  }, [key, preference]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;
    const measure = () => {
      const columns = [...canvas.querySelectorAll<HTMLElement>('[data-column-id]')];
      if (columns.length === 0 || viewport.clientWidth === 0) return;
      const style = getComputedStyle(canvas);
      const width =
        columns.reduce((sum, column) => sum + column.offsetWidth, 0) +
        Math.max(0, columns.length - 1) * (parseFloat(style.columnGap) || 0) +
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0);
      if (width > 0) setFitZoom(Math.max(0.01, Math.min(1, (viewport.clientWidth - 2) / width)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [columnCount]);

  const zoom = columnCount === 0 ? 1 : preference === 'fit' ? fitZoom : preference;
  const zoomOut = () =>
    setPreference(LEVELS.findLast((level) => level < zoom - 0.001) ?? LEVELS[0]!);
  const zoomIn = () =>
    setPreference(LEVELS.find((level) => level > zoom + 0.001) ?? LEVELS.at(-1)!);
  const fit = () => {
    setPreference('fit');
    if (canvasRef.current) canvasRef.current.scrollLeft = 0;
  };

  return {
    zoom,
    viewportRef,
    canvasRef,
    zoomOut,
    zoomIn,
    fit,
    reset: () => setPreference(1),
    fitting: preference === 'fit',
    canZoomOut: zoom > LEVELS[0]! + 0.001,
    canZoomIn: zoom < LEVELS.at(-1)! - 0.001,
  };
}
