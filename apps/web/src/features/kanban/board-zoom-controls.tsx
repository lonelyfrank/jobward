import { ChevronRight, Scan, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

export function BoardZoomControls({
  canvasRef,
  zoom,
  fitting,
  canZoomOut,
  canZoomIn,
  disabled,
  onZoomOut,
  onZoomIn,
  onReset,
  onFit,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  fitting: boolean;
  canZoomOut: boolean;
  canZoomIn: boolean;
  disabled: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
  onFit: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [touchOpen, setTouchOpen] = useState(false);
  const [overlapping, setOverlapping] = useState(false);
  const expanded = hovered || keyboardFocus || touchOpen;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const button = triggerRef.current?.getBoundingClientRect();
      if (!button) return;
      const viewport = canvas.getBoundingClientRect();
      setOverlapping(
        [...canvas.querySelectorAll('[data-column-id]')].some((column) => {
          const box = column.getBoundingClientRect();
          return (
            Math.max(box.left, viewport.left) < button.right &&
            Math.min(box.right, viewport.right) > button.left &&
            Math.max(box.top, viewport.top) < button.bottom &&
            Math.min(box.bottom, viewport.bottom) > button.top
          );
        }),
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    const observeColumns = () => {
      canvas.querySelectorAll('[data-column-id]').forEach((column) => resize.observe(column));
      schedule();
    };
    resize.observe(canvas);
    if (canvas.parentElement) resize.observe(canvas.parentElement);
    const mutation = new MutationObserver(observeColumns);
    mutation.observe(canvas, { childList: true, subtree: true });
    canvas.addEventListener('scroll', schedule, true);
    observeColumns();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      canvas.removeEventListener('scroll', schedule, true);
      cancelAnimationFrame(frame);
    };
  }, [canvasRef]);

  useEffect(() => {
    if (!touchOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (rootRef.current && !event.composedPath().includes(rootRef.current)) setTouchOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    return () => document.removeEventListener('pointerdown', closeOutside, true);
  }, [touchOpen]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Zoom della bacheca"
      data-expanded={expanded}
      data-overlapping={overlapping}
      className={cn(
        'absolute right-4 bottom-4 z-20 flex items-center rounded-full bg-surface p-1 shadow-md transition-opacity duration-200',
        overlapping && !expanded ? 'opacity-60' : 'opacity-100',
      )}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true);
      }}
      onPointerLeave={() => {
        if (!keyboardFocus && !touchOpen && panelRef.current?.contains(document.activeElement)) {
          triggerRef.current?.focus({ preventScroll: true });
        }
        setHovered(false);
      }}
      onFocusCapture={(event) => {
        setKeyboardFocus(event.target.matches(':focus-visible'));
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocus(false);
      }}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        triggerRef.current?.focus({ preventScroll: true });
        setKeyboardFocus(false);
        setHovered(false);
        setTouchOpen(false);
      }}
    >
      <div
        id={panelId}
        ref={panelRef}
        inert={!expanded}
        aria-hidden={!expanded}
        className={cn(
          'overflow-hidden transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none',
          expanded ? 'max-w-60 translate-x-0 opacity-100' : 'max-w-0 translate-x-2 opacity-0',
        )}
      >
        <div className="flex w-max items-center gap-0.5 pr-1">
          <Tooltip content="Riduci lo zoom" side="top">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Riduci lo zoom"
              disabled={disabled || !canZoomOut}
              onClick={onZoomOut}
            >
              <ZoomOut aria-hidden="true" />
            </Button>
          </Tooltip>
          <Tooltip content="Ripristina lo zoom al 100%" side="top">
            <Button
              variant="ghost"
              className="h-10 min-w-14 rounded-full px-2 text-xs tabular-nums max-md:min-h-11"
              disabled={disabled}
              onClick={onReset}
            >
              <span role="status" aria-live="polite" aria-atomic="true">
                {Math.round(zoom * 100)}%
              </span>
              <span className="sr-only"> — Ripristina lo zoom al 100%</span>
            </Button>
          </Tooltip>
          <Tooltip content="Aumenta lo zoom" side="top">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Aumenta lo zoom"
              disabled={disabled || !canZoomIn}
              onClick={onZoomIn}
            >
              <ZoomIn aria-hidden="true" />
            </Button>
          </Tooltip>
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
          <Tooltip content="Mostra tutte le colonne" side="top">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Mostra tutte le colonne"
              aria-pressed={fitting}
              disabled={disabled}
              onClick={onFit}
            >
              <Scan aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="rounded-full"
        aria-label="Controlli zoom e vista"
        aria-expanded={expanded}
        aria-controls={panelId}
        disabled={disabled}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch' || event.pointerType === 'pen') {
            setTouchOpen((current) => !current);
          }
        }}
        onClick={(event) => {
          if (event.detail === 0) setKeyboardFocus(true);
        }}
      >
        {expanded ? <ChevronRight aria-hidden="true" /> : <ZoomIn aria-hidden="true" />}
      </Button>
    </div>
  );
}
