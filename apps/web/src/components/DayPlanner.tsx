"use client";
import { revealDecodedImage } from "@/lib/revealDecodedImage";
import { weatherCities } from "@wardrobe/shared";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Mic,
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
import { PlannerHeader, PlanLoading } from "./FitsLoading";
import DayVoiceInput from "./DayVoiceInput";
import GoogleCalendarConnect from "./GoogleCalendarConnect";
import OwnedPiecePicker from "./OwnedPiecePicker";
import { outfitText } from "@/lib/outfitText";
import { requestWeatherCity } from "@/lib/weatherLocation";

type Draft = {
  week: string;
  description: string;
  review: ReviewedDay[];
  clarification: string;
  useCalendar: boolean;
  weatherCity: string;
  assumption: string;
};
const initial = (): Draft => ({
  week: localDate(),
  description: "",
  review: [],
  clarification: "",
  useCalendar: true,
  weatherCity: "",
  assumption: "",
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
  | "swap"
  | "why"
  | "dismiss"
  | null;

export default function DayPlanner({
  historyDate, visible = true,
}: { historyDate?: string; visible?: boolean } = {}) {
  const { user } = useUser();
  return user ? (
    <WeekPlanner
      key={`${user.id}-${historyDate ?? "current"}`}
      userId={user.id}
      historyDate={historyDate}
      visible={visible}
    />
  ) : <PlanLoading />;
}
function WeekPlanner({
  userId,
  historyDate, visible,
}: {
  visible: boolean;
  userId: string;
  historyDate?: string;
}) {
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [calendarPrompt, setCalendarPrompt] = useState(false);
  const permissionAttempts = useRef(new Set<string>());
  const planningEntry = useRef(0);
  const [data, setData] = useState<PlanningData | null>(null);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...initial(),
    week: historyDate ?? localDate(),
  }));
  const [restored, setRestored] = useState(false);
  const [selected, setSelected] = useState(historyDate ?? localDate());
  const [calendar, setCalendar] = useState<CalendarWeek | null>(null);
  const [calendarRetry, setCalendarRetry] = useState(0);
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
          ...(saved.draft.week === localDate() ? {
            week: saved.draft.week,
            review: Array.isArray(saved.draft.review) ? saved.draft.review.filter((day: ReviewedDay) => sevenDays(localDate()).includes(day.date) && typeof day.description === "string").slice(0,7) : [],
            clarification: typeof saved.draft.clarification === "string" ? saved.draft.clarification : "",
            assumption: typeof saved.draft.assumption === "string" ? saved.draft.assumption : "",
          } : {}),
          useCalendar: saved.draft.useCalendar !== false,
          weatherCity: weatherCities.some(city => city.id === saved.draft.weatherCity) ? saved.draft.weatherCity : "",
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
          if (active) {
            if (result.days.length === 7) setCalendar(result);
            else setCalendarError(true);
          }
        })
        .catch(() => {
          if (active) setCalendarError(true);
        });
    return () => {
      active = false;
    };
  }, [data?.calendarEnabled, calendarKey, draft.week, restored, historyDate, calendarRetry]);
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
    setDraft((d) => ({ ...d, description, review: [], clarification: "", assumption: "" }));
  const submit = async () => {
    if (voiceBusy || locating) return;
    setCalendarPrompt(false);
    const result = await perform(async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let days = draft.review;
      let interpretationFallback = false;
      let weekdayAssumption = "";
      if (draft.description.trim() && !days.length) {
        const interpretation = await planningRequest<WeekInterpretation & { fallback?: boolean; assumption?: string }>({
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
          assumption: interpretation.assumption ?? "",
        }));
        if (interpretation.clarification)
          return { clarification: true as const };
        days = interpretation.days;
        interpretationFallback = Boolean(interpretation.fallback);
        weekdayAssumption = interpretation.assumption ?? "";
      }
      // No description is required for a useful suggestion from an owned closet.
      if (!draft.description.trim())
        days = [{ date: selected, description: "" }];
      const saved = await planningRequest<{ updated: number; kept: number; calendarUnavailable?: boolean; weatherAvailable?: boolean }>({
        operation: "planning_generate_week",
        week: draft.week,
        days,
        timezone,
        useCalendar: draft.useCalendar && Boolean(data?.calendarEnabled),
        weatherCity: draft.weatherCity,
      });
      return { ...saved, assumption: draft.assumption || weekdayAssumption, interpretationFallback, dates: days.map((day) => day.date) };
    }, false);
    if (result && !("clarification" in result)) {
      setMessage(
        (result.assumption ? `${result.assumption} ` : "") + (result.interpretationFallback ? "Detailed plans unavailable; everyday outfit suggested for the selected day. " : "") + (result.calendarUnavailable ? "Calendar unavailable; everyday defaults used. " : "") + (draft.weatherCity && !result.weatherAvailable ? "Forecast unavailable; layering advice included. " : "") + (result.updated
          ? `${result.updated} ${result.updated === 1 ? "day" : "days"} updated${result.kept ? ` · ${result.kept} chosen ${result.kept === 1 ? "outfit" : "outfits"} kept` : ""}`
          : "Your chosen outfits were kept. Swap a piece to adjust them."),
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
    const request = "id" in operation ? { ...operation, requestId: crypto.randomUUID() } : operation;
    if (await perform(() => planningRequest(request))) {
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
    if (next !== "describe") { planningEntry.current++; setCalendarPrompt(false); }
    setError("");
    setMessage("");
    setSwap(null);
    setView(next);
  };
  // Requests happen only in this intentional entry handler, never on load or opening Options.
  const beginPlanning = async () => {
    open("describe");
    const entry = ++planningEntry.current;
    const claim = (kind: string) => {
      const key = `${storageKey}-permission-${kind}`;
      if (permissionAttempts.current.has(kind)) return false;
      try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, "requested"); } catch { /* In-memory guard still prevents repeat prompts. */ }
      permissionAttempts.current.add(kind);
      return true;
    };
    if (claim("location")) {
      setLocating(true);
      setLocationMessage("Finding a nearby forecast… Device coordinates stay on this device.");
      try {
        // Start immediately inside the click handler, preserving browser user activation.
        const city = await requestWeatherCity(navigator.geolocation);
        if (city) {
          setDraft(current => ({ ...current, weatherCity: city.id }));
          setLocationMessage("Nearby city forecast added.");
        } else setLocationMessage("No nearby forecast is available. Planning can continue.");
      } catch { setLocationMessage("Location unavailable or access declined. Planning can continue."); }
      finally { setLocating(false); }
    }
    // Present Calendar after location settles. OAuth starts from its own explicit button click.
    if (entry === planningEntry.current && !data?.calendarEnabled && claim("calendar")) setCalendarPrompt(true);
  };
  const pieces = (
    <div data-private className="planner-outfit-photo">
      {outfit?.itemIds.map((id) => {
        const item = data?.items.find((i) => i.id === id);
        return (
          <div key={id} className="planner-outfit-piece">
            {item?.imageUrl ? (
              <Image
                onLoad={revealDecodedImage}
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
      {!historyDate && <PlannerHeader week={draft.week} selected={selected} onCalendar={() => open("calendar")} status={date => outfitForDay(data?.suggestions ?? [], date)?.status ?? (data ? "No suggestion" : undefined)} onSelect={date => {setSelected(date);setDraft(d=>({...d,review:[],clarification:""}));setSwap(null);setReason("");}} />}
      {!view && (error || message || refreshWarning || busy) && status}
      {!data && error && (
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
        <div className="flex min-h-12 items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">{dateLabel(selected, true)}</h3>
          {outfit && (
            <p className="text-sm capitalize text-[#685e70]">{outfit.status}</p>
          )}
        </div>
        {outfit ? (
          <>
            {pieces}
            <div className="planner-outfit-title" data-private>
              <h4 className="text-lg font-semibold">{outfitText(outfit.title, [...(data?.items.map(item => item.id) ?? []), outfit.id])}</h4>
              {outfit.missing.length > 0 && (
                <p className="text-sm">
                  To complete or adapt: {outfitText(outfit.missing.join(" · "), data?.items.map(item => item.id))}
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
                {!data
                  ? error ? "Outfits unavailable." : "Loading your outfits…"
                  : historyDate
                    ? "No saved outfit is available for this date."
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
            onClick={() => void beginPlanning()}
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
          Calendar unavailable. You can still get an everyday outfit or describe your plans.
        </p>
      )}
      {data?.autoPlan?.state === "error" && (
        <div role="status" className="text-sm">
          <p>
            {data.autoPlan.error === "calendar"
              ? "Calendar unavailable. Request an everyday outfit or retry Calendar later."
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
        open={visible && view !== null}
        onOpenChange={(value) => {
          if (!value && !busy) { planningEntry.current++; setCalendarPrompt(false); setView(null); }
        }}
        title={view ? titles[view] : "Your plans"}
        footer={
          <>
            {view && status}
            {view === "describe" ? (
              <Button
                className="rack-primary-action w-full"
                disabled={busy || voiceBusy || locating || !data?.items.length}
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
                disabled={busy}
                onClick={() =>
                  void update({
                    operation: "planning_dismiss",
                    id: outfit.id,
                    ...(reason ? { reason } : {}),
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
            {locationMessage && <p role="status" className="text-sm">{locationMessage}</p>}
            <details className="text-xs"><summary className="cursor-pointer py-2">Forecast sources</summary><p><a className="underline" href="https://api.met.no/">Data from MET Norway</a> and <a className="underline" href="https://www.geonames.org/">GeoNames city data</a>, <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Coordinates rounded; forecast periods summarized into city-local days.</p></details>
            {calendarPrompt && !locating && <div className="space-y-3 rounded-xl border p-4">
              <p className="text-sm">Use Google Calendar to plan around your week, or continue without it.</p>
              <GoogleCalendarConnect enabled={false} selectedIds={data?.calendarIds} beforeAuthorize={persist} onChange={(enabled) => {
                setCalendarPrompt(false);
                setDraft(current => ({ ...current, useCalendar: enabled }));
                setData(current => current ? { ...current, calendarEnabled: enabled } : current);
                void refresh().catch(() => setRefreshWarning("Calendar settings saved. The view could not refresh."));
              }} />
              <Button type="button" variant="outline" onClick={() => { setCalendarPrompt(false); setDraft(current => ({ ...current, useCalendar: false })); }}>Continue without Calendar</Button>
            </div>}
            <DayVoiceInput
              hasText={Boolean(draft.description.trim())}
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
            {draft.assumption && <p role="status" className="text-sm">{draft.assumption}</p>}
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
                  ? "Google Calendar selected"
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
            onChange={(enabled) => {
              setCalendar(null);
              setCalendarError(false);
              setData(current => current ? { ...current, calendarEnabled: enabled } : current);
              setCalendarRetry(value => value + 1);
              void refresh().catch(() => setRefreshWarning("Calendar settings saved. The view could not refresh."));
            }}
          />
        )}
        {view === "why" && outfit && (
          <div data-private className="space-y-5 text-sm leading-relaxed">
            <p className="whitespace-pre-line">{outfitText(outfit.rationale, [...(data?.items.map(item => item.id) ?? []), outfit.id])}</p>
            <h3 className="font-semibold">Context used</h3>
            <p>{outfitText(outfit.context.join(" · "), [...(data?.items.map(item => item.id) ?? []), outfit.id])}</p>
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
            {swap && <OwnedPiecePicker items={data?.items.filter(item => !outfit.itemIds.includes(item.id)) ?? []} disabled={busy} onChoose={id => void update({ operation: "planning_edit", id: outfit.id, itemIds: swap === "add" ? [...outfit.itemIds, id] : outfit.itemIds.map(existing => existing === swap ? id : existing) })} />}
            {outfit.status === "planned" && (
              <p className="text-sm">
                Adjust the pieces to match what you actually wore before
                confirming.
              </p>
            )}
          </div>
        )}
        {view === "dismiss" && <fieldset className="space-y-3"><legend className="mb-3 text-sm">Reason (optional)</legend><div className="flex flex-wrap gap-2">{["Not my style", "Wrong for the occasion", "Pieces unavailable", "Weather mismatch"].map(value => <button type="button" key={value} disabled={busy} aria-pressed={reason === value} onClick={() => setReason(value)} className={`min-h-11 rounded-full border px-4 py-2 text-sm ${reason === value ? "border-[#241426] bg-[#E4FF91]" : "bg-white"}`}>{value}</button>)}</div></fieldset>}
      </TaskSheet>
    </section>
  );
}
