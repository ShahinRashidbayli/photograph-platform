import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export const roadmapInterestKey = ['roadmap', 'interest'] as const;

/** The roadmap keys this studio has asked for. Mirrors `RoadmapFeature` on the API. */
export function useRoadmapInterest(enabled = true) {
  return useQuery({
    queryKey: roadmapInterestKey,
    enabled,
    queryFn: async () => {
      const res = await api.get<string[]>('/api/roadmap/interest');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

/**
 * Registers or withdraws interest in one idea.
 *
 * <p>Optimistic, and deliberately so: the answer is a checkbox against a
 * feature that does not exist, so a spinner would be a heavier promise than the
 * action deserves. Both server calls are idempotent, and a failure rolls the
 * list back to whatever the server last said.
 */
export function useToggleRoadmapInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ feature, wanted }: { feature: string; wanted: boolean }) => {
      if (wanted) {
        await api.put(`/api/roadmap/interest/${feature}`);
      } else {
        await api.delete(`/api/roadmap/interest/${feature}`);
      }
    },
    onMutate: async ({ feature, wanted }) => {
      await qc.cancelQueries({ queryKey: roadmapInterestKey });
      const previous = qc.getQueryData<string[]>(roadmapInterestKey) ?? [];
      qc.setQueryData<string[]>(
        roadmapInterestKey,
        wanted ? [...previous, feature] : previous.filter((f) => f !== feature)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(roadmapInterestKey, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: roadmapInterestKey }),
  });
}
