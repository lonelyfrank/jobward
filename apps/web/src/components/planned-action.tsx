import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Azione non ancora disponibile. È disabilitata e dichiara la milestone: non finge di
 * funzionare. Il motivo è raggiungibile anche dagli screen reader.
 */
export function PlannedAction({
  id,
  milestone,
  children,
  variant = 'secondary',
}: {
  id: string;
  milestone: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  return (
    <>
      <Button
        variant={variant}
        disabled
        aria-describedby={id}
        title={`Disponibile in ${milestone}`}
      >
        {children}
      </Button>
      <span id={id} className="sr-only">
        Non ancora disponibile: arriva in {milestone}.
      </span>
    </>
  );
}
