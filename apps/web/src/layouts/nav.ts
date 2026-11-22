import {
  BarChart3,
  Building2,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  SquareKanban,
  Table2,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** Voci della sidebar, nell'ordine previsto dall'architettura dell'informazione. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/pipeline', label: 'Pipeline', icon: Workflow },
  { to: '/boards', label: 'Bacheche', icon: SquareKanban },
  { to: '/opportunities', label: 'Opportunità', icon: Table2 },
  { to: '/companies', label: 'Aziende', icon: Building2 },
  { to: '/tasks', label: 'Attività', icon: ListChecks },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
];

/** Metadati di rotta (titolo della vista attiva, usato da document.title). */
export interface RouteHandle {
  title: string;
  /** Vista a tutta larghezza e altezza (es. Kanban): niente padding né larghezza massima. */
  fullBleed?: boolean;
}
