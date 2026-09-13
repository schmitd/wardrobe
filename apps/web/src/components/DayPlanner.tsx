"use client";
import { useCallback, useEffect, useState } from "react";
import {
  localDate,
  type OutfitSuggestion,
  type PlanningData,
  type PlanningOperation,
} from "@wardrobe/shared";
import { planningRequest } from "@/lib/planning-client";
import { Button } from "@/components/ui/button";
import DayVoiceInput from "./DayVoiceInput";
import GoogleCalendarConnect from "./GoogleCalendarConnect";

export default function DayPlanner() {
  const [data, setData] = useState<PlanningData | null>(null);
  const [date, setDate] = useState(localDate());
  const [description, setDescription] = useState("");
  const [planId, setPlanId] = useState("");
  const [useCalendar, setUseCalendar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<OutfitSuggestion | null>(null);
  const [pieces, setPieces] = useState<string[]>([]);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [reason, setReason] = useState("Not my style");
  const refresh = useCallback(async () => {
    const next = await planningRequest<PlanningData>({
      operation: "planning_load",
    });
    setData(next);
    if (!next.calendarEnabled) setUseCalendar(false);
  }, []);
  useEffect(() => {
    void refresh().catch(() =>
      setMessage("Could not load outfit planning. Try again."),
    );
  }, [refresh]);
  const run = async (operation: PlanningOperation) => {
    setBusy(true);
    setMessage("");
    try {
      await planningRequest(operation);
      await refresh();
      setEditing(null);
      setDismissing(null);
      setMessage(
        operation.operation === "planning_generate"
          ? "Suggestion ready. Review it below before accepting."
          : "Outfit updated.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return localDate(d);
  });
  return (
    <section
      aria-label="Day outfit planner"
      className="space-y-5 border border-[var(--rack-line)] bg-white p-5"
    >
      <div>
        <h2 className="text-2xl font-extrabold">Dress for your day</h2>
        <p className="mt-2">
          Describe your activities, get an outfit from pieces you own, then make
          it yours.
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run({
            operation: "planning_generate",
            date,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            description,
            ...(planId ? { planId } : {}),
            useCalendar,
          });
        }}
        className="space-y-4"
      >
        <div className="flex flex-wrap gap-2">
          {dates.map((d, i) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={date === d ? "default" : "outline"}
              onClick={() => setDate(d)}
              aria-pressed={date === d}
            >
              {i === 0
                ? "Today"
                : new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                  })}
            </Button>
          ))}
        </div>
        <label className="block">
          Or choose a later date
          <input
            aria-label="Outfit date"
            type="date"
            value={date}
            min={localDate()}
            onChange={(e) => setDate(e.target.value)}
            className="ml-3 border p-2"
          />
        </label>
        <label className="block font-semibold">
          Your day
          <textarea
            data-private
            aria-label="Describe your day"
            value={description}
            maxLength={4000}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Office in the morning, a walk at lunch, then dinner with friends…"
            className="mt-2 block w-full border p-3 font-normal"
          />
        </label>
        <DayVoiceInput
          onText={(text) => {
            setDescription((current) =>
              [current, text].filter(Boolean).join("\n").slice(0, 4000),
            );
            setMessage(
              "Transcript added. Review and correct your day before requesting an outfit.",
            );
          }}
        />
        <label className="block">
          Optional Plan
          <select
            data-private
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="ml-3 max-w-full border p-2"
          >
            <option value="">No Plan</option>
            {data?.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={useCalendar}
            disabled={!data?.calendarEnabled}
            onChange={(e) => setUseCalendar(e.target.checked)}
          />
          Use selected Google calendars for this date
        </label>
        <p className="text-sm">
          Only this requested date is read, even for later dates. Suggestions
          are AI-generated; review dress codes and weather. Wardrobe retains
          your latest 100 recommendations.
        </p>
        <Button type="submit" disabled={busy || !data}>
          {busy ? "Working…" : "Recommend an outfit"}
        </Button>
      </form>
      <GoogleCalendarConnect
        enabled={data?.calendarEnabled ?? false}
        onChange={() =>
          void refresh().catch(() =>
            setMessage("Refresh to load calendar settings."),
          )
        }
      />
      {message && (
        <p role="status" className="border p-3">
          {message}
        </p>
      )}
      {!data && (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void refresh().catch(() =>
              setMessage("Could not load planning. Please try again."),
            )
          }
        >
          Reload planning
        </Button>
      )}
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Suggested, planned and worn</h3>
        {data?.suggestions.length === 0 && (
          <p>Your first outfit suggestion will appear here.</p>
        )}
        {data?.suggestions.map((s) => (
          <article key={s.id} className="space-y-3 border p-4">
            <div data-private>
              <p className="text-sm font-semibold capitalize">
                {s.status} · {s.date}
              </p>
              <h4 className="mt-1 text-xl font-bold">{s.title}</h4>
              <p className="mt-2 whitespace-pre-line">{s.rationale}</p>
              <ul className="mt-3 space-y-1">
                {s.itemIds.map((id) => {
                  const item = data.items.find((i) => i.id === id);
                  return (
                    <li key={id}>
                      {item
                        ? `${item.category}: ${item.description}`
                        : "Piece no longer in your wardrobe"}
                    </li>
                  );
                })}
              </ul>
              {s.missing.length > 0 && (
                <p className="mt-3">
                  To complete or adapt this outfit: {s.missing.join(" · ")}
                </p>
              )}
              <p className="mt-3 text-sm">Context: {s.context.join(" · ")}</p>
            </div>
            {(s.status === "suggested" || s.status === "planned") && (
              <div className="flex flex-wrap gap-2">
                {s.status === "suggested" && (
                  <Button
                    type="button"
                    disabled={busy || !s.itemIds.length}
                    onClick={() =>
                      void run({ operation: "planning_accept", id: s.id })
                    }
                  >
                    Accept outfit
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEditing(s);
                    setPieces(
                      s.itemIds.filter((id) =>
                        data.items.some((i) => i.id === id),
                      ),
                    );
                  }}
                >
                  Edit / swap pieces
                </Button>
                {s.status === "planned" && (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(s);
                      setPieces(
                        s.itemIds.filter((id) =>
                          data.items.some((i) => i.id === id),
                        ),
                      );
                    }}
                  >
                    Record what I wore
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setDismissing(s.id)}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      {editing && (
        <section
          className="space-y-3 border-2 border-[#241426] p-4"
          aria-label="Edit outfit"
        >
          <h3 className="font-bold">
            {editing.status === "planned"
              ? "Choose what you will wear — or actually wore"
              : "Swap or edit pieces"}
          </h3>
          <fieldset data-private className="max-h-80 space-y-2 overflow-y-auto">
            <legend>Choose 1–12 owned pieces</legend>
            {data?.items.map((item) => (
              <label key={item.id} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={pieces.includes(item.id)}
                  onChange={(e) =>
                    setPieces((current) =>
                      e.target.checked
                        ? [...current, item.id].slice(0, 12)
                        : current.filter((id) => id !== item.id),
                    )
                  }
                />
                {item.category}: {item.description}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !pieces.length}
              onClick={() =>
                void run({
                  operation: "planning_edit",
                  id: editing.id,
                  itemIds: pieces,
                })
              }
            >
              Save pieces
            </Button>
            {editing.status === "planned" && (
              <Button
                type="button"
                disabled={busy || !pieces.length}
                onClick={() =>
                  void run({
                    operation: "planning_worn",
                    id: editing.id,
                    itemIds: pieces,
                  })
                }
              >
                Confirm worn
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Cancel edit
            </Button>
          </div>
        </section>
      )}
      {dismissing && (
        <section className="space-y-3 border p-4">
          <label>
            Why dismiss?
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="ml-2 border p-2"
            >
              {[
                "Not my style",
                "Wrong for the occasion",
                "Pieces unavailable",
                "Weather mismatch",
                "Other",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                void run({
                  operation: "planning_dismiss",
                  id: dismissing,
                  reason,
                })
              }
            >
              Dismiss outfit
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDismissing(null)}
            >
              Keep outfit
            </Button>
          </div>
        </section>
      )}
    </section>
  );
}
