import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStore } from "@/lib/anemia/storage";
import type { StoreShape } from "@/lib/anemia/types";

export const STORE_QUERY_KEY = ["anemia-store"] as const;

const EMPTY_STORE: StoreShape = { patients: [], tests: {} };

export function useStore(): StoreShape & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: STORE_QUERY_KEY,
    queryFn: getStore,
  });
  return { ...(data ?? EMPTY_STORE), isLoading };
}

// Call after any add/update/delete against patients or test_entries so every
// component reading useStore() re-fetches the latest data from Supabase.
export function useInvalidateStore() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: STORE_QUERY_KEY });
}
