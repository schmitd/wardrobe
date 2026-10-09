"use client";

import Link from "next/link";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import posthog from "posthog-js";
import { Button } from "./ui/button";
import CollectionEnsemble from "./CollectionEnsemble";

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
    <h1 className="text-3xl font-bold">Data management</h1>
    {!clerk.isLoaded || (clerk.isSignedIn && convex.isLoading) ? <p role="status">Connecting to your data…</p> : !clerk.isSignedIn ? <p>Sign in to manage your data. <Link className="underline" href="/sign-in">Sign in</Link></p> : !confirmed ? <section className="space-y-3"><p role="alert">Your data connection is unavailable.</p><Button variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Retry connection</Button></section> : <DataBoundary key={owner}><PrivateData key={owner} /></DataBoundary>}
  </main>;
}

type Collection = { _id: Id<"wardrobes">; name: string; previews?: { id: string; imageUrl: string; category: string | null }[] };
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
  const collections = [...new Map([...active.results, ...archived.results].map(collection => [collection._id, collection])).values()];
  const selected = collections.find(collection => collection._id === selectedId);
  const collectionRemoved = archived.results.some(collection => collection._id === selectedId);
  const loadingCollections = active.status === "LoadingFirstPage" || archived.status === "LoadingFirstPage";
  return <>
    {notice && <p ref={noticeRef} tabIndex={-1} role="status" className="rounded-lg border border-[#241426] bg-[#e8f3ec] p-3 text-[#241426] focus:outline-2 focus:outline-offset-2 focus:outline-[#241426]">{notice.text}</p>}
    <section className="space-y-3" aria-labelledby="removed-collections-title">
      <h2 id="removed-collections-title" className="text-xl font-bold">Removed collections</h2>
      {archived.status === "LoadingFirstPage" ? <p role="status">Loading removed collections…</p> : archived.results.map(collection => <RestoreCollection key={collection._id} collection={collection} onRestored={() => restored("Collection restored. It is available in your wardrobe.")} />)}
      {archived.status === "Exhausted" && !archived.results.length && <p>No removed collections.</p>}
      {archived.status === "CanLoadMore" && <Button variant="outline" className="min-h-11" onClick={() => archived.loadMore(12)}>More removed collections</Button>}
      {archived.status === "LoadingMore" && <p role="status">Loading more removed collections…</p>}
    </section>
    <section className="space-y-3" aria-labelledby="removed-inspiration-title">
      <h2 id="removed-inspiration-title" className="text-xl font-bold">Removed inspiration</h2>
      {loadingCollections && <p role="status">Loading collections…</p>}
      <nav className="collection-rail" aria-label="Inspiration collections">
        {collections.map(collection => <button type="button" key={collection._id} data-private className="collection-shortcut" aria-pressed={selectedId === collection._id} aria-controls="removed-inspiration-list" onClick={() => { setSelectedId(collection._id); setNotice(null); }}>
          <CollectionEnsemble pieces={collection.previews ?? []} />
          <span className="line-clamp-2">{collection.name}</span>
          {archived.results.some(row => row._id === collection._id) && <span className="text-xs">Removed</span>}
        </button>)}
      </nav>
      {active.status === "Exhausted" && archived.status === "Exhausted" && !collections.length && <p>No collections to review.</p>}
      {active.status === "CanLoadMore" && <Button variant="outline" className="min-h-11" onClick={() => active.loadMore(12)}>More active collections</Button>}
      {active.status === "LoadingMore" && <p role="status">Loading more collections…</p>}
      {selected && <RemovedInspiration key={selected._id} collection={selected} collectionRemoved={collectionRemoved} canContinue={() => current.current} onRestored={() => restored("Inspiration restored. It is available in its collection.")} />}
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

function RemovedInspiration({ collection, collectionRemoved, canContinue, onRestored }: { collection: Collection; collectionRemoved: boolean; canContinue: () => boolean; onRestored: () => boolean }) {
  const removed = usePaginatedQuery(api.wardrobe.pageInspiration, { wardrobeId: collection._id, removed: true }, { initialNumItems: 24 });
  return <div id="removed-inspiration-list" className="space-y-3">
    {removed.status === "LoadingFirstPage" ? <p role="status">Loading removed inspiration…</p> : removed.results.map(reference => <RestoreInspiration key={reference.membershipId} wardrobeId={collection._id} reference={reference} collectionRemoved={collectionRemoved} canContinue={canContinue} onRestored={onRestored} />)}
    {removed.status === "Exhausted" && !removed.results.length && !collectionRemoved && <p>No removed inspiration in this collection.</p>}
    {removed.status === "CanLoadMore" && <Button variant="outline" className="min-h-11" onClick={() => removed.loadMore(24)}>More removed inspiration</Button>}
    {removed.status === "LoadingMore" && <p role="status">Loading more removed inspiration…</p>}
  </div>;
}

function RestoreInspiration({ wardrobeId, reference, collectionRemoved, canContinue, onRestored }: { wardrobeId: Id<"wardrobes">; reference: { membershipId: Id<"wardrobeMemberships">; description: string | null; category: string | null }; collectionRemoved: boolean; canContinue: () => boolean; onRestored: () => boolean }) {
  const restore = useMutation(api.wardrobe.setInspirationRemoved);
  const restoreCollection = useMutation(api.wardrobe.archiveCollection);
  const collectionRestored = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(true);
  const inFlight = useRef(false);
  const restoreButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (error && !busy) restoreButton.current?.focus(); }, [error, busy]);
  useEffect(() => { current.current = true; return () => { current.current = false; }; }, []);
  const run = async () => {
    if (!canContinue() || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    let restoringCollection = collectionRemoved && !collectionRestored.current;
    try {
      if (restoringCollection) {
        await restoreCollection({ wardrobeId, archived: false });
        collectionRestored.current = true;
        restoringCollection = false;
        // A completed first write remains persisted; never initiate a second write after owner loss.
        if (!canContinue()) return;
      }
      await restore({ wardrobeId, membershipId: reference.membershipId, removed: false });
      if (onRestored()) { posthog.capture("inspiration_membership_changed", { operation: "restored", surface: "wardrobe" }); }
    } catch { if (current.current && canContinue()) setError(restoringCollection ? "Could not restore this collection. Please try again." : collectionRestored.current ? "Collection restored. Inspiration could not be restored. Please try again." : "Could not restore this inspiration. Please try again."); }
    finally { inFlight.current = false; if (current.current) setBusy(false); }
  };
  return <article data-private className="space-y-2 rounded-lg border border-[#d8c9dc] bg-[#fbf9fa] p-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 break-words">{reference.description ?? reference.category ?? "Saved reference"}</p><Button ref={restoreButton} variant="outline" className="min-h-11 h-auto w-full whitespace-normal border-[#241426] text-[#241426] sm:w-auto" disabled={busy} onClick={() => void run()}>{busy ? "Restoring…" : collectionRemoved && !collectionRestored.current ? "Restore collection & inspiration" : "Restore inspiration"}</Button></div>
    {error && <p role="alert">{error}</p>}
  </article>;
}
