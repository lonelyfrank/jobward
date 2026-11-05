import logo from '../../../../jobward.png';
import logoOnWhite from '../../../../jobward-white.png';

/** Identità visibile centralizzata. Gli asset originali del proprietario restano integri. */
export const BRAND = {
  name: 'Jobward',
  /** Descrizione per i metadati e per l'introduzione. */
  description: 'il tuo spazio per organizzare la ricerca del lavoro.',
  assets: { logo, logoOnWhite },
} as const;

/** Titolo del documento per una vista: «Bacheche · Jobward». */
export const documentTitle = (view?: string): string =>
  view ? `${view} · ${BRAND.name}` : BRAND.name;
