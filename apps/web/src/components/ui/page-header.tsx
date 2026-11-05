import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div>
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2.5 text-[15px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
