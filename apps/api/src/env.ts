import type { Database } from '@jobward/database';

/** Binding e variabili del Worker. Nessun segreto transita dal frontend. */
export interface Bindings {
  DB: D1Database;
  /** Asset statici del frontend (assente nei test). */
  ASSETS?: Fetcher;
  ENVIRONMENT: 'development' | 'production';
  /** `access` = Cloudflare Access (produzione). `dev` = identità locale fittizia. */
  AUTH_MODE: 'access' | 'dev';
  /** Unico account ammesso in modalità `access` (accesso privato del proprietario). */
  OWNER_EMAIL?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_USER_EMAIL?: string;
  /** Identità del profilo dimostrativo (solo `AUTH_MODE=dev`): dati separati da quelli reali. */
  DEMO_USER_EMAIL?: string;
  /** Origine aggiuntiva ammessa per le richieste che modificano dati (es. Vite in dev). */
  APP_ORIGIN?: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export type DataProfile = 'real' | 'demo';

export interface Variables {
  requestId: string;
  db: Database;
  user: AuthUser;
  /**
   * Profilo dati della richiesta. `demo` esiste solo in sviluppo locale: è un'identità distinta
   * (`DEMO_USER_EMAIL`), quindi i suoi dati sono isolati da quelli reali come quelli di un altro utente.
   */
  profile: DataProfile;
  /** Impostato da `workspaceScope`: workspace già verificato per l'utente corrente. */
  workspaceId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
