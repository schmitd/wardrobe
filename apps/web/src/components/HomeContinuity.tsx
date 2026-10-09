"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import HomeWorkspace from "./HomeWorkspace";
import { HomeVisibilityContext } from "./homeVisibility";

/** Keep one live Home subscription after the first visit, across app routes. */
export default function HomeContinuity({ children }: { children: ReactNode }) {
  const visible = usePathname() === "/";
  const [visited, setVisited] = useState(visible);
  if (visible && !visited) setVisited(true);
  return <>
    <HomeVisibilityContext.Provider value={visible}>
      <div hidden={!visible} style={{ display: visible ? "contents" : "none" }}>
        {(visited || visible) && <HomeWorkspace />}
      </div>
    </HomeVisibilityContext.Provider>
    {!visible && children}
  </>;
}
