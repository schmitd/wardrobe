export type Piece = { id: string; name: string; detail: string; cell: number };
export const wardrobe: Piece[] = [
  { id: "shirt", name: "Ecru shirt", detail: "Cotton · relaxed fit", cell: 0 },
  {
    id: "trousers",
    name: "Charcoal trousers",
    detail: "Straight leg",
    cell: 1,
  },
  { id: "loafers", name: "Brown loafers", detail: "Soft leather", cell: 2 },
  {
    id: "polo",
    name: "Navy knit polo",
    detail: "Cotton · soft collar",
    cell: 3,
  },
  {
    id: "chinos",
    name: "Olive trousers",
    detail: "Cotton · straight leg",
    cell: 4,
  },
  {
    id: "trainers",
    name: "White trainers",
    detail: "Leather · low top",
    cell: 5,
  },
];
export const alternatives: Record<string, string[]> = {
  shirt: ["shirt", "polo"],
  polo: ["shirt", "polo"],
  trousers: ["trousers", "chinos"],
  chinos: ["trousers", "chinos"],
  loafers: ["loafers", "trainers"],
  trainers: ["loafers", "trainers"],
};
export type Suggestion = {
  day: string;
  description: string;
  pieces: string[];
  status: "suggested" | "planned" | "worn";
};
export type DayNote = { day: string; text: string };
export type State = {
  version: 2;
  week: string;
  day: string;
  description: string;
  connected: boolean;
  calendars: string[];
  useCalendar: boolean;
  plan: string | null;
  outfits: Record<string, Suggestion>;
  notes: Record<string, string>;
  review: DayNote[];
  notice: string | null;
};
export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(day: string, count: number) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + count);
  return localDay(d);
}
export function weekDays(start: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
export function validDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    localDay(new Date(`${value}T12:00:00`)) === value
  );
}
const events = [
  "",
  "Office",
  "Office",
  "Client meeting",
  "Work from home",
  "Dinner · 7 PM",
  "",
];
export function calendarEvent(
  day: string,
  state: Pick<State, "connected" | "useCalendar" | "calendars">,
) {
  if (!state.connected || !state.useCalendar) return "";
  const weekday = new Date(`${day}T12:00:00`).getDay();
  return state.calendars.includes(weekday === 5 ? "Personal" : "Work")
    ? events[weekday]
    : "";
}
export function makeSuggestion(
  day: string,
  description: string,
  variant = 0,
): Suggestion {
  const casual = /hik|walk|home|free|weekend/i.test(description);
  return {
    day,
    description,
    pieces: casual
      ? ["polo", "chinos", "trainers"]
      : variant % 2
        ? ["polo", "trousers", "loafers"]
        : ["shirt", "trousers", "loafers"],
    status: "suggested",
  };
}
export function initialState(): State {
  const day = localDay(new Date());
  const base: State = {
    version: 2,
    week: day,
    day,
    description: "",
    connected: true,
    calendars: ["Personal", "Work"],
    useCalendar: true,
    plan: null,
    outfits: {},
    notes: {},
    review: [],
    notice: null,
  };
  for (const date of weekDays(day))
    base.outfits[date] = makeSuggestion(
      date,
      calendarEvent(date, base) || "Free day",
      new Date(`${date}T12:00:00`).getDay(),
    );
  return base;
}
const dayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
/** Deterministic prototype adapter. Production uses model-backed interpretation. */
export function interpretWeek(
  text: string,
  week: string,
): { notes: DayNote[]; unresolved: boolean } {
  const matches = [
    ...text.matchAll(
      /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
    ),
  ];
  const notes = new Map<string, string>();
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const day = weekDays(week).find(
      (d) =>
        new Date(`${d}T12:00:00`).getDay() ===
        dayNames.indexOf(match[1].toLowerCase()),
    )!;
    const context = text
      .slice(
        match.index! + match[0].length,
        matches[i + 1]?.index ?? text.length,
      )
      .trim()
      .replace(/^[,:\s]+|[.;,\s]+$/g, "");
    if (context)
      notes.set(day, [notes.get(day), context].filter(Boolean).join("; "));
  }
  return {
    notes: [...notes].map(([day, text]) => ({ day, text })),
    unresolved:
      !matches.length ||
      /\b(next week|tomorrow|tonight|today)\b/i.test(text) ||
      !!text.slice(0, matches[0]?.index ?? 0).trim(),
  };
}
export type Action =
  | { type: "day"; day: string }
  | { type: "week"; week: string }
  | { type: "description"; text: string }
  | { type: "connect"; calendars: string[] }
  | { type: "use-calendar"; enabled: boolean }
  | { type: "plan-context"; plan: string | null }
  | { type: "generate"; days?: DayNote[] }
  | { type: "review"; notes: DayNote[] }
  | { type: "swap"; old: string; next: string }
  | { type: "another" }
  | { type: "accept" }
  | { type: "worn" }
  | { type: "reset" };
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "day":
      return validDay(action.day) ? { ...state, day: action.day } : state;
    case "week":
      return validDay(action.week)
        ? { ...state, week: action.week, notice: null }
        : state;
    case "description":
      return { ...state, description: action.text.slice(0, 4000), review: [] };
    case "review":
      return {
        ...state,
        review: action.notes
          .filter((n) => validDay(n.day))
          .map((n) => ({ day: n.day, text: n.text.slice(0, 4000) })),
      };
    case "connect": {
      const calendars = [
        ...new Set(
          action.calendars.filter((c) => c === "Personal" || c === "Work"),
        ),
      ];
      return {
        ...state,
        connected: calendars.length > 0,
        calendars,
        useCalendar: calendars.length > 0,
      };
    }
    case "use-calendar":
      return { ...state, useCalendar: state.connected && action.enabled };
    case "plan-context":
      return { ...state, plan: action.plan };
    case "generate": {
      const outfits = { ...state.outfits };
      const notes = { ...state.notes };
      let changed = 0;
      let protectedCount = 0;
      for (const n of action.days ??
        weekDays(state.week).map((day) => ({
          day,
          text: state.notes[day] || "",
        }))) {
        if (!validDay(n.day)) continue;
        if (outfits[n.day] && outfits[n.day].status !== "suggested") {
          protectedCount++;
          continue;
        }
        notes[n.day] = n.text;
        outfits[n.day] = makeSuggestion(
          n.day,
          [calendarEvent(n.day, state), n.text].filter(Boolean).join(" · ") ||
            "Free day",
        );
        changed++;
      }
      return {
        ...state,
        outfits,
        notes,
        review: [],
        notice: `${changed} ${changed === 1 ? "day updated" : "days updated"}${protectedCount ? ` · ${protectedCount} planned or worn ${protectedCount === 1 ? "outfit kept" : "outfits kept"}` : ""}`,
      };
    }
    case "swap": {
      const outfit = state.outfits[state.day];
      if (
        !outfit ||
        outfit.status === "worn" ||
        !alternatives[action.old]?.includes(action.next)
      )
        return state;
      return {
        ...state,
        outfits: {
          ...state.outfits,
          [state.day]: {
            ...outfit,
            pieces: outfit.pieces.map((p) =>
              p === action.old ? action.next : p,
            ),
          },
        },
      };
    }
    case "another": {
      const outfit = state.outfits[state.day];
      if (!outfit || outfit.status !== "suggested") return state;
      return {
        ...state,
        outfits: {
          ...state.outfits,
          [state.day]: {
            ...outfit,
            pieces: outfit.pieces.map(
              (p) => alternatives[p].find((a) => a !== p)!,
            ),
          },
        },
      };
    }
    case "accept":
    case "worn": {
      const outfit = state.outfits[state.day];
      const expected = action.type === "accept" ? "suggested" : "planned";
      if (!outfit || outfit.status !== expected) return state;
      return {
        ...state,
        outfits: {
          ...state.outfits,
          [state.day]: {
            ...outfit,
            status: action.type === "accept" ? "planned" : "worn",
          },
        },
      };
    }
    case "reset":
      return initialState();
  }
}
export function restoreState(raw: string | null): State {
  try {
    const s = JSON.parse(raw ?? "null") as State;
    if (
      !s ||
      s.version !== 2 ||
      !validDay(s.day) ||
      !validDay(s.week) ||
      typeof s.description !== "string" ||
      !Array.isArray(s.calendars) ||
      !s.outfits ||
      !s.notes ||
      !Array.isArray(s.review)
    )
      return initialState();
    for (const [day, outfit] of Object.entries(s.outfits))
      if (
        !validDay(day) ||
        outfit.day !== day ||
        !["suggested", "planned", "worn"].includes(outfit.status) ||
        !Array.isArray(outfit.pieces) ||
        outfit.pieces.some((id) => !wardrobe.some((p) => p.id === id))
      )
        return initialState();
    return {
      ...initialState(),
      ...s,
      description: s.description.slice(0, 4000),
    };
  } catch {
    return initialState();
  }
}
export const sampleDay =
  "Wednesday is a client meeting. Friday is dinner out. Sunday we’re hiking.";
