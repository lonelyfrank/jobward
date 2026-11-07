import { derivePipelineStatus, type PipelineState } from '@jobward/shared';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS } from './presentation';

export function PipelineStatusBadge({ state }: { state: PipelineState }) {
  const status = derivePipelineStatus(state);
  return (
    <Badge
      tone={
        status === 'rejected'
          ? 'danger'
          : status === 'archived'
            ? 'warning'
            : status === 'saved'
              ? 'neutral'
              : 'primary'
      }
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
