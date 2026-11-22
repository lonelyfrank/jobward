import {
  companiesResponse,
  companyDetailResponse,
  companyResponse,
  duplicatesResponse,
  type UpdateCompanyInput,
} from '@jobward/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { keys, scoped } from '@/features/boards/api';
import { useWorkspace } from '@/features/workspace/context';
import { apiRequest } from '@/lib/api';

/** Sotto il prefisso delle opportunità: ogni modifica a una scheda le riallinea. */
const companiesKey = (ws: string) => [...keys.opportunities(ws), 'companies'] as const;

export function useCompanies() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: companiesKey(workspace.id),
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, '/companies'), companiesResponse, { signal }),
    select: (d) => d.companies,
  });
}

export function useCompany(id: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: [...companiesKey(workspace.id), id],
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, `/companies/${id}`), companyDetailResponse, { signal }),
  });
}

export function useUpdateCompany(id: string) {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCompanyInput) =>
      apiRequest(scoped(workspace.id, `/companies/${id}`), companyResponse, {
        method: 'PATCH',
        json: input,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: companiesKey(workspace.id) }),
  });
}

/** Possibili duplicati mentre si scrive (attesa di 400 ms, nessuna richiesta sotto i 3 caratteri). */
export function useDuplicates(input: { title: string; company: string; sourceUrl: string }) {
  const { workspace } = useWorkspace();
  const [debounced, setDebounced] = useState(input);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(input), 400);
    return () => window.clearTimeout(timer);
  }, [input.title, input.company, input.sourceUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = debounced.title.trim();
  const params = new URLSearchParams({ title });
  if (debounced.company.trim()) params.set('company', debounced.company.trim());
  if (debounced.sourceUrl.trim()) params.set('sourceUrl', debounced.sourceUrl.trim());
  return useQuery({
    queryKey: [...keys.opportunities(workspace.id), 'duplicates', params.toString()],
    enabled: title.length >= 3,
    queryFn: ({ signal }) =>
      apiRequest(
        scoped(workspace.id, `/opportunities/duplicates?${params.toString()}`),
        duplicatesResponse,
        { signal },
      ),
    select: (d) => d.duplicates,
    staleTime: 10_000,
  });
}
