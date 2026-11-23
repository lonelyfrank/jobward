import {
  placeResponse,
  placesResponse,
  type CreatePlaceInput,
  type UpdatePlaceInput,
} from '@jobward/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

/** Posizioni personali (D-07): appartengono all'utente, non al workspace (`/me/places`). */
const placesKey = (userId: string) => ['places', userId] as const;

export function usePlaces() {
  const { user } = useWorkspace();
  return useQuery({
    queryKey: placesKey(user.id),
    queryFn: ({ signal }) => apiRequest('/me/places', placesResponse, { signal }),
    select: (d) => d.places,
  });
}

export function usePlaceMutations() {
  const { user } = useWorkspace();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: placesKey(user.id) });
  const create = useMutation({
    mutationFn: (input: CreatePlaceInput) =>
      apiRequest('/me/places', placeResponse, { method: 'POST', json: input }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlaceInput }) =>
      apiRequest(`/me/places/${id}`, placeResponse, { method: 'PATCH', json: input }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/me/places/${id}`, z.unknown(), { method: 'DELETE', json: {} }),
    onSuccess: refresh,
  });
  return { create, update, remove };
}
