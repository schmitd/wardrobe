import React from "react";
import ModuleRecoveryFixture from "./module-recovery-fixture";
import {GuestChoiceProvider} from "../../src/components/GuestChoice";
import Home from "../../src/components/HomeWorkspace";
import HomeContinuity from "../../src/components/HomeContinuity";
import NotificationFixture from "./notification-fixture";
import AppIdentityScope from "../../src/components/AppIdentityScope";
import AuthEntry from "../../src/components/AuthEntry";
import GuestClosetDemo from "../../src/components/GuestClosetDemo";
import { createRoot } from "react-dom/client";
import DayPlanner from "../../src/components/DayPlanner";
import Navbar from "../../src/components/Navbar";
import FitsPage from "../../src/app/fits/page";
import DataManagement from "../../src/components/DataManagement";
import CollectionsWorkspace from "../../src/components/CollectionsWorkspace";
import StyleNotes from "../../src/components/StyleNotes";
import { UnifiedCaptureController, UnifiedCaptureTrigger } from "../../src/components/UnifiedCapture";
import { useQuery } from "./boundaries";
import { localDate, shiftDay } from "@wardrobe/shared";
import type { WardrobeItem } from "@wardrobe/shared";
function WardrobeFixture() {
  const items = useQuery<WardrobeItem[]>("wardrobe.pageWardrobeItems", {});
  return <><Navbar /><a href="/account/data?scenario=data">Data management (synthetic account entry)</a><main className="mx-auto max-w-[1320px] space-y-5 px-4 pb-28 pt-6 sm:px-6 lg:px-10"><StyleNotes /><CollectionsWorkspace items={items ?? []} loading={!items} /></main></>;
}
const scenario = new URLSearchParams(location.search).get("scenario") ?? (location.pathname === "/" ? "wardrobe" : "fits");
createRoot(document.getElementById("root")!).render(<GuestChoiceProvider><AppIdentityScope>
  <div className="fixture-banner">Design review · synthetic data</div>
  {scenario === "data" ? <DataManagement /> : scenario === "module-recovery" ? <ModuleRecoveryFixture /> : scenario === "notifications" ? <NotificationFixture /> : scenario === "home-continuity" ? <><Navbar /><HomeContinuity><FitsPage /></HomeContinuity></> : scenario === "home-import" ? <><Navbar /><Home /></> : scenario === "guest" ? <main className="p-5"><AuthEntry ready={!new URLSearchParams(location.search).has("authPending")}><GuestClosetDemo /></AuthEntry></main> : scenario === "wardrobe" ? <WardrobeFixture /> : scenario === "fits" ? <><Navbar /><FitsPage /></> : scenario === "capture" ? <UnifiedCaptureController><UnifiedCaptureTrigger variant="desktop" /></UnifiedCaptureController> : <main className="p-5"><DayPlanner historyDate={scenario === "history" ? shiftDay(localDate(), -1) : undefined} /></main>}
</AppIdentityScope></GuestChoiceProvider>);
