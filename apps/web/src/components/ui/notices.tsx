import { CircleAlert, CircleCheck, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';

type Tone = 'success' | 'error';
interface NoticeAction {
  label: string;
  onClick: () => void;
}
interface Notice {
  id: number;
  tone: Tone;
  message: string;
  action?: NoticeAction | undefined;
}

interface NoticeApi {
  notify: (tone: Tone, message: string, action?: NoticeAction) => void;
}

const NoticeContext = createContext<NoticeApi | null>(null);

/**
 * Avvisi transitori (esito di un'azione, errore di una richiesta in background).
 * Gli errori restano finché non vengono chiusi e sono annunciati con `role="alert"`;
 * i successi spariscono da soli e sono annunciati con `role="status"` (educati).
 */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setNotices((current) => current.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (tone: Tone, message: string, action?: NoticeAction) => {
      const id = nextId.current++;
      setNotices((current) => [...current.slice(-3), { id, tone, message, action }]);
      // Con un'azione (es. "Annulla") il messaggio resta più a lungo.
      if (tone === 'success') window.setTimeout(() => dismiss(id), action ? 8000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <NoticeContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4">
        {notices.map((notice) => (
          <div
            key={notice.id}
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg border border-border bg-surface py-2.5 pr-2 pl-3.5 text-sm shadow-md"
          >
            {notice.tone === 'error' ? (
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : (
              <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            )}
            <p className="flex-1 py-0.5">{notice.message}</p>
            {notice.action ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  notice.action?.onClick();
                  dismiss(notice.id);
                }}
              >
                {notice.action.label}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Chiudi avviso"
              className="-my-1 size-8 max-md:size-11"
              onClick={() => dismiss(notice.id)}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  );
}

export function useNotify(): NoticeApi['notify'] {
  const api = useContext(NoticeContext);
  if (!api) throw new Error('useNotify va usato dentro NoticeProvider');
  return api.notify;
}
