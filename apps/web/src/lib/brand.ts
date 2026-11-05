/**
 * Identità testuale del prodotto: unico punto da cui l'interfaccia legge il nome.
 *
 * Il marchio grafico (logo, favicon) NON è definito qui: vive in `components/brand/logo.tsx` e in
 * `public/favicon.svg`, ed è un segnaposto da sostituire quando la brand identity di Jobward sarà
 * pronta. Gli identificatori tecnici persistenti (pacchetti `@jobward/*`, nomi Worker e D1,
 * identità di sviluppo) mantengono il nome storico: vedi ADR-0013.
 */
export const BRAND = {
  name: 'Jobward',
  /** Descrizione per i metadati e per l'introduzione. */
  description: 'il tuo spazio per organizzare la ricerca del lavoro.',
} as const;

/** Titolo del documento per una vista: «Bacheche · Jobward». */
export const documentTitle = (view?: string): string =>
  view ? `${view} · ${BRAND.name}` : BRAND.name;
