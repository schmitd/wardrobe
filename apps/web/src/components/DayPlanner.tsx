"use client";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Mic,
  SlidersHorizontal,
  Shirt,
} from "lucide-react";
import {
  localDate,
  outfitForDay,
  sevenDays,
  type PlanningData,
  type PlanningOperation,
  type ReviewedDay,
  type WeekInterpretation,
  type CalendarWeek,
} from "@wardrobe/shared";
import { planningRequest } from "@/lib/planning-client";
import { Button } from "./ui/button";
import TaskSheet from "./TaskSheet";
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
  "w-full rounded-lg border border-[#bbb0c0] bg-white px-3 py-3 text-[#241426] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#735079]";
type View =
  | "describe"
  | "calendar"
  | "options"
  | "swap"
  | "why"
  | "dismiss"
  | null;

export default function DayPlanner({
  historyDate,
}: { historyDate?: string } = {}) {
  const { user } = useUser();
  return user ? (
    <WeekPlanner
      key={`${user.id}-${historyDate ?? "current"}`}
      userId={user.id}
      historyDate={historyDate}
    />
  ) : null;
}
function WeekPlanner({
  userId,
  historyDate,
}: {
  userId: string;
  historyDate?: string;
}) {
  const [data, setData] = useState<PlanningData | null>(null);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...initial(),
    week: historyDate ?? localDate(),
  }));
  const [restored, setRestored] = useState(false);
  const [selected, setSelected] = useState(historyDate ?? localDate());
  const [calendar, setCalendar] = useState<CalendarWeek | null>(null);
  const [calendarError, setCalendarError] = useState(false);
  const [view, setView] = useState<View>(null);
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [refreshWarning, setRefreshWarning] = useState("");
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
      /* The in-memory draft remains usable. */
    }
  }, [draft, storageKey]);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (
        !historyDate &&
        saved?.expires > Date.now() &&
        typeof saved.draft?.description === "string"
      ) {
        // Never replay a stale interpretation after local-date rollover.
        setDraft({
          ...initial(),
          description: saved.draft.description.slice(0, 4000),
          useCalendar: saved.draft.useCalendar !== false,
        });
      }
    } catch {
      /* Invalid local draft. */
    }
    setRestored(true);
    if (new URLSearchParams(window.location.search).has("calendar"))
      setView("calendar");
  }, [storageKey, historyDate]);
  useEffect(() => {
    if (restored) persist();
  }, [persist, restored]);
  useEffect(() => {
    if (historyDate) return;
    const rollover = () => {
      const today = localDate();
      setDraft((d) =>
        d.week === today
          ? d
          : { ...d, week: today, review: [], clarification: "" },
      );
      setSelected((day) => (sevenDays(today).includes(day) ? day : today));
    };
    const timer = setInterval(rollover, 60000);
    window.addEventListener("focus", rollover);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", rollover);
    };
  }, [historyDate]);
  const loadRevision = useRef(0);
  const refresh = useCallback(async () => {
    const revision = ++loadRevision.current;
    const next = await planningRequest<PlanningData>({
      operation: "planning_load",
      week: draft.week,
    });
    if (revision === loadRevision.current) setData(next);
  }, [draft.week]);
  useEffect(() => {
    void refresh().catch(() =>
      setError("Could not load planning. Please retry."),
    );
    return () => {
      // Invalidate the latest request counter, not a captured DOM reference.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadRevision.current++;
    };
  }, [refresh]);
  const calendarKey = JSON.stringify(data?.calendarIds ?? []);
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
  }, [data?.calendarEnabled, calendarKey, draft.week, restored, historyDate]);
  const perform = async <T,>(
    work: () => Promise<T>,
    reload = true,
  ): Promise<T | null> => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    setRefreshWarning("");
    try {
      const result = await work();
      if (reload) {
        try {
          await refresh();
        } catch {
          setRefreshWarning(
            "Saved. The view could not refresh; reload to see your change.",
          );
        }
      }
      return result;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not complete this request.",
      );
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const outfit = outfitForDay(data?.suggestions ?? [], selected);
  const setText = (description: string) =>
    setDraft((d) => ({ ...d, description, review: [], clarification: "" }));
  const submit = async () => {
    if (voiceBusy) return;
    const result = await perform(async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let days = draft.review;
      if (draft.description.trim() && !days.length) {
        const interpretation = await planningRequest<WeekInterpretation>({
          operation: "planning_interpret",
          description: draft.description,
          week: draft.week,
          anchorDate: selected,
          timezone,
        });
        setDraft((d) => ({
          ...d,
          review: interpretation.clarification ? [] : interpretation.days,
          clarification: interpretation.clarification,
        }));
        if (interpretation.clarification)
          return { clarification: true as const };
        days = interpretation.days;
      }
      // No description is required for a useful suggestion from an owned closet.
      if (!draft.description.trim())
        days = [{ date: selected, description: "" }];
      const saved = await planningRequest<{ updated: number; kept: number }>({
        operation: "planning_generate_week",
        week: draft.week,
        days,
        timezone,
        useCalendar: draft.useCalendar && Boolean(data?.calendarEnabled),
      });
      return { ...saved, dates: days.map((day) => day.date) };
    }, false);
    if (result && !("clarification" in result)) {
      setMessage(
        result.updated
          ? `${result.updated} ${result.updated === 1 ? "day" : "days"} updated${result.kept ? ` · ${result.kept} chosen ${result.kept === 1 ? "outfit" : "outfits"} kept` : ""}`
          : "Your chosen outfits were kept. Swap a piece to adjust them.",
      );
      setDraft((d) => ({ ...d, review: [], clarification: "" }));
      setView(null);
      if (result.updated) {
        const eligible = result.dates.filter(
          (date) =>
            !["planned", "worn"].includes(
              outfitForDay(data?.suggestions ?? [], date)?.status ?? "",
            ),
        );
        if (!eligible.includes(selected) && eligible[0])
          setSelected(eligible[0]);
      }
      try {
        await refresh();
      } catch {
        setRefreshWarning(
          "Saved. The view could not refresh; reload to see your change.",
        );
      }
    }
  };
  const update = async (operation: PlanningOperation) => {
    if (await perform(() => planningRequest(operation))) {
      setSwap(null);
      setReason("");
      setMessage("Outfit updated.");
      if (operation.operation === "planning_dismiss") setView(null);
    }
  };
  const configured = useRef("");
  useEffect(() => {
    if (!data || !restored || historyDate) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const key = `${draft.week}:${timezone}`;
    if (configured.current === key) return;
    configured.current = key;
    // The backend coalesces visits, owns the schedule, and preserves an explicit pause.
    void planningRequest({ operation: "planning_auto", timezone })
      .then(refresh)
      .catch(() =>
        setError(
          "Automatic planning could not start. Use Retry auto-plan or describe your plans.",
        ),
      );
  }, [data, draft.week, restored, historyDate, refresh]);
  useEffect(() => {
    if (!data?.autoPlan?.enabled || historyDate) return;
    // Poll only while work is due/running; the durable job does not depend on this tab.
    const due =
      data.autoPlan.state === "running" || data.autoPlan.nextAt <= Date.now();
    const delay = due
      ? 3000
      : Math.min(Math.max(data.autoPlan.nextAt - Date.now(), 3000), 60000);
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, delay);
    return () => clearInterval(timer);
  }, [data?.autoPlan, historyDate, refresh]);
  const autoPlan = async (enabled?: boolean, retry = false) => {
    await perform(() =>
      planningRequest({
        operation: "planning_auto",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(enabled === undefined ? {} : { enabled }),
        ...(retry ? { retry: true } : {}),
      }),
    );
  };
  const open = (next: View) => {
    setError("");
    setMessage("");
    setSwap(null);
    setView(next);
  };
  const pieces = (
    <div data-private className="planner-outfit-photo">
      {outfit?.itemIds.map((id) => {
        const item = data?.items.find((i) => i.id === id);
        return (
          <div key={id} className="planner-outfit-piece">
            {item?.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.category}
                fill
                sizes="(max-width: 640px) 30vw, 220px"
                className="object-contain"
                unoptimized
              />
            ) : (
              <Shirt className="m-auto h-full w-12 text-[#685e70]" />
            )}
          </div>
        );
      })}
    </div>
  );
  const status = (
    <div className="task-sheet-status">
      {error ? (
        <p role="alert" className="text-[#B93267]">
          {error}
        </p>
      ) : (
        <p role="status">
          {busy ? "Updating outfits…" : refreshWarning || message}
        </p>
      )}
    </div>
  );
  const titles = {
    describe: "Your plans",
    calendar: "Google Calendar",
    options: "Planner options",
    swap: "Swap a piece",
    why: "Why this outfit",
    dismiss: "Dismiss suggestion",
  };
  return (
    <section
      id="plans"
      aria-label="Week outfit planner"
      className="space-y-4 text-[#241426]"
    >
      {!historyDate && (
        <>
          <header className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold sm:text-xl">This week</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                aria-label="Calendar"
                onClick={() => open("calendar")}
              >
                <CalendarDays />
                <span className="hidden sm:inline">Calendar</span>
              </Button>
              <Button
                variant="outline"
                aria-label="Planner options"
                onClick={() => open("options")}
              >
                <SlidersHorizontal />
              </Button>
            </div>
          </header>
          <div className="planner-day-rail">
            {sevenDays(draft.week).map((date) => {
              const suggestion = outfitForDay(data?.suggestions ?? [], date);
              return (
                <button
                  key={date}
                  type="button"
                  aria-pressed={selected === date}
                  aria-label={`${dateLabel(date, true)}, ${suggestion?.status ?? "No suggestion"}`}
                  onClick={() => {
                    setSelected(date);
                    setDraft((d) => ({ ...d, review: [], clarification: "" }));
                    setSwap(null);
                    setReason("");
                  }}
                  className={`planner-day ${selected === date ? "planner-day--selected" : ""}`}
                >
                  <span className="block font-medium">
                    {new Date(`${date}T12:00:00`).toLocaleDateString(
                      undefined,
                      { weekday: "short" },
                    )}
                  </span>
                  <span className="block text-xl tabular-nums">
                    {new Date(`${date}T12:00:00`).getDate()}
                  </span>
                  <span
                    className="planner-day-dot"
                    aria-label={suggestion ? "Outfit saved" : "No outfit yet"}
                  >
                    {suggestion ? "•" : "·"}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {!view && (error || message || refreshWarning || busy) && status}
      {!data && (
        <Button
          variant="outline"
          onClick={() =>
            void refresh()
              .then(() => setError(""))
              .catch(() => setError("Could not load planning. Please retry."))
          }
        >
          Retry loading outfits
        </Button>
      )}
      <article
        aria-label={`Outfit for ${dateLabel(selected, true)}`}
        className="space-y-4"
      >
        <div className="row">
          <h3 className="text-xl font-semibold">{dateLabel(selected, true)}</h3>
          {outfit && (
            <p className="text-sm capitalize text-[#685e70]">{outfit.status}</p>
          )}
        </div>
        {outfit ? (
          <>
            {pieces}
            <div className="planner-outfit-title" data-private>
              <h4 className="text-lg font-semibold">{outfit.title}</h4>
              {outfit.missing.length > 0 && (
                <p className="text-sm">
                  To complete or adapt: {outfit.missing.join(" · ")}
                </p>
              )}
            </div>
            <div className="min-h-11">
              {outfit.status === "suggested" ? (
                <Button
                  className="rack-primary-action w-full"
                  disabled={busy || !outfit.itemIds.length}
                  onClick={() =>
                    void update({ operation: "planning_accept", id: outfit.id })
                  }
                >
                  Use this fit
                </Button>
              ) : outfit.status === "planned" ? (
                <Button
                  className="rack-primary-action w-full"
                  disabled={busy}
                  onClick={() =>
                    void update({ operation: "planning_worn", id: outfit.id })
                  }
                >
                  I wore this
                </Button>
              ) : (
                <p>Recorded as worn.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="planner-outfit-photo p-6 text-center">
              <p role="status">
                {historyDate
                  ? "No saved outfit is available for this date."
                  : !data
                    ? "Loading your outfits…"
                    : data.items.length === 0
                      ? "Add pieces to your wardrobe to get outfit suggestions."
                      : data.autoPlan?.state === "running" ||
                          (data.autoPlan?.enabled &&
                            data.autoPlan.nextAt <= Date.now())
                        ? "Preparing your daily outfits…"
                        : "No suggestion yet. Describe your plans or request an outfit."}
              </p>
            </div>
            <div className="planner-outfit-title" />
            <div className="min-h-11" />
          </>
        )}
        {!historyDate && (
          <button
            type="button"
            onClick={() => open("describe")}
            disabled={!data || !restored}
            className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-[#c8b9ce] bg-white p-3 text-left text-sm disabled:opacity-50"
          >
            <Mic className="size-5 shrink-0" />
            <span>Describe your day or week</span>
            <ChevronRight className="ml-auto size-4" />
          </button>
        )}
        <div className="planner-action-row">
          {outfit && (
            <>
              <Button variant="ghost" onClick={() => open("why")}>
                Why this outfit
              </Button>
              <Button variant="ghost" onClick={() => open("swap")}>
                Swap a piece
              </Button>
              {outfit.status !== "worn" && (
                <Button variant="ghost" onClick={() => open("dismiss")}>
                  Dismiss suggestion
                </Button>
              )}
            </>
          )}
        </div>
      </article>
      {calendar?.days.find((day) => day.date === selected)?.events.length ? (
        <div className="flex items-start gap-2 text-sm" data-private>
          <CalendarDays className="mt-0.5 size-4 shrink-0" />
          <div>
            {calendar.days
              .find((day) => day.date === selected)
              ?.events.slice(0, 2)
              .map((event) => event.title)
              .join(" · ")}
            {calendar.days.find((day) => day.date === selected)?.truncated && (
              <p className="text-xs text-[#685e70]">
                Partial calendar · some events are not shown
              </p>
            )}
          </div>
        </div>
      ) : null}
      {calendarError && (
        <p role="status" className="text-sm">
          Calendar could not refresh. Reconnect Calendar or continue with your
          description.
        </p>
      )}
      {data?.autoPlan?.state === "error" && (
        <div role="status" className="text-sm">
          <p>
            {data.autoPlan.error === "calendar"
              ? "Automatic outfits could not read Calendar. Reconnect it or turn calendar context off."
              : "Automatic outfits could not finish. Your existing outfits are unchanged."}
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void autoPlan(undefined, true)}
          >
            Retry auto-plan
          </Button>
        </div>
      )}
      <TaskSheet
        open={view !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setView(null);
        }}
        title={view ? titles[view] : "Your plans"}
        footer={
          <>
            {view && status}
            {view === "describe" ? (
              <Button
                className="rack-primary-action w-full"
                disabled={busy || voiceBusy || !data?.items.length}
                onClick={() => void submit()}
              >
                {busy
                  ? "Updating outfits…"
                  : draft.description.trim()
                    ? "Update outfits"
                    : "Suggest outfit"}
              </Button>
            ) : view === "dismiss" && outfit ? (
              <Button
                className="w-full"
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
            ) : (
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => setView(null)}
              >
                Done
              </Button>
            )}
          </>
        }
      >
        {view === "describe" && (
          <div className="space-y-5">
            <DayVoiceInput
              disabled={busy}
              onBusyChange={setVoiceBusy}
              onText={(text) =>
                setDraft((d) => ({
                  ...d,
                  description: [d.description, text]
                    .filter(Boolean)
                    .join("\n")
                    .slice(0, 4000),
                  review: [],
                  clarification: "",
                }))
              }
            />
            <textarea
              aria-label="Describe your day or week"
              data-private
              className={`${input} planner-composer`}
              rows={4}
              maxLength={4000}
              disabled={busy || voiceBusy}
              value={draft.description}
              onChange={(event) => setText(event.target.value)}
              placeholder="What’s happening today or this week?"
            />
            {draft.clarification && (
              <p role="status" data-private className="text-sm">
                {draft.clarification} Edit your description above, then update
                again.
              </p>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-[#e5dce7] pt-4">
              <label htmlFor="auto-plan" className="text-sm font-medium">
                Auto-plan next 7 days
              </label>
              <input
                id="auto-plan"
                type="checkbox"
                role="switch"
                checked={data?.autoPlan?.enabled ?? true}
                disabled={busy}
                onChange={(event) => void autoPlan(event.target.checked)}
                className="size-5 accent-[#735079]"
              />
            </div>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between text-left text-sm"
              onClick={() => setView("calendar")}
            >
              <span>
                <CalendarDays className="mr-2 inline size-4" />
                {data?.calendarEnabled
                  ? "Google Calendar connected"
                  : "Connect Google Calendar"}
              </span>
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
        {view === "calendar" && (
          <GoogleCalendarConnect
            enabled={Boolean(data?.calendarEnabled)}
            selectedIds={data?.calendarIds}
            beforeAuthorize={persist}
            onChange={() => void refresh()}
          />
        )}
        {view === "options" && (
          <div className="space-y-5">
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5"
                disabled={busy || !data?.calendarEnabled}
                checked={draft.useCalendar && Boolean(data?.calendarEnabled)}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, useCalendar: event.target.checked }))
                }
              />
              Use Calendar for this update
            </label>
            <p className="text-sm">
              Weather is not checked; review the forecast.
            </p>
            {data?.inventoryTruncated && (
              <p className="text-sm">
                Planning uses recent pieces plus pieces from saved outfits and
                relevant collections.
              </p>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void autoPlan(undefined, true)}
            >
              Retry auto-plan
            </Button>
          </div>
        )}
        {view === "why" && outfit && (
          <div data-private className="space-y-5 text-sm leading-relaxed">
            <p className="whitespace-pre-line">{outfit.rationale}</p>
            <h3 className="font-semibold">Context used</h3>
            <p>{outfit.context.join(" · ")}</p>
          </div>
        )}
        {view === "swap" && outfit && (
          <div className="space-y-4">
            <ul data-private className="divide-y divide-[#eee6f0]">
              {outfit.itemIds.map((id) => {
                const item = data?.items.find((i) => i.id === id);
                return (
                  <li key={id} className="space-y-2 py-3">
                    <p className="font-medium">
                      {item?.category ?? "Unavailable piece"}
                    </p>
                    <p className="text-sm text-[#685e70]">
                      {item?.description}
                    </p>
                    {outfit.status !== "worn" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => setSwap(id)}
                        >
                          Swap
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy || outfit.itemIds.length <= 1}
                          onClick={() =>
                            void update({
                              operation: "planning_edit",
                              id: outfit.id,
                              itemIds: outfit.itemIds.filter(
                                (piece) => piece !== id,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {outfit.status !== "worn" && outfit.itemIds.length < 12 && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setSwap("add")}
              >
                Add a piece
              </Button>
            )}
            {swap && (
              <label className="block space-y-2">
                {swap === "add"
                  ? "Add an owned piece"
                  : "Replace with an owned piece"}
                <select
                  data-private
                  className={input}
                  value=""
                  disabled={busy}
                  onChange={(event) => {
                    if (event.target.value)
                      void update({
                        operation: "planning_edit",
                        id: outfit.id,
                        itemIds:
                          swap === "add"
                            ? [...outfit.itemIds, event.target.value]
                            : outfit.itemIds.map((id) =>
                                id === swap ? event.target.value : id,
                              ),
                      });
                  }}
                >
                  <option value="">Choose a piece…</option>
                  {data?.items
                    .filter((item) => !outfit.itemIds.includes(item.id))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.category}: {item.description}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {outfit.status === "planned" && (
              <p className="text-sm">
                Adjust the pieces to match what you actually wore before
                confirming.
              </p>
            )}
          </div>
        )}
        {view === "dismiss" && (
          <label className="block space-y-2 text-sm">
            Reason
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={input}
            >
              <option value="">Choose a reason…</option>
              {[
                "Not my style",
                "Wrong for the occasion",
                "Pieces unavailable",
                "Weather mismatch",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
      </TaskSheet>
    </section>
  );
}
