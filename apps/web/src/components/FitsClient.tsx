"use client";
import Link from "next/link";
import { Suspense, lazy, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { FITS_MAIN } from "@/components/LayoutGeometry";
import { PlanLoading, DiaryLoading } from "@/components/FitsLoading";
import HomeSectionBoundary from "@/components/HomeSectionBoundary";
const DayPlanner = lazy(() => import("@/components/DayPlanner"));
const DiaryWorkspace = lazy(() => import("@/components/DiaryWorkspace"));
type View = "plan" | "diary";
function FitsFrame({
  view,
  children,
}: {
  view?: View;
  children: React.ReactNode;
}) {
  return (
    <main className={FITS_MAIN}>
      <section>
        <h1 className="text-3xl font-bold text-[#241426]">Fits</h1>
        <nav
          className="mt-2 flex gap-3 border-b border-[#d8c9dc]"
          aria-label="Fits views"
        >
          {(["plan", "diary"] as const).map((tab) => (
            <Link
              key={tab}
              href={`/fits?view=${tab}`}
              aria-current={view === tab ? "page" : undefined}
              className={`flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold ${view === tab ? "border-[#241426] text-[#241426]" : "border-transparent text-[#56345c]"}`}
            >
              {tab === "plan" ? "Plan" : "Diary"}
            </Link>
          ))}
        </nav>
      </section>
      {children}
    </main>
  );
}
export default function FitsClient({
  initialView = "plan",
}: {
  initialView?: View;
}) {
  return (
    <Suspense
      fallback={
        <FitsFrame view={initialView}>
          {initialView === "diary" ? <DiaryLoading /> : <PlanLoading />}
        </FitsFrame>
      }
    >
      <FitsContent />
    </Suspense>
  );
}
function FitsContent() {
  const params = useSearchParams();
  const view: View = params.get("view") === "diary" ? "diary" : "plan";
  const auth = useAuth();
  const backend = useConvexAuth();
  const ready =
    auth.isLoaded &&
    Boolean(auth.userId) &&
    !backend.isLoading &&
    backend.isAuthenticated;
  return (
    <FitsFrame view={view}>
      {ready ? (
        <VisitedFits key={`${auth.userId}:${auth.sessionId}`} view={view} />
      ) : auth.isLoaded && !auth.userId ? (
        <p>Sign in to keep a visual record of what you wear.</p>
      ) : (
        <>
          <p
            role={auth.isLoaded && !backend.isLoading ? "alert" : "status"}
            className={
              auth.isLoaded && !backend.isLoading
                ? "text-sm font-semibold"
                : "sr-only"
            }
          >
            {auth.isLoaded && !backend.isLoading
              ? "Account connection unavailable. Return to Wardrobe to retry or continue as guest."
              : "Loading account…"}
          </p>
          {view === "plan" ? <PlanLoading /> : <DiaryLoading />}
          {auth.isLoaded && !backend.isLoading && (
            <Link
              href="/"
              className="inline-flex min-h-11 items-center underline"
            >
              Back to Wardrobe
            </Link>
          )}
        </>
      )}
    </FitsFrame>
  );
}
function VisitedFits({ view }: { view: View }) {
  const [visited, setVisited] = useState({
    plan: view === "plan",
    diary: view === "diary",
  });
  if (!visited[view]) setVisited({ ...visited, [view]: true });
  return (
    <>
      {(["plan", "diary"] as const).map((tab) => (
        <div
          key={tab}
          hidden={view !== tab}
          style={{ display: view === tab ? "contents" : "none" }}
        >
          {(visited[tab] || view === tab) && (
            <HomeSectionBoundary
              title={tab === "plan" ? "Plan" : "Diary"}
              retryLabel={`Reload ${tab}`}
              reloadOnRetry
            >
              <Suspense
                fallback={tab === "plan" ? <PlanLoading /> : <DiaryLoading />}
              >
                {tab === "plan" ? (
                  <DayPlanner visible={view === tab} />
                ) : (
                  <HomeSectionBoundary
                    title="Recent fits"
                    retryLabel="Retry fits"
                  >
                    <DiaryWorkspace visible={view === tab} />
                  </HomeSectionBoundary>
                )}
              </Suspense>
            </HomeSectionBoundary>
          )}
        </div>
      ))}
    </>
  );
}
