import type { ReactNode } from "react";
import { localDate, sevenDays } from "@wardrobe/shared";
import { CalendarDays } from "lucide-react";
import { Button } from "./ui/button";
import {
  HISTORY_CARD,
  HISTORY_GRID,
  HISTORY_PHOTOS,
  HISTORY_TITLE,
  HISTORY_META,
} from "./LayoutGeometry";

export function PlannerHeader({
  week = localDate(),
  selected = week,
  onSelect,
  onCalendar,
  status,
}: {
  week?: string;
  selected?: string;
  onSelect?: (date: string) => void;
  onCalendar?: () => void;
  status?: (date: string) => string | undefined;
}) {
  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold sm:text-xl">This week</h2>
        <Button
          variant="outline"
          aria-label="Calendar"
          disabled={!onCalendar}
          onClick={onCalendar}
        >
          <CalendarDays />
          <span className="hidden sm:inline">Calendar</span>
        </Button>
      </header>
      <div className="planner-day-rail">
        {sevenDays(week).map((date) => {
          const state = status?.(date);
          const d = new Date(`${date}T12:00:00`);
          return (
            <button
              key={date}
              type="button"
              disabled={!onSelect}
              aria-pressed={date === selected}
              aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}, ${state ?? "Loading outfits"}`}
              onClick={() => onSelect?.(date)}
              className={`planner-day ${date === selected ? "planner-day--selected" : ""}`}
            >
              <span className="block font-medium">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="block text-xl tabular-nums">{d.getDate()}</span>
              <span
                className="planner-day-dot"
                aria-label={
                  state === undefined
                    ? "Loading outfits"
                    : state === "No suggestion"
                      ? "No outfit yet"
                      : "Outfit saved"
                }
              >
                {state && state !== "No suggestion" ? "•" : "·"}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
export function PlanLoading() {
  return (
    <section
      id="plans"
      aria-label="Week outfit planner"
      aria-busy="true"
      className="space-y-4 text-[#241426]"
    >
      <PlannerHeader />
      <article className="space-y-4">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h3>
        </div>
        <div className="planner-outfit-photo">
          <p role="status">Loading your outfits…</p>
        </div>
        <div className="planner-outfit-title" />
        <div className="min-h-11" />
        <div
          className="min-h-12 rounded-lg border border-[#c8b9ce] bg-white p-3"
          aria-hidden="true"
        />
        <div className="planner-action-row" />
      </article>
    </section>
  );
}
export function HistoryLoading() {
  return (
    <section
      className="space-y-4"
      aria-label="Saved outfit history"
      aria-busy="true"
    >
      <h2 className="text-xl font-semibold">Your outfit history</h2>
      <p className="sr-only" role="status">
        Loading saved outfits…
      </p>
      <div className={HISTORY_GRID}>
        {[0, 1, 2].map((i) => (
          <article
            data-history-card
            key={i}
            aria-hidden="true"
            className={`${HISTORY_CARD} ${i === 0 ? "" : i === 1 ? "hidden sm:block" : "hidden lg:block"}`}
          >
            <div className={HISTORY_META}>
              <span className="loading-text-line !mt-0" />
            </div>
            <h3 className={HISTORY_TITLE}>
              <span className="loading-text-line !mt-0" />
            </h3>
            <div className={HISTORY_PHOTOS}>
              <div className="loading-image-region" />
            </div>
            <div className="min-h-11" />
            <div className="h-5">
              <span className="loading-text-line !mt-0" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function RecentFitFrame({
  id,
  image,
  metadata,
  notes,
  review,
  loading = false,
  className = "",
}: {
  id?: string;
  image?: ReactNode;
  metadata: ReactNode;
  notes: ReactNode;
  review?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <article
      data-fit-card
      id={id}
      aria-hidden={loading || undefined}
      className={`overflow-hidden border border-[var(--rack-line)] bg-white shadow-[3px_3px_0_var(--rack-panel-shadow)] ${className}`}
    >
      <div className="relative aspect-[4/3] bg-[var(--rack-wash)]">{image}</div>
      <div className="p-4">
        <p className="h-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#56345c]">
          {metadata}
        </p>
        <div className="mt-2 min-h-11 text-sm font-medium leading-relaxed text-[#241426]">
          {notes}
        </div>
        {review}
      </div>
    </article>
  );
}
export function diaryDays() {
  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (83 - index));
    return date;
  });
}
export function DiaryCalendar({ cells }: { cells: ReactNode }) {
  return (
    <section className="rack-panel rounded-none">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-xl font-extrabold text-[#241426]">Outfit diary</h2>
        <span className="text-xs font-semibold text-[#56345c]">
          Last 12 weeks
        </span>
      </div>
      <div
        className="mt-5 grid grid-cols-12 gap-1.5 sm:gap-2"
        aria-label="Daily fit calendar"
      >
        {cells}
      </div>
    </section>
  );
}
export function RecentFitsLoading() {
  return (
    <>
      <p className="sr-only" role="status">
        Loading recent fits…
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <RecentFitFrame
            key={i}
            className={
              i === 0 ? "" : i === 1 ? "hidden md:block" : "hidden xl:block"
            }
            loading
            metadata={<span className="loading-text-line !mt-0" />}
            notes={<span className="loading-text-line !mt-0" />}
          />
        ))}
      </div>
    </>
  );
}
export function DiaryLoading() {
  return (
    <div id="fits-diary" className="space-y-6" aria-busy="true">
      <DiaryCalendar
        cells={diaryDays().map((date) => (
          <span
            key={date.getTime()}
            aria-label={`${date.toLocaleDateString()}: history not loaded`}
            className="aspect-square border border-[#d8c9dc] bg-[#fbf9fa]"
          />
        ))}
      />
      <section>
        <h2 className="text-xl font-extrabold text-[#241426]">Recent fits</h2>
        <RecentFitsLoading />
      </section>
      <HistoryLoading />
    </div>
  );
}
