import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadBootstrap, loadMobilePage } from "@/api";
import type { Collection, FitCheck, MobileBootstrap, WardrobeItem } from "@/types";

export function useWardrobe() {
  const { getToken, isSignedIn, userId } = useAuth({ treatPendingAsSignedOut: false });
  const client = useQueryClient();
  const key = ["mobile-bootstrap", userId];
  const query = useQuery({ queryKey: key, queryFn: () => loadBootstrap(getToken), enabled: Boolean(isSignedIn) });
  const more = useMutation({ mutationFn: async (view: "closet" | "plans" | "fits") => {
    const cursor = view === "closet" ? query.data?.closetCursor : view === "plans" ? query.data?.plansCursor : query.data?.fitsCursor;
    if (!cursor) return;
    if (view === "closet") {
      const page = await loadMobilePage<WardrobeItem>(getToken, view, cursor);
      client.setQueryData<MobileBootstrap>(key, data => data ? { ...data, closetCursor: page.isDone ? null : page.continueCursor, items: [...new Map([...data.items, ...page.page].map(item => [item.id, item])).values()] } : data);
    } else if (view === "fits") {
      const page = await loadMobilePage<FitCheck>(getToken, view, cursor);
      client.setQueryData<MobileBootstrap>(key, data => data ? { ...data, fitsCursor: page.isDone ? null : page.continueCursor, fitChecks: [...new Map([...data.fitChecks, ...page.page].map(item => [item.id, item])).values()] } : data);
    } else {
      const page = await loadMobilePage<Collection>(getToken, view, cursor);
      client.setQueryData<MobileBootstrap>(key, data => data ? { ...data, plansCursor: page.isDone ? null : page.continueCursor, wardrobes: [...new Map([...data.wardrobes, ...page.page].map(item => [item._id, item])).values()] } : data);
    }
  } });
  return { ...query, loadMore: more.mutate, loadingMore: more.isPending, moreError: more.error };
}
