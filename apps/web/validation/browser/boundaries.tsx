import React, { useEffect, useState, useSyncExternalStore } from "react";

// Only the standalone gallery uses these adapters. No application auth bypass exists.
export const useUser = () => ({ isLoaded: true, isSignedIn: true, user: { id: "synthetic-alice", externalAccounts: [], createExternalAccount: async () => { throw new Error("External authentication is outside this fixture"); } } });
export const SignedIn = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const SignedOut = () => null;
export const SignInButton = SignedIn;
export const UserButton = () => <span aria-label="Synthetic account">D</span>;
export const usePathname = () => location.pathname;
export const useSearchParams = () => new URLSearchParams(location.search);
export const api = new Proxy({}, { get: (_, group: string) => new Proxy({}, { get: (_, name: string) => `${group}.${name}` }) });
let revision = 0;
const listeners = new Set<() => void>();
function invalidate() { revision++; listeners.forEach(listener => listener()); }
export function useQuery<T = unknown>(query: string, args: object | "skip" = {}) {
  const version = useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision);
  const key = JSON.stringify(args);
  const [result, setResult] = useState<{ key: string; data: T } | undefined>();
  useEffect(() => {
    let active = true;
    if (key !== '"skip"') void fetch("/__fixture/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, args: JSON.parse(key) }) }).then(r => r.json()).then(data => { if (active) setResult({ key, data }); });
    return () => { active = false; };
  }, [query, key, version]);
  return key === '"skip"' ? undefined : result?.key === key ? result.data : undefined;
}
export function usePaginatedQuery(query: string, args: object | "skip", _options: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const result = useQuery<unknown[]>(query, args);
  return { results: result ?? [], status: result ? "Exhausted" : "LoadingFirstPage", loadMore() {} };
}
export const useMutation = (name: string) => async (args: unknown) => { const result = await action("mutation", { name, args }); invalidate(); return result; };
export const analytics = { capture() {}, captureException() {}, has_opted_out_capturing: () => true };
export const Link = ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>;
export const Image = ({ fill, unoptimized: _unoptimized, style, ...props }: React.ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean }) => <img alt={props.alt ?? ""} style={{ ...(fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}), ...style }} {...props} />; // eslint-disable-line @next/next/no-img-element, @typescript-eslint/no-unused-vars

async function action(name: string, input?: unknown) {
  const response = await fetch(`/__fixture/action/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input ?? {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Synthetic failure");
  return data;
}
export const getUploadUrlAction = () => action("upload-url");
export const routeCaptureAction = (input: unknown) => action("route", input);
export const recordDailyFitCheckAction = (input: unknown) => action("daily-fit", input);
export const createWardrobeItemAction = (input: unknown) => action("create-piece", input);
export const checkCompatibilityAction = (input: unknown) => action("try-on", input);
export const saveInspirationAction = (input: unknown) => action("save-inspiration", input);
export const enrichInspirationAction = (input: unknown) => action("enrich-inspiration", input);
export const deleteWardrobeItemAction = async (input: unknown) => { const result = await action("delete-piece", input); invalidate(); return result; };
export const refreshStyleBioAction = async () => ({ updated: false });
export const updateProfileBioAction = async (input: unknown) => { const result = await action("update-bio", input); invalidate(); return result; };
