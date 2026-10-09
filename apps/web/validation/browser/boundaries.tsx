import React, { useEffect, useState, useSyncExternalStore } from "react";

// Only the standalone gallery uses these adapters. No application auth bypass exists.
export const useUser = () => ({ isLoaded: true, isSignedIn: true, user: { id: "synthetic-alice", externalAccounts: [], createExternalAccount: async () => { throw new Error("External authentication is outside this fixture"); } } });
type FixtureAuth = { isLoaded:boolean; isSignedIn:boolean; userId:string|null; backendPending?:boolean; backendUnavailable?:boolean };
declare global { interface Window { fixtureAuth?:FixtureAuth } }
const defaultAuth:FixtureAuth = {isLoaded:true,isSignedIn:true,userId:"synthetic-alice"};
const readAuth = () => window.fixtureAuth ?? defaultAuth;
export const useAuth = () => useSyncExternalStore(listener => { window.addEventListener("fixture-auth",listener); return () => window.removeEventListener("fixture-auth",listener); }, readAuth);
export const useConvexAuth = () => { const auth = useAuth(); return {isLoading:!auth.isLoaded || Boolean(auth.backendPending),isAuthenticated:auth.isLoaded && auth.isSignedIn && !auth.backendPending && !auth.backendUnavailable}; };
export const SignedIn = ({ children }: { children: React.ReactNode }) => { const auth=useAuth(); return auth.isLoaded && auth.isSignedIn ? <>{children}</> : null; };
export const SignedOut = ({ children }: { children: React.ReactNode }) => { const auth=useAuth(); return auth.isLoaded && !auth.isSignedIn ? <>{children}</> : null; };
export const SignInButton = ({children}:{children:React.ReactNode}) => <>{children}</>;
export const SignUpButton = SignInButton;
export const analyzeGuestFitCheckAction = async () => ({ kind: "error" as const, message: "Synthetic analysis unavailable. Retry or sign in." });
export const UserButton = Object.assign(() => <span aria-label="Synthetic account">D</span>, { MenuItems: () => null, Link: () => null });
export const usePathname = () => useSyncExternalStore(listener => { window.addEventListener("fixture-navigation",listener); return () => window.removeEventListener("fixture-navigation",listener); }, () => location.pathname);
export const useSearchParams = () => new URLSearchParams(useSyncExternalStore(listener => {window.addEventListener("fixture-navigation",listener);window.addEventListener("popstate",listener);return ()=>{window.removeEventListener("fixture-navigation",listener);window.removeEventListener("popstate",listener);};},()=>location.search));
export const api = new Proxy({}, { get: (_, group: string) => new Proxy({}, { get: (_, name: string) => `${group}.${name}` }) });
let revision = 0;
const listeners = new Set<() => void>();
function invalidate() { revision++; listeners.forEach(listener => listener()); }
window.addEventListener("fixture-refresh", invalidate);
export function useQuery<T = unknown>(query: string, args: object | "skip" = {}) {
  const version = useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => revision);
  const subject = useAuth().userId;
  const key = JSON.stringify(args);
  const [result, setResult] = useState<{ key: string; data?: T; error?:Error } | undefined>();
  useEffect(() => {
    let active = true;
    if (key !== '"skip"') void fetch("/__fixture/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, subject, args: JSON.parse(key) }) }).then(async r => { if (!r.ok) throw new Error("Synthetic query unavailable"); return r.json(); }).then(data => { if (active) setResult({ key, data }); }).catch(error => { if (active) setResult({key,error}); });
    return () => { active = false; };
  }, [query, key, subject, version]);
  if (result?.key === key && result.error) throw result.error;
  return key === '"skip"' ? undefined : result?.key === key ? result.data : undefined;
}
export function usePaginatedQuery(query: string, args: object | "skip", _options: unknown) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const result = useQuery<unknown[]>(query, args);
  const [more,setMore]=useState(false);
  const partial=query==='fitChecks.pageFitChecks' && new URLSearchParams(location.search).get('case')==='diary-partial' && !more;
  return { results: result ?? [], status: result ? partial ? "CanLoadMore" : "Exhausted" : "LoadingFirstPage", loadMore() {setMore(true);} };
}
export const useMutation = (name: string) => async (args: unknown) => { const result = await action("mutation", { name, args }); invalidate(); return result; };
export const analytics = { capture() {}, captureException() {}, has_opted_out_capturing: () => true };
export const Link = ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} onClick={event => {
  props.onClick?.(event);
  if (!event.defaultPrevented && href?.startsWith('/fits?view=')) {event.preventDefault();const next=new URL(href,location.href);new URLSearchParams(location.search).forEach((value,key)=>{if(key!=='view')next.searchParams.set(key,value);});history.pushState({},'',next);window.dispatchEvent(new Event('fixture-navigation'));return;}
  if (!event.defaultPrevented && location.search.includes("scenario=home-continuity") && (href === "/" || href === "/fits")) { event.preventDefault(); history.pushState({}, "", `${href}?scenario=home-continuity`); window.dispatchEvent(new Event("fixture-navigation")); }
}}>{children}</a>;
export const Image = ({ fill, unoptimized: _unoptimized, priority: _priority, style, ...props }: React.ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean; priority?: boolean }) => <img alt={props.alt ?? ""} style={{ ...(fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : {}), ...style }} {...props} />; // eslint-disable-line @next/next/no-img-element, @typescript-eslint/no-unused-vars

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
export const completeGuestOnboardingAction = (input: unknown) => action("complete-onboarding", input);
export const checkCompatibilityAction = (input: unknown) => action("try-on", input);
export const saveInspirationAction = (input: unknown) => action("save-inspiration", input);
export const enrichInspirationAction = (input: unknown) => action("enrich-inspiration", input);
export const deleteWardrobeItemAction = async (input: unknown) => { const result = await action("delete-piece", input); invalidate(); return result; };
export const refreshStyleBioAction = async () => ({ updated: false });
export const updateProfileBioAction = async (input: unknown) => { const result = await action("update-bio", input); invalidate(); return result; };
