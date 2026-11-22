import { workspaceExport } from '@jobward/schemas';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNotify } from '@/components/ui/notices';
import { scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

/** Scarica l'esportazione completa del workspace in JSON (formato versionato `jobward-export`). */
export function ExportData() {
  const { workspace } = useWorkspace();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const data = await apiRequest(scoped(workspace.id, '/export'), workspaceExport);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jobward-export-${new Date(data.exportedAt).toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      const count = data.collections['opportunities']?.length ?? 0;
      notify('success', `Esportazione pronta: ${count} opportunità e tutti i dati collegati.`);
    } catch {
      notify('error', 'Esportazione non riuscita: riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" onClick={() => void download()} disabled={busy}>
      <Download aria-hidden="true" className="size-4" />
      {busy ? 'Preparo il file…' : 'Esporta tutti i dati (JSON)'}
    </Button>
  );
}
