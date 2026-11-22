import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

// Geometria e interpolazione della sidebar di sensei-learning.
const RADIUS = 18;
const HEIGHT = 65;
const TRIGGER_ZONE = 40;

function bulgePath(y: number, radius: number) {
  const cp = HEIGHT * 0.6;
  return `M 0 ${y - HEIGHT} C 0 ${y - HEIGHT + cp}, ${radius} ${y - cp * 0.4}, ${radius} ${y} C ${radius} ${y + cp * 0.4}, 0 ${y + HEIGHT - cp}, 0 ${y + HEIGHT} Z`;
}

/** Il bordo segue la larghezza CSS reale; il cursore muove solo la curva e il pulsante. */
export function SidebarBulge({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const path = pathRef.current;
    const button = buttonRef.current;
    if (!root || !path || !button) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let lastTime = 0;
    let pointer: { x: number; y: number } | null = null;
    let focused = false;
    let transitioning = false;
    let y = root.getBoundingClientRect().height / 2;
    let radius = 0;

    const animate = (time: number) => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      const distance = pointer ? Math.abs(pointer.x - rect.left) : TRIGGER_ZONE;
      const nearby =
        desktop.matches &&
        pointer &&
        pointer.x >= rect.left - 10 &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom &&
        distance < TRIGGER_ZONE;
      const targetRadius = focused ? RADIUS : nearby ? RADIUS * (1 - distance / TRIGGER_ZONE) : 0;
      const targetY = Math.max(
        Math.min(HEIGHT, rect.height / 2),
        Math.min(
          rect.height - Math.min(HEIGHT, rect.height / 2),
          pointer ? pointer.y - rect.top : y,
        ),
      );
      const factor = reducedMotion.matches
        ? 1
        : 1 - Math.pow(0.9, Math.min(time - (lastTime || time - 16.67), 64) / 16.67);
      lastTime = time;
      y += (targetY - y) * factor;
      radius += (targetRadius - radius) * factor;
      if (Math.abs(radius - targetRadius) < 0.01) radius = targetRadius;
      if (Math.abs(y - targetY) < 0.1) y = targetY;
      path.setAttribute('d', bulgePath(y, radius));
      button.style.transform = `translate(${radius * 0.75 - 16}px, ${y - 16}px)`;
      button.style.opacity = String(Math.min(radius / RADIUS, 1));
      button.style.pointerEvents = radius > 0.5 ? 'auto' : 'none';
      if (transitioning || radius !== targetRadius || y !== targetY) schedule();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(animate);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const leave = () => {
      pointer = null;
      schedule();
    };
    const focus = () => {
      focused = button.matches(':focus-visible');
      schedule();
    };
    const blur = () => {
      focused = false;
      schedule();
    };
    const transitionStart = (event: TransitionEvent) => {
      if (event.target === root.parentElement && event.propertyName === 'width') {
        transitioning = true;
        schedule();
      }
    };
    const transitionEnd = (event: TransitionEvent) => {
      if (event.target === root.parentElement && event.propertyName === 'width') {
        transitioning = false;
        schedule();
      }
    };
    window.addEventListener('pointermove', move);
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    window.addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    button.addEventListener('focus', focus);
    button.addEventListener('blur', blur);
    const sidebar = root.parentElement;
    sidebar?.addEventListener('transitionrun', transitionStart);
    sidebar?.addEventListener('transitionend', transitionEnd);
    sidebar?.addEventListener('transitioncancel', transitionEnd);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
      window.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
      button.removeEventListener('focus', focus);
      button.removeEventListener('blur', blur);
      sidebar?.removeEventListener('transitionrun', transitionStart);
      sidebar?.removeEventListener('transitionend', transitionEnd);
      sidebar?.removeEventListener('transitioncancel', transitionEnd);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-y-0 left-full z-40 w-10"
      data-testid="sidebar-bulge"
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
        <path ref={pathRef} d={bulgePath(0, 0)} fill="var(--sidebar)" />
      </svg>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Espandi la barra laterale' : 'Comprimi la barra laterale'}
        aria-expanded={!collapsed}
        className="pointer-events-none absolute top-0 left-0 grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground opacity-0"
      >
        <span className="grid size-[22px] place-items-center rounded-full border border-border-strong bg-surface-muted">
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronLeft aria-hidden="true" className="size-3.5" />
          )}
        </span>
      </button>
    </div>
  );
}
