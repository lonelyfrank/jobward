/** Codici d'errore stabili dell'API. Il client si basa sul codice, mai sul messaggio. */
export const API_ERROR_CODES = [
  'validation_error',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'payload_too_large',
  'unsupported_media_type',
  'csrf_rejected',
  'rate_limited',
  'auth_misconfigured',
  'internal_error',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Identificativo di correlazione, presente anche nell'header `x-request-id`. */
    requestId: string;
    /** Dettagli di validazione per campo, quando applicabili. */
    issues?: { path: string; message: string }[];
  };
}
