import { BOARD_BACKGROUND_IMAGES, type BoardBackgroundImage } from '@jobward/schemas';
import type { CSSProperties } from 'react';

export const BOARD_BACKGROUNDS: Record<BoardBackgroundImage, { label: string; asset: string }> = {
  'golden-coast': { label: 'Costa al tramonto', asset: 'costa-dorata-tramonto' },
  alps: { label: 'Alba in montagna', asset: 'alba-montagna-fiori-selvatici' },
  'misty-fjord': { label: 'Fiordo', asset: 'fiordo-montano' },
  'misty-forest': { label: 'Foresta nella nebbia', asset: 'foresta-nebbia' },
  'sunny-meadow': { label: 'Prato verde', asset: 'prato-verde' },
  dunes: { label: 'Dune dorate', asset: 'dune-dorate' },
  ocean: { label: 'Costa mediterranea', asset: 'costa-mediterranea' },
  lake: { label: 'Lago alpino', asset: 'lago-alpino' },
};

export function isBoardBackgroundImage(value: unknown): value is BoardBackgroundImage {
  return BOARD_BACKGROUND_IMAGES.some((id) => id === value);
}

/** Solo file del catalogo locale: il valore salvato non viene mai usato come URL. */
export function boardBackgroundStyle(value: unknown, thumbnail = false): CSSProperties | undefined {
  if (!isBoardBackgroundImage(value)) return undefined;
  const source = `/backgrounds/${BOARD_BACKGROUNDS[value].asset}${thumbnail ? '-thumb' : ''}.webp`;
  return {
    backgroundImage: `linear-gradient(var(--board-image-overlay), var(--board-image-overlay)), url("${source}")`,
  };
}
