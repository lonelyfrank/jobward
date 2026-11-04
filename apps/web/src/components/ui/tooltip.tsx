import { Tooltip as Tip } from 'radix-ui';
import type { ReactNode } from 'react';

export const TooltipProvider = Tip.Provider;

/** Suggerimento visibile anche al focus da tastiera. Il contenuto non è l'unico modo di capire l'azione. */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <Tip.Root delayDuration={250}>
      <Tip.Trigger asChild>{children}</Tip.Trigger>
      <Tip.Portal>
        <Tip.Content
          side="right"
          sideOffset={8}
          className="z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md"
        >
          {content}
        </Tip.Content>
      </Tip.Portal>
    </Tip.Root>
  );
}
