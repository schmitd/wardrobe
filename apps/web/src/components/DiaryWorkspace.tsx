"use client";
import Image from "next/image";
import { useMemo, Suspense, lazy } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "./ui/button";
import GarmentObservationReview from "./GarmentObservationReview";
import HomeSectionBoundary from "./HomeSectionBoundary";
import {
  HistoryLoading,
  RecentFitFrame,
  DiaryCalendar,
  diaryDays,
  RecentFitsLoading,
} from "./FitsLoading";
import { FIT_GRID } from "./LayoutGeometry";
import { revealDecodedImage } from "@/lib/revealDecodedImage";
const WornOutfits = lazy(() => import("./WornOutfits"));
const dayKey = (date: Date | number) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

export default function DiaryWorkspace({
  visible = true,
}: {
  visible?: boolean;
}) {
  const history = usePaginatedQuery(
    api.fitChecks.pageFitChecks,
    {},
    { initialNumItems: 20 },
  );
  const fitChecks = history.results;
  const dailyChecks = useMemo(
    () => (fitChecks ?? []).filter((check) => check.type === "daily_fit_check"),
    [fitChecks],
  );
  const checkByDay = useMemo(
    () => new Map(dailyChecks.map((check) => [dayKey(check.createdAt), check])),
    [dailyChecks],
  );
  const days = useMemo(() => diaryDays(), []);

  return (
    <div id="fits-diary" className="space-y-6">
      <DiaryCalendar
        cells={days.map((date) => {
          const key = dayKey(date);
          const check = checkByDay.get(key);
          const today = key === dayKey(new Date());
          const content = check?.imageUrl ? (
            <Image
              src={check.imageUrl}
              alt={`Fit from ${date.toLocaleDateString()}`}
              fill
              sizes="72px"
              onLoad={revealDecodedImage}
              className="object-cover"
            />
          ) : null;
          return check ? (
            <a
              key={key}
              href={`#fit-${String(check._id)}`}
              aria-label={`View fit from ${date.toLocaleDateString()}`}
              className={`relative aspect-square overflow-hidden border ${today ? "border-[#241426] ring-2 ring-[#DCE66E] ring-offset-1" : "border-[var(--rack-line)]"} bg-[var(--rack-wash)] hover:-translate-y-0.5`}
            >
              {content}
            </a>
          ) : (
            <span
              key={key}
              aria-label={`${date.toLocaleDateString()}: ${history.status === "Exhausted" ? "no fit recorded" : "history not loaded"}`}
              className={`aspect-square border ${today ? "border-[#241426] bg-[#DCE66E]" : "border-[#d8c9dc] bg-[#fbf9fa]"}`}
            />
          );
        })}
      />

      <section>
        <h2 className="text-xl font-extrabold text-[#241426]">Recent fits</h2>
        {history.status === "CanLoadMore" && (
          <Button variant="outline" onClick={() => history.loadMore(20)}>
            Load earlier fits
          </Button>
        )}
        {history.status === "Exhausted" && fitChecks.length === 0 && (
          <p className="mt-4">No fits recorded yet.</p>
        )}
        {history.status === "LoadingFirstPage" ? (
          <RecentFitsLoading />
        ) : (
          <div className={`mt-4 ${FIT_GRID}`}>
            {fitChecks.map((fitCheck) => (
              <RecentFitFrame
                key={String(fitCheck._id)}
                id={`fit-${String(fitCheck._id)}`}
                image={
                  fitCheck.imageUrl && (
                    <Image
                      src={fitCheck.imageUrl}
                      alt={fitCheck.transcription ?? fitCheck.type}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      onLoad={revealDecodedImage}
                      className="object-cover"
                    />
                  )
                }
                metadata={
                  <>
                    {fitCheck.type === "try_on" ? "Try on" : "Fit check"} ·{" "}
                    {new Date(fitCheck.createdAt).toLocaleDateString()}
                  </>
                }
                notes={
                  fitCheck.transcription ??
                  fitCheck.description ??
                  "No notes yet."
                }
                review={
                  fitCheck.type === "daily_fit_check" && (
                    <GarmentObservationReview
                      observations={fitCheck.observations}
                    />
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
      <HomeSectionBoundary
        title="Outfit history"
        retryLabel="Reload history"
        reloadOnRetry
      >
        <Suspense fallback={<HistoryLoading />}>
          <WornOutfits visible={visible} />
        </Suspense>
      </HomeSectionBoundary>
    </div>
  );
}
