"use client";

import Link from "next/link";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import posthog from "posthog-js";
import { Button } from "./ui/button";

class DataBoundary extends Component<{ children: ReactNode }, { failed: boolean; retry: number }> {
  state = { failed: false, retry: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="space-y-3 rounded-lg border border-[#241426] bg-[#fbf9fa] p-4" aria-label="Data unavailable">
      <p role="alert">Your removed data could not load. Please try again.</p>
      <Button variant="outline" className="min-h-11" onClick={() => this.setState(({ retry }) => ({ failed: false, retry: retry + 1 }))}>Retry data</Button>
    </section>;
    // Remount pagination hooks: Convex assigns new pagination IDs and retries subscriptions.
    return <div className="space-y-6" key={this.state.retry}>{this.props.children}</div>;
  }
}

export default function DataManagement() {
  const clerk = useAuth();
  const convex = useConvexAuth();
  const owner = `${clerk.userId ?? ""}:${clerk.sessionId ?? ""}`;
  const confirmed = clerk.isLoaded && clerk.isSignedIn && clerk.userId && !convex.isLoading && convex.isAuthenticated;
  return <main className="ph-no-capture mx-auto w-full max-w-3xl space-y-6 px-4 py-6 pb-28 text-[#241426]">
    <Link href="/#collections" className="inline-flex min-h-11 items-center underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#241426]">Back to wardrobe</Link>
    <header className="space-y-2"><h1 className="text-3xl font-bold">Data management</h1><p>Restore removed collections and inspiration to your wardrobe.</p></header>
    {!clerk.isLoaded || (clerk.isSignedIn && convex.isLoading) ? <p role="status">Connecting to your data…</p> : !clerk.isSignedIn ? <p>Sign in to manage your data. <Link className="underline" href="/sign-in">Sign in</Link></p> : !confirmed ? <section className="space-y-3"><p role="alert">Your data connection is unavailable.</p><Button variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Retry connection</Button></section> : <DataBoundary key={owner}><PrivateData key={owner} /></DataBoundary>}
  </main>;
}

type Collection = { _id: Id<"wardrobes">; name: string };
function PrivateData() {
  const active = usePaginatedQuery(api.wardrobe.pageCollections, {}, { initialNumItems: 12 });
  const archived = usePaginatedQuery(api.wardrobe.pageCollections, { archived: true }, { initialNumItems: 12 });
  const [selectedId, setSelectedId] = useState<Id<"wardrobes"> | null>(null);
  const [notice, setNotice] = useState<{ text: string } | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const current = useRef(true);
  useEffect(() => { current.current = true; return () => { current.current = false; }; }, []);
  useEffect(() => { if (notice) noticeRef.current?.focus(); }, [notice]);
  const restored = (text: string) => { if (!current.current) return false; setNotice({ text }); return true; };
  const collections = [...active.results, ...archived.results];
  const selected = collections.find(collection => collection._id === selectedId);
  const collectionRemoved = archived.results.some(collection => collection._id === selectedId);
  const loadingCollections = active.status === "LoadingFirstPage" || archived.status === "LoadingFirstPage";
  return <>
    {notice && <p ref={noticeRef} tabIndex={-1} role="status" className="rounded-lg border border-[#241426] bg-[#e8f3ec] p-3 text-[#241426] focus:outline-2 focus:outline-offset-2 focus:outline-[#241426]">{notice.text}</p>}
    <section className="space-y-3" aria-labelledby="removed-collections-title">
      <h2 id="removed-collections-title" className="text-xl font-bold">Removed collections</h2>
      <p className="text-sm">Your pieces and photos stay in your wardrobe when a collection is removed.</p>
      {archived.status === "LoadingFirstPage" ? <p role="status">Loading removed collections…</p> : archived.results.map(collection => <RestoreCollection key={collection._id} collection={collection} onRestored={() => restored("Collection restored. It is available in your wardrobe.")} />)}
      {archived.status === "Exhausted" && !archived.results.length && <p>No removed collections.</p>}
      {archived.status === "CanLoadMore" && <Button variant="outline" className="min-h-11" onClick={() => archived.loadMore(12)}>More removed collections</Button>}
      {archived.status === "LoadingMore" && <p role="status">Loading more removed collections…</p>}
    </section>
    <section className="space-y-3" aria-labelledby="removed-inspiration-title">
      <h2 id="removed-inspiration-title" className="text-xl font-bold">Removed inspiration</h2>
      <p className="text-sm">Choose a collection to find its removed inspiration.</p>
      {loadingCollections && <p role="status">Loading collections…</p>}
      <label className="block space-y-2">Collection
        <select data-private className="min-h-11 w-full rounded-lg border border-[#241426] bg-[#fbf9fa] px-3 text-[#241426] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#241426]" value={selectedId ?? ""} onChange={event => { setSelectedId(event.target.value ? event.target.value as Id<"wardrobes"> : null); setNotice(null); }}>
          <option value="">Choose a collection</option>
          {active.results.map(collection => <option key={collection._id} value={collection._id}>{collection.name}</option>)}
          {archived.results.map(collection => <option key={collection._id} value={collection._id}>{collection.name} (removed)</option>)}
        </select>
      </label>
      {!loadingCollections && !collections.length && <p>No collections to review.</p>}
      {active.status === "CanLoadMore" && <Button variant="outline" className="min-h-11" onClick={() => active.loadMore(12)}>More active collections</Button>}
      {active.status === "LoadingMore" && <p role="status">Loading more collections…</p>}
      {selected && <RemovedInspiration key={selected._id} collection={selected} collectionRemoved={collectionRemoved} onRestored={() => restored("Inspiration restored. It is available in its collection.")} />}
    </section>
  </>;
}

function RestoreCollection({ collection, onRestored }: { collection: Collection; onRestored: () => boolean }) {
  const restore = useMutation(api.wardrobe.archiveCollection);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(true);
  const inFlight = useRef(false);
  const restoreButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (error && !busy) restoreButton.current?.focus(); }, [error, busy]);
  useEffect(() => { current.current = true; return () => { current.current = false; }; }, []);
  const run = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await restore({ wardrobeId: collection._id, archived: false }); onRestored(); }
    catch { if (current.current) setError("Could not restore this collection. Please try again."); }
    finally { inFlight.current = false; if (current.current) setBusy(false); }
  };
  return <article data-private className="space-y-2 rounded-lg border border-[#d8c9dc] bg-[#fbf9fa] p-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 break-words font-semibold">{collection.name}</p><Button ref={restoreButton} variant="outline" className="min-h-11 border-[#241426] text-[#241426]" disabled={busy} onClick={() => void run()}>{busy ? "Restoring…" : "Restore collection"}</Button></div>
    {error && <p role="alert">{error}</p>}
  </article>;
}

function RemovedInspiration({ collection, collectionRemoved, onRestored }: { collection: Collection; collectionRemoved: boolean; onRestored: () => boolean }) {
  const removed = usePaginatedQuery(api.wardrobe.pageInspiration, { wardrobeId: collection._id, removed: true }, { initialNumItems: 24 });
  return <div className="space-y-3">
    {collectionRemoved && <p className="rounded-lg border border-[#241426] bg-[#fbf9fa] p-3">Restore this collection above before restoring its inspiration.</p>}
    {removed.status === "LoadingFirstPage" ? <p role="status">Loading removed inspiration…</p> : removed.results.map(reference => <RestoreInspiration key={reference.membershipId} wardrobeId={collection._id} reference={reference} disabled={collectionRemoved} onRestored={onRestored} />)}
    {removed.status === "Exhausted" && !removed.results.length && <p>No removed inspiration in this collection.</p>}
    {removed.status === "CanLoadMore" && <Button variant="outline" className="min-h-11" onClick={() => removed.loadMore(24)}>More removed inspiration</Button>}
    {removed.status === "LoadingMore" && <p role="status">Loading more removed inspiration…</p>}
  </div>;
}

function RestoreInspiration({ wardrobeId, reference, disabled, onRestored }: { wardrobeId: Id<"wardrobes">; reference: { membershipId: Id<"wardrobeMemberships">; description: string | null; category: string | null }; disabled: boolean; onRestored: () => boolean }) {
  const restore = useMutation(api.wardrobe.setInspirationRemoved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(true);
  const inFlight = useRef(false);
  const restoreButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (error && !busy) restoreButton.current?.focus(); }, [error, busy]);
  useEffect(() => { current.current = true; return () => { current.current = false; }; }, []);
  const run = async () => {
    if (disabled || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      await restore({ wardrobeId, membershipId: reference.membershipId, removed: false });
      if (onRestored()) { posthog.capture("inspiration_membership_changed", { operation: "restored", surface: "wardrobe" }); }
    } catch { if (current.current) setError("Could not restore this inspiration. Please try again."); }
    finally { inFlight.current = false; if (current.current) setBusy(false); }
  };
  return <article data-private className="space-y-2 rounded-lg border border-[#d8c9dc] bg-[#fbf9fa] p-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 break-words">{reference.description ?? reference.category ?? "Saved reference"}</p><Button ref={restoreButton} variant="outline" className="min-h-11 border-[#241426] text-[#241426]" disabled={disabled || busy} onClick={() => void run()}>{busy ? "Restoring…" : "Restore inspiration"}</Button></div>
    {error && <p role="alert">{error}</p>}
  </article>;
}
