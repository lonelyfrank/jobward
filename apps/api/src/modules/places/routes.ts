import {
  createPlaceInput,
  placeResponse,
  placesResponse,
  updatePlaceInput,
} from '@jobward/schemas';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../../env';
import { parseJsonBody } from '../../lib/validate';
import { idParam } from '../../middleware/workspace';
import { createPlace, deletePlace, listPlaces, updatePlace } from '../../services/places';

/**
 * Posizioni personali dell'utente (D-07), sotto `/me`: appartengono all'identità della sessione,
 * quindi non richiedono `workspaceId` e nessun altro utente può leggerle o modificarle.
 */
export const placeRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const places = await listPlaces(c.get('db'), c.get('user').id);
    return c.json(placesResponse.parse({ places }));
  })
  .post('/', async (c) => {
    const input = await parseJsonBody(c, createPlaceInput);
    const place = await createPlace(c.env.DB, c.get('db'), c.get('user').id, input, Date.now());
    return c.json(placeResponse.parse({ place }), 201);
  })
  .patch('/:id', async (c) => {
    const input = await parseJsonBody(c, updatePlaceInput);
    const place = await updatePlace(
      c.env.DB,
      c.get('db'),
      c.get('user').id,
      idParam(c),
      input,
      Date.now(),
    );
    return c.json(placeResponse.parse({ place }));
  })
  .delete('/:id', async (c) => {
    await parseJsonBody(c, z.object({}).strict());
    await deletePlace(c.env.DB, c.get('db'), c.get('user').id, idParam(c));
    return c.body(null, 204);
  });
