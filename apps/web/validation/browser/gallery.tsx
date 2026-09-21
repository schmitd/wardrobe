import React from "react";
import { createRoot } from "react-dom/client";
import DayPlanner from "../../src/components/DayPlanner";
import Navbar from "../../src/components/Navbar";
import FitsPage from "../../src/app/fits/page";
import CollectionsWorkspace from "../../src/components/CollectionsWorkspace";
import StyleNotes from "../../src/components/StyleNotes";
import { UnifiedCaptureController, UnifiedCaptureTrigger } from "../../src/components/UnifiedCapture";
import { useQuery } from "./boundaries";
import { localDate, shiftDay } from "@wardrobe/shared";
import type { WardrobeItem } from "@wardrobe/shared";
function WardrobeFixture() {
  const items = useQuery<WardrobeItem[]>("wardrobe.pageWardrobeItems", {});
  return <><Navbar /><main className="mx-auto max-w-[1320px] space-y-5 px-4 pb-28 pt-6 sm:px-6 lg:px-10"><StyleNotes /><CollectionsWorkspace items={items ?? []} loading={!items} /></main></>;
}
const scenario = new URLSearchParams(location.search).get("scenario") ?? (location.pathname === "/" ? "wardrobe" : "fits");
createRoot(document.getElementById("root")!).render(<>
  <div className="fixture-banner">Interactive prototype · synthetic data</div>
  {scenario === "wardrobe" ? <WardrobeFixture /> : scenario === "fits" ? <><Navbar /><FitsPage /></> : scenario === "capture" ? <><UnifiedCaptureTrigger variant="desktop" /><UnifiedCaptureController /></> : <main className="p-5"><DayPlanner historyDate={scenario === "history" ? shiftDay(localDate(), -1) : undefined} /></main>}
</>);
