import {
  BarChart3,
  LayoutDashboard,
  ListChecks,
  SquareKanban,
  Table2,
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
  { to: '/boards', label: 'Bacheche', icon: SquareKanban },
  { to: '/opportunities', label: 'Opportunità', icon: Table2 },
  { to: '/tasks', label: 'Attività', icon: ListChecks },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
];

/** Metadati di rotta (titolo della vista attiva, usato da document.title). */
export interface RouteHandle {
  title: string;
  /** Vista a tutta larghezza e altezza (es. Kanban): niente padding né larghezza massima. */
  fullBleed?: boolean;
}
