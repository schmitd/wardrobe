import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";

import { loadBootstrap } from "@/api";

export function useWardrobe() {
  const { getToken, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  return useQuery({
    queryKey: ["mobile-bootstrap"],
    queryFn: () => loadBootstrap(getToken),
    enabled: Boolean(isSignedIn),
  });
}
