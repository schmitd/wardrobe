"use client";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Mic,
  SlidersHorizontal,
  Shirt,
} from "lucide-react";
import {
  localDate,
  outfitForDay,
  sevenDays,
  shiftDay,
  type PlanningData,
  type PlanningOperation,
  type ReviewedDay,
  type WeekInterpretation,
  type CalendarWeek,
} from "@wardrobe/shared";
import { planningRequest } from "@/lib/planning-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import DayVoiceInput from "./DayVoiceInput";
import GoogleCalendarConnect from "./GoogleCalendarConnect";

type Draft = {
  week: string;
  description: string;
  review: ReviewedDay[];
  clarification: string;
  useCalendar: boolean;
};
const initial = (): Draft => ({
  week: localDate(),
  description: "",
  review: [],
  clarification: "",
  useCalendar: true,
});
const dateLabel = (value: string, weekday = false) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    ...(weekday ? { weekday: "long" as const } : {}),
    month: "short",
    day: "numeric",
  });
const input =
  "w-full rounded-lg border border-[#bbb0c0] bg-white px-3 py-2 text-[#241426] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#735079]";

export default function DayPlanner({ historyDate }: { historyDate?: string } = {}) {
  const { user } = useUser();
  return user ? <WeekPlanner key={`${user.id}-${historyDate ?? "current"}`} userId={user.id} historyDate={historyDate} /> : null;
}
function WeekPlanner({ userId, historyDate }: { userId: string; historyDate?: string }) {
  const [data, setData] = useState<PlanningData | null>(null);
  const [draft, setDraft] = useState<Draft>(() => ({ ...initial(), week: historyDate ?? localDate() }));
  const [restored, setRestored] = useState(false);
  const [selected, setSelected] = useState<string | null>(historyDate ?? localDate());
  const [calendar, setCalendar] = useState<CalendarWeek | null>(null);
  const [calendarError, setCalendarError] = useState(false);
  const [modal, setModal] = useState<
    "describe" | "calendar" | "options" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [swap, setSwap] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const storageKey = `wardrobe-planner-${userId}${historyDate ? `-${historyDate}` : ""}`;
  const persist = useCallback(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ draft, expires: Date.now() + 8 * 3600000 }),
      );
    } catch {
      /* current in-memory draft remains usable */
    }
  }, [draft, storageKey]);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (
        !historyDate && saved?.expires > Date.now() &&
        saved.draft?.week >= shiftDay(localDate(), -366) &&
        /^\d{4}-\d{2}-\d{2}$/.test(saved.draft.week) &&
        typeof saved.draft.description === "string" &&
        Array.isArray(saved.draft.review)
      )
        setDraft({ ...initial(), description: saved.draft.description, useCalendar: saved.draft.useCalendar !== false, ...(saved.draft.week === localDate() ? { review: saved.draft.review, clarification: saved.draft.clarification ?? "" } : {}) });
    } catch {
      /* invalid local draft */
    }
    setRestored(true);
    if (new URLSearchParams(window.location.search).has("calendar"))
      setModal("calendar");
  }, [storageKey, historyDate]);
  useEffect(() => {
    if (restored) persist();
  }, [persist, restored]);
  const refresh = useCallback(async () => {
    const next = await planningRequest<PlanningData>({
      operation: "planning_load",
      week: draft.week,
    });
    setData(next);
  }, [draft.week]);
  useEffect(() => {
    void refresh().catch(() =>
      setMessage("Could not load planning. Please retry."),
    );
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setCalendar(null);
    setCalendarError(false);
    if (data?.calendarEnabled && restored && !historyDate)
      void planningRequest<CalendarWeek>({
        operation: "planning_week",
        week: draft.week,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
        .then((result) => {
          if (active) setCalendar(result);
        })
        .catch(() => {
          if (active) setCalendarError(true);
        });
    return () => {
      active = false;
    };
  }, [data, draft.week, restored, historyDate]);
  const [refreshWarning, setRefreshWarning] = useState("");
  const run = async <T,>(operation: PlanningOperation): Promise<T | null> => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setRefreshWarning("");
    try {
      const result = await planningRequest<T>(operation);
      if (operation.operation !== "planning_interpret") {
        try { await refresh(); }
        catch { setRefreshWarning("Saved. The view could not refresh; reload to see your change."); }
      }
      return result;
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not complete this request.",
      );
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const outfit = selected
    ? outfitForDay(data?.suggestions ?? [], selected)
    : undefined;
  const editable = draft.review.filter(
    (day) =>
      !["planned", "worn"].includes(
        outfitForDay(data?.suggestions ?? [], day.date)?.status ?? "",
      ),
  );
  const setText = (description: string) =>
    setDraft((d) => ({ ...d, description, review: [], clarification: "" }));
  const interpret = async () => {
    const result = await run<WeekInterpretation>({
      operation: "planning_interpret",
      description: draft.description,
      week: draft.week,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (result)
      setDraft((d) => ({
        ...d,
        review: result.days,
        clarification: result.clarification,
      }));
  };
  const generate = async () => {
    const result = await run<{ updated: number; kept: number }>({
      operation: "planning_generate_week",
      week: draft.week,
      days: draft.review,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      useCalendar: draft.useCalendar && Boolean(data?.calendarEnabled),
    });
    if (result) {
      setMessage(
        `${result.updated} days updated${result.kept ? ` · ${result.kept} planned or worn outfits kept` : ""}`,
      );
      setModal(null);
    }
  };
  const update = async (operation: PlanningOperation) => {
    const current = "id" in operation ? data?.suggestions.find(row => row.id === operation.id) : undefined;
    if (await run({ ...operation, ...(current ? { expectedRevision: current.planRevision ?? 0 } : {}) })) {
      setSwap(null);
      setReason("");
      setMessage("Outfit updated.");
    }
  };
  const pieces = (ids: string[], large = false) => (
    <div
      data-private
      className={`flex items-center gap-2 ${large ? "overflow-x-auto" : "mt-auto flex-wrap"}`}
    >
      {ids.slice(0, large ? 12 : 4).map((id) => {
        const item = data?.items.find((i) => i.id === id);
        return (
          <div
            key={id}
            className={`relative rounded-md bg-white ${large ? "h-32 min-w-16 max-w-40 shrink-0" : "h-20 w-12"}`}
            style={large ? { width: `calc((100% - ${(Math.min(ids.length, 4) - 1) * 8}px) / ${Math.max(1, Math.min(ids.length, 4))})` } : undefined}
          >
            {item?.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.category}
                fill
                sizes={large ? "(max-width: 640px) 40vw, 160px" : "48px"}
                className="object-contain"
                unoptimized
              />
            ) : (
              <Shirt className="m-auto h-full w-7 text-[#685e70]" />
            )}
          </div>
        );
      })}
    </div>
  );
  return (
    <section
      id="plans"
      aria-label="Week outfit planner"
      className="space-y-4 text-[#241426]"
    >
      {!historyDate && <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">This week</h2>
          <p className="mt-1 hidden text-sm text-[#685e70] sm:block">
            Collections and style notes, matched to your day.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" aria-label="Calendar" onClick={() => setModal("calendar")}>
            <CalendarDays />
            <span className="hidden sm:inline">Calendar</span>
          </Button>
          <Button
            variant="outline"
            aria-label="Planner options"
            onClick={() => setModal("options")}
          >
            <SlidersHorizontal />
          </Button>
        </div>
      </header>}
      {!historyDate && (!data ? (
        <Button
          variant="outline"
          onClick={() =>
            void refresh().catch(() =>
              setMessage("Could not load planning. Please retry."),
            )
          }
        >
          Retry loading outfits
        </Button>
      ) : (
        <div className="planner-day-rail">
          {sevenDays(draft.week).map((date) => {
            const s = outfitForDay(data.suggestions, date);
            const calendarDay = calendar?.days.find((d) => d.date === date);
            const events = calendarDay?.events ?? [];
            return (
              <button
                key={date}
                type="button"
                aria-pressed={selected === date}
                aria-label={`${dateLabel(date, true)}, ${s?.status ?? "No suggestion"}`}
                onClick={() => {
                  setSelected(date);
                  setSwap(null);
                  setReason("");
                }}
                className={`planner-day ${selected === date ? "planner-day--selected" : ""}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="font-medium">
                    {new Date(`${date}T12:00:00`).toLocaleDateString(
                      undefined,
                      { weekday: "short" },
                    )}
                  </span>
                  <span className="text-xl tabular-nums">
                    {new Date(`${date}T12:00:00`).getDate()}
                  </span>
                </div>
                <span className="planner-day-dot" aria-label={events.length ? "Calendar events" : s ? "Outfit saved" : "No outfit yet"}>{events.length || s ? "•" : "·"}</span>
              </button>
            );
          })}
        </div>
      ))}
      {!historyDate && <button type="button" onClick={() => setModal("describe")} disabled={!data || !restored} className="flex w-full items-center gap-3 rounded-xl border border-[#c8b9ce] bg-white p-4 text-left text-sm disabled:opacity-50"><Mic className="size-5 shrink-0" /><span>Describe your day or week…</span><span className="ml-auto text-[#735079]" aria-hidden="true">↗</span></button>}
      {selected && calendar?.days.find(day => day.date === selected)?.events.length ? <div className="flex items-start gap-2 text-sm" data-private><CalendarDays className="mt-0.5 size-4 shrink-0" /><div>{calendar.days.find(day => day.date === selected)?.events.slice(0, 2).map(event => event.title).join(" · ")}{calendar.days.find(day => day.date === selected)?.truncated && <p className="text-xs text-[#685e70]">Partial calendar · some events are not shown</p>}</div></div> : null}
      {data?.inventoryTruncated && <p className="text-sm">Planning uses recent pieces plus pieces in saved outfits and contextually matched collections.</p>}
      {calendarError && (
        <p role="status" className="text-sm">
          Calendar could not refresh. Your outfits are still here. Reconnect
          Calendar or continue with dictation.
        </p>
      )}
      {!modal && refreshWarning && <p role="status" className="text-sm">{refreshWarning}</p>}
      {!modal && message && (
        <p role="status" className="rounded-lg bg-white p-3 text-sm">
          {message}
        </p>
      )}
      {selected && (
        <article
          className="grid gap-5 rounded-xl border border-[#ddd5e1] bg-white p-4 lg:grid-cols-[1.3fr_1fr]"
          aria-label={`Outfit for ${dateLabel(selected, true)}`}
        >
          <div className="space-y-3">
            <h3 className={outfit ? "sr-only" : "text-lg font-semibold"}>
              {dateLabel(selected, true)}
            </h3>
            {outfit ? (
              <>
                <div data-private>
                  <h4 className="text-xl font-semibold">{outfit.title}</h4>
                  {outfit.status !== "suggested" && <p className="mt-1 text-sm capitalize text-[#685e70]">{outfit.status}</p>}
                </div>
                {outfit.context.some(c => c.startsWith("Collection: ")) && <p data-private className="text-sm text-[#735079]">Drawing from {outfit.context.filter(c => c.startsWith("Collection: ")).map(c => c.slice(12)).join(" · ")}</p>}
                {pieces(outfit.itemIds, true)}
              {outfit.status === "suggested" ? (
                <Button
                  className="rack-primary-action"
                  disabled={busy || !outfit.itemIds.length}
                  onClick={() =>
                    void update({ operation: "planning_accept", id: outfit.id })
                  }
                >
                  Use this fit
                </Button>
              ) : outfit.status === "planned" ? (
                <Button
                  className="rack-primary-action"
                  disabled={busy || outfit.date > localDate()}
                  onClick={() =>
                    void update({ operation: "planning_worn", id: outfit.id, expectedRevision: outfit.planRevision ?? 0 })
                  }
                >
                  Wore it
                </Button>
              ) : (
                <p>Recorded as worn.</p>
              )}

                <details><summary className="cursor-pointer py-2 font-semibold text-[#735079]">Swap a piece</summary>
                <ul data-private className="divide-y divide-[#eee6f0]">
                  {outfit.itemIds.map((id) => {
                    const item = data?.items.find((i) => i.id === id);
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div>
                          <p className="font-medium">
                            {item?.category ?? "Unavailable piece"}
                          </p>
                          <p className="text-sm text-[#685e70]">
                            {item?.description}
                          </p>
                        </div>
                        {outfit.status !== "worn" && (
                          <div className="flex gap-2">
                            <Button variant="outline" disabled={busy} onClick={() => setSwap(swap === id ? null : id)}>Swap</Button>
                            <Button variant="ghost" disabled={busy || outfit.itemIds.length <= 1} onClick={() => void update({ operation: "planning_edit", id: outfit.id, itemIds: outfit.itemIds.filter(piece => piece !== id) })}>Remove</Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {outfit.status !== "worn" && outfit.itemIds.length < 12 && <Button variant="outline" disabled={busy} onClick={() => setSwap("add")}>Add a piece</Button>}
                {outfit.status === "planned" && <p className="text-sm text-[#685e70]">Changes here update your plan. Record a different actual outfit in Diary.</p>}
                {swap && (
                  <div className="space-y-2">
                    <p className="font-semibold">{swap === "add" ? "Add an owned piece" : "Choose a replacement"}</p>
                    <div data-private className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                      {data?.items.filter(item => !outfit.itemIds.includes(item.id)).map(item => (
                        <button key={item.id} type="button" disabled={busy} className="rounded-xl border bg-[#faf7fb] p-2 hover:border-[#735079] focus-visible:outline-2 focus-visible:outline-[#735079]" onClick={() => void update({
                          operation: "planning_edit", id: outfit.id,
                          itemIds: swap === "add" ? [...outfit.itemIds, item.id] : outfit.itemIds.map(id => id === swap ? item.id : id),
                        })}>
                          {item.imageUrl ? <Image src={item.imageUrl} alt={item.description || item.category} width={100} height={116} unoptimized className="h-28 w-full object-contain" /> : <div className="h-28 content-center text-sm">No photo</div>}
                          <span className="text-sm font-semibold">{item.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                </details>
              </>
            ) : (
              <>
                <p>
                  {historyDate ? "No saved outfit is available for this date." : "No suggestion yet. Add context for this day or use its calendar events."}
                </p>
                {!historyDate && <Button
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      review: [{ date: selected, description: "" }],
                      clarification: "",
                    }));
                    setModal("describe");
                  }}
                >
                  Suggest an outfit
                </Button>}
              </>
            )}
          </div>
          {outfit && (
            <div className="space-y-4">
              <details><summary className="cursor-pointer font-semibold">Why this outfit</summary>
              <div data-private className="space-y-3 text-sm leading-relaxed">
                <p className="whitespace-pre-line">{outfit.rationale}</p>
                {outfit.missing.length > 0 && (
                  <p>To complete or adapt: {outfit.missing.join(" · ")}</p>
                )}
                <details>
                  <summary className="cursor-pointer py-2">
                    Context used
                  </summary>
                  <p>{outfit.context.join(" · ")}</p>
                </details>
              </div>
              </details>
              {outfit.status !== "worn" && (
                <details>
                  <summary className="cursor-pointer py-2 text-sm">
                    Dismiss suggestion
                  </summary>
                  <label className="block space-y-2 text-sm">
                    Reason
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={input}
                    >
                      <option value="">Choose a reason…</option>
                      {[
                        "Not my style",
                        "Wrong for the occasion",
                        "Pieces unavailable",
                        "Weather mismatch",
                      ].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <Button
                    className="mt-3"
                    variant="outline"
                    disabled={busy || !reason}
                    onClick={() =>
                      void update({
                        operation: "planning_dismiss",
                        id: outfit.id,
                        reason,
                      })
                    }
                  >
                    Dismiss outfit
                  </Button>
                </details>
              )}
            </div>
          )}
        </article>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle>
            {modal === "describe"
              ? "Describe your week"
              : modal === "calendar"
                ? "Google Calendar"
                : "Planner options"}
          </DialogTitle>
          <DialogDescription>
            {modal === "describe"
              ? "Say what is coming up. Review dates and activities before changing outfits."
              : modal === "calendar"
                ? "Your selected week and draft stay here while you connect."
                : "Optional context, away from your weekly overview."}
          </DialogDescription>
          {modal === "describe" && (
            <div className="space-y-4">
              <label className="block space-y-2 font-medium">
                Your week
                <textarea
                  data-private
                  className={input}
                  rows={4}
                  maxLength={4000}
                  disabled={busy}
                  value={draft.description}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Wednesday is a client meeting. Friday is dinner out. Sunday we’re hiking…"
                />
              </label>
              <DayVoiceInput
                disabled={busy}
                onText={(text) =>
                  setText(
                    [draft.description, text]
                      .filter(Boolean)
                      .join("\n")
                      .slice(0, 4000),
                  )
                }
              />
              {!draft.review.length ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy || !draft.description.trim()}
                    onClick={() => void interpret()}
                  >
                    {busy ? "Interpreting…" : "Review days"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !data?.calendarEnabled}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        useCalendar: true,
                        review: sevenDays(d.week).map((date) => ({
                          date,
                          description: "",
                        })),
                        clarification: "",
                      }))
                    }
                  >
                    Use Calendar for this week
                  </Button>
                </div>
              ) : (
                <>
                  <h4 className="font-semibold">Review your days</h4>
                  <p className="text-sm">
                    Check dates and activities. Remove any day you do not want
                    to update.
                  </p>
                  {draft.review.map((day, index) => (
                    <fieldset
                      key={index}
                      className="space-y-3 rounded-xl border p-3"
                    >
                      <legend className="px-1 text-sm">Day {index + 1}</legend>
                      <label className="block text-sm">
                        Date
                        <input
                          type="date"
                          className={input}
                          min={draft.week}
                          max={shiftDay(draft.week, 6)}
                          disabled={busy}
                          value={day.date}
                          onInput={(e) => {
                            const date = e.currentTarget.value;
                            if (date)
                              setDraft((d) => ({
                                ...d,
                                review: d.review.map((row, i) =>
                                  i === index ? { ...row, date } : row,
                                ),
                              }));
                          }}
                          onChange={(e) => {
                            const date = e.currentTarget.value;
                            if (date)
                              setDraft((d) => ({
                                ...d,
                                review: d.review.map((row, i) =>
                                  i === index ? { ...row, date } : row,
                                ),
                              }));
                          }}
                        />
                      </label>
                      <label className="block text-sm">
                        Activities
                        <textarea
                          data-private
                          className={input}
                          rows={2}
                          maxLength={1200}
                          disabled={busy}
                          value={day.description}
                          onChange={(e) => {
                            const description = e.currentTarget.value;
                            setDraft((d) => ({
                              ...d,
                              review: d.review.map((row, i) =>
                                i === index ? { ...row, description } : row,
                              ),
                            }));
                          }}
                        />
                      </label>
                      {["planned", "worn"].includes(
                        outfitForDay(data?.suggestions ?? [], day.date)
                          ?.status ?? "",
                      ) && (
                        <p className="text-sm">
                          Planned or worn outfit will be kept.
                        </p>
                      )}
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            review: d.review.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        Remove day
                      </Button>
                    </fieldset>
                  ))}
                  <Button
                    disabled={
                      busy || !editable.length || Boolean(draft.clarification)
                    }
                    onClick={() => void generate()}
                  >
                    {busy
                      ? "Suggesting outfits…"
                      : `Suggest outfits for ${editable.length} ${editable.length === 1 ? "day" : "days"}`}
                  </Button>
                  <p className="text-sm">
                    Other days stay unchanged. Planned and worn outfits are
                    protected.
                  </p>
                </>
              )}
              {draft.clarification && (
                <div className="space-y-2 rounded-lg border p-3">
                  <p data-private>{draft.clarification}</p>
                  <Button
                    variant="outline"
                    disabled={busy || !draft.review.length}
                    onClick={() =>
                      setDraft((d) => ({ ...d, clarification: "" }))
                    }
                  >
                    I corrected the dates above
                  </Button>
                </div>
              )}
            </div>
          )}
          {modal === "calendar" && (
            <GoogleCalendarConnect
              enabled={Boolean(data?.calendarEnabled)}
              selectedIds={data?.calendarIds}
              beforeAuthorize={persist}
              onChange={() => void refresh()}
            />
          )}
          {modal === "options" && (
            <div className="space-y-4">
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  disabled={!data?.calendarEnabled}
                  checked={draft.useCalendar && Boolean(data?.calendarEnabled)}
                  onChange={(e) => {
                    const useCalendar = e.currentTarget.checked;
                    setDraft((d) => ({ ...d, useCalendar }));
                  }}
                />
                Use Google Calendar for suggestions
              </label>
              <p className="text-sm">Your activities and calendar bring relevant collections into the outfit plan. Your style notes guide the recommendations.</p>
              <p className="text-sm">
                Suggestions use owned wardrobe pieces and saved preferences.
                Weather is not checked; review the forecast.
              </p>
            </div>
          )}
          {modal && refreshWarning && <p role="status" className="text-sm">{refreshWarning}</p>}
      {modal && message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
