import { LIMITS, PLACE_KINDS } from '@jobward/shared';
import { z } from 'zod';
import { idSchema, requiredText } from './primitives';

/** Latitudine e longitudine in gradi decimali (WGS84), come inserite o confermate dall'utente. */
export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

/** Posizione personale dell'utente (D-07): riferimento per le distanze della vista Mappa. */
export const placeSchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: z.enum(PLACE_KINDS),
  latitude: z.number(),
  longitude: z.number(),
  position: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Place = z.infer<typeof placeSchema>;

const placeShape = {
  name: requiredText(LIMITS.placeNameMax),
  kind: z.enum(PLACE_KINDS),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
};

export const createPlaceInput = z.object(placeShape).strict();
export type CreatePlaceInput = z.infer<typeof createPlaceInput>;

/** Modifica parziale; le coordinate cambiano sempre insieme (mai una sola delle due). */
export const updatePlaceInput = z
  .object(placeShape)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nessuna modifica indicata')
  .refine((v) => (v.latitude === undefined) === (v.longitude === undefined), {
    message: 'Indica latitudine e longitudine insieme',
    path: ['longitude'],
  });
export type UpdatePlaceInput = z.infer<typeof updatePlaceInput>;

export const placesResponse = z.object({ places: z.array(placeSchema) });
export const placeResponse = z.object({ place: placeSchema });
