import logo from '../../../../jobward.png';
import logoOnDark from '../../../../jobward-light.png';

/** Identità visibile centralizzata. Gli asset originali del proprietario restano integri: `logo` per il tema chiaro, `logoOnDark` (trasparente, scritta chiara) per il tema scuro. */
export const BRAND = {
  name: 'Jobward',
  /** Descrizione per i metadati e per l'introduzione. */
  description: 'il tuo spazio per organizzare la ricerca del lavoro.',
  assets: { logo, logoOnDark },
} as const;

/** Titolo del documento per una vista: «Bacheche · Jobward». */
export const documentTitle = (view?: string): string =>
  view ? `${view} · ${BRAND.name}` : BRAND.name;
