"use client";

import Link from "next/link";
import { Check, ImagePlus, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type Notification = {
  message: string;
  href?: string;
  error?: boolean;
  action?: { label: string; onClick: () => void };
};
type Notice = Notification & { id: number; remaining: number; expiresAt: number | null; pauses: string[] };
type Notifications = {
  notices: Notice[];
  notify: (notice: Notification) => void;
  dismiss: (id: number) => void;
  pause: (id: number, reason: string, paused: boolean) => void;
  register: (id: string) => () => void;
  activeHost: string | undefined;
};
const Context = createContext<Notifications | null>(null);

export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error("Notifications require NotificationProvider");
  return context;
}

/** Keep notice lifetimes outside modal hosts so opening another task cannot reset them. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [hosts, setHosts] = useState<string[]>([]);
  const nextId = useRef(0);
  const activeHost = hosts.at(-1);
  const notify = useCallback((notice: Notification) => {
    // Errors and actions (including Undo) remain until explicitly handled.
    const remaining = notice.error || notice.action ? Infinity : 5000;
    const id = ++nextId.current;
    const pauses = document.hidden || !document.hasFocus() ? ["window"] : [];
    setNotices(current => [...current, { ...notice, id, remaining, expiresAt: Number.isFinite(remaining) && !pauses.length ? Date.now() + remaining : null, pauses }]);
  }, []);
  const dismiss = useCallback((id: number) => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.closest(`[data-notification-id="${id}"]`)) {
      focused.closest<HTMLElement>("[data-notification-region]")?.focus();
    }
    setNotices(current => current.filter(notice => notice.id !== id));
  }, []);
  const pause = useCallback((id: number, reason: string, paused: boolean) => {
    setNotices(current => current.map(notice => {
      if (notice.id !== id || !Number.isFinite(notice.remaining)) return notice;
      const pauses = paused ? [...new Set([...notice.pauses, reason])] : notice.pauses.filter(value => value !== reason);
      const remaining = notice.expiresAt === null ? notice.remaining : Math.max(0, notice.expiresAt - Date.now());
      return { ...notice, pauses, remaining, expiresAt: pauses.length ? null : Date.now() + remaining };
    }));
  }, []);
  const releaseInteractionPauses = useCallback(() => {
    // Moving between focus scopes unmounts the old cards; release their interaction pauses.
    setNotices(current => current.map(notice => {
      if (!notice.pauses.some(reason => reason === "pointer" || reason === "focus")) return notice;
      const pauses = notice.pauses.filter(reason => reason !== "pointer" && reason !== "focus");
      return { ...notice, pauses, expiresAt: pauses.length || !Number.isFinite(notice.remaining) ? null : Date.now() + notice.remaining };
    }));
  }, []);
  const register = useCallback((id: string) => {
    releaseInteractionPauses();
    setHosts(current => [...current, id]);
    return () => {
      releaseInteractionPauses();
      setHosts(current => current.filter(host => host !== id));
    };
  }, [releaseInteractionPauses]);

  useEffect(() => {
    const deadlines = notices.flatMap(notice => notice.expiresAt === null ? [] : [notice.expiresAt]);
    if (!deadlines.length) return;
    const timer = window.setTimeout(() => setNotices(current => current.filter(notice => notice.expiresAt === null || notice.expiresAt > Date.now())), Math.max(0, Math.min(...deadlines) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [notices]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F8" || !notices.length) return;
      event.preventDefault();
      document.querySelector<HTMLElement>('[data-notification-region="active"]')?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [notices.length]);
  useEffect(() => {
    const update = () => {
      const paused = document.hidden || !document.hasFocus();
      for (const notice of notices) pause(notice.id, "window", paused);
    };
    window.addEventListener("blur", update);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("blur", update);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [notices, pause]);

  return <Context.Provider value={{ notices, notify, dismiss, pause, register, activeHost }}>
    {children}
    {!hosts.length && <NotificationRegion />}
  </Context.Provider>;
}

/** Render inside the active Radix focus scope, never in an inert outside sibling. */
export function ModalNotifications() {
  const context = useContext(Context);
  const id = useId();
  const register = context?.register;
  useLayoutEffect(() => register?.(id), [id, register]);
  return <div className="rack-modal-notifications">{context?.activeHost === id && <NotificationRegion />}</div>;
}

function NotificationRegion() {
  const { notices, dismiss, pause, activeHost } = useNotifications();
  return <section aria-label="Notifications" aria-keyshortcuts="F8" tabIndex={-1} data-notification-region="active" className={activeHost ? "rack-notifications--modal" : "rack-notifications"}>
    {notices.map(notice => <div key={notice.id} data-notification-id={notice.id} className={`rack-capture-toast ${notice.error ? "rack-capture-toast--error" : ""}`}
      onPointerEnter={() => pause(notice.id, "pointer", true)} onPointerLeave={() => pause(notice.id, "pointer", false)}
      onFocusCapture={() => pause(notice.id, "focus", true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) pause(notice.id, "focus", false); }}
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(notice.id); } }}>
      {notice.error ? <ImagePlus className="h-5 w-5 shrink-0" aria-hidden="true" /> : <Check className="h-5 w-5 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 flex-1 font-semibold" role={notice.error ? "alert" : "status"}>
        {notice.href ? <Link href={notice.href} className="font-extrabold underline decoration-2 underline-offset-4">{notice.message}</Link> : notice.message}
      </span>
      {notice.action && <button type="button" className="min-h-11 font-semibold underline" onClick={() => { notice.action!.onClick(); dismiss(notice.id); }}>{notice.action.label}</button>}
      <button type="button" onClick={() => dismiss(notice.id)} aria-label="Dismiss notification" className="grid h-11 w-11 shrink-0 place-items-center hover:bg-black/5 focus-visible:outline-2"><X className="h-4 w-4" aria-hidden="true" /></button>
    </div>)}
  </section>;
}
