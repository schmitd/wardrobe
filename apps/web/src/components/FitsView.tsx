"use client";
import { lazy, Suspense } from "react";
import HomeSectionBoundary from "./HomeSectionBoundary";
import { PlanLoading, DiaryLoading } from "./FitsLoading";
const DayPlanner = lazy(() => import("./DayPlanner"));
const DiaryWorkspace = lazy(() => import("./DiaryWorkspace"));
export default function FitsView({ view }: { view: "plan" | "diary" }) {
  return (
    <HomeSectionBoundary
      title={view === "plan" ? "Plan" : "Diary"}
      retryLabel={`Reload ${view}`}
      reloadOnRetry
    >
      <Suspense fallback={view === "plan" ? <PlanLoading /> : <DiaryLoading />}>
        {view === "plan" ? (
          <DayPlanner />
        ) : (
          <HomeSectionBoundary title="Recent fits" retryLabel="Retry fits">
            <DiaryWorkspace />
          </HomeSectionBoundary>
        )}
      </Suspense>
    </HomeSectionBoundary>
  );
}
