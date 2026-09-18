import React from "react";
import { createRoot } from "react-dom/client";
import DayPlanner from "../../src/components/DayPlanner";
import { UnifiedCaptureController, UnifiedCaptureTrigger } from "../../src/components/UnifiedCapture";

const scenario = new URLSearchParams(location.search).get("scenario") ?? "planner";
createRoot(document.getElementById("root")!).render(<>
  <header><h1>Wardrobe validation gallery</h1><p>Synthetic data · real UI components · external boundaries simulated</p></header>
  {scenario === "capture" ? <><UnifiedCaptureTrigger variant="desktop" /><UnifiedCaptureController /></> : <DayPlanner />}
</>);
