"use client";
import { createContext } from "react";

/** Hidden Home keeps its query state, while its portal dialogs stay closed. */
export const HomeVisibilityContext = createContext(true);
