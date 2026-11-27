import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function roadmapInterestKey() {
  return ['roadmap', 'interest'] as const;
}

/** The roadmap keys this studio has asked for. Mirrors `RoadmapFeature` on the API. */
export function useRoadmapInterest(enabled = true) {
  return useQuery({
    queryKey: roadmapInterestKey(),
    enabled,
    queryFn: async () => {
      const res = await api.get<string[]>('/api/roadmap/interest');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/**
 * Toggles interest in one idea: returns `toggle(feature)`.
 *
 * <p>Optimistic, and deliberately so: the answer is a checkbox against a
 * feature that does not exist, so a spinner would be a heavier promise than the
 * action deserves. Both server calls are idempotent.
 *
 * <p>Built to survive a double click, which used to lose the second click:
 * - The direction is read from the cache at click time, not from the rendered
 *   checkbox. A controlled checkbox still shows the old state until React
 *   re-renders, so the second click asked to register again.
 * - The cache flips before the first `await`, so the second click already sees
 *   the first one's answer.
 * - The calls share a `scope`, so they reach the server in click order: a
 *   DELETE overtaking its PUT would leave the vote stored but unticked.
 * - A failure undoes only its own feature's change, not a snapshot that a
 *   later click has already moved on from.
 */
export function useToggleRoadmapInterest() {
  const qc = useQueryClient();
  const { mutate } = useMutation({
    scope: { id: 'roadmap-interest' },
    mutationFn: async ({ feature, wanted }: { feature: string; wanted: boolean }) => {
      if (wanted) {
        await api.put(`/api/roadmap/interest/${feature}`);
      } else {
        await api.delete(`/api/roadmap/interest/${feature}`);
      }
    },
    onMutate: async ({ feature, wanted }) => {
      setInterest(qc, feature, wanted);
      await qc.cancelQueries({ queryKey: roadmapInterestKey() });
    },
    onError: (_err, { feature, wanted }) => setInterest(qc, feature, !wanted),
    onSettled: () => qc.invalidateQueries({ queryKey: roadmapInterestKey() }),
  });

  return useCallback(
    (feature: string) => {
      const current = qc.getQueryData<string[]>(roadmapInterestKey()) ?? [];
      mutate({ feature, wanted: !current.includes(feature) });
    },
    [qc, mutate]
  );
}

function setInterest(qc: QueryClient, feature: string, wanted: boolean) {
  qc.setQueryData<string[]>(roadmapInterestKey(), (old = []) => {
    const without = old.filter((f) => f !== feature);
    return wanted ? [...without, feature] : without;
  });
}
