"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { FITS_MAIN } from "@/components/LayoutGeometry";
import { PlanLoading, DiaryLoading } from "@/components/FitsLoading";
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
              href={`/fits/${tab}`}
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
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const view: View = pathname.endsWith("/diary") ? "diary" : "plan";
  const auth = useAuth();
  const backend = useConvexAuth();
  const ready =
    auth.isLoaded &&
    Boolean(auth.userId) &&
    !backend.isLoading &&
    backend.isAuthenticated;
  const unavailable =
    auth.isLoaded &&
    Boolean(auth.userId) &&
    !backend.isLoading &&
    !backend.isAuthenticated;
  return (
    <FitsFrame view={view}>
      {ready ? (
        <div
          key={`${auth.userId}:${auth.sessionId}`}
          style={{ display: "contents" }}
        >
          {children}
        </div>
      ) : auth.isLoaded && !auth.userId ? (
        <p>Sign in to keep a visual record of what you wear.</p>
      ) : (
        <>
          <p
            role={unavailable ? "alert" : "status"}
            className={unavailable ? "text-sm font-semibold" : "sr-only"}
          >
            {unavailable
              ? "Account connection unavailable. Return to Wardrobe to retry or continue as guest."
              : "Loading account…"}
          </p>
          {view === "diary" ? <DiaryLoading /> : <PlanLoading />}
          {unavailable && (
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
