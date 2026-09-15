import { describe, expect, test } from "bun:test";
import {
  calendar,
  reserveGeneration,
  save,
  saveWeek,
  update,
} from "./planning";

type Row = { _id: string; userId: string; [key: string]: unknown };
const invoke = (fn: unknown, ctx: unknown, args: unknown) =>
  (
    fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> }
  )._handler(ctx, args);
function fixture(userId = "alice") {
  const tables: Record<string, Row[]> = {
    wardrobeItems: [
      { _id: "shirt", userId: "alice" },
      { _id: "coat", userId: "alice" },
      { _id: "foreign", userId: "bob" },
    ],
    outfitSuggestions: [
      {
        _id: "suggestion",
        userId: "alice",
        itemIds: ["shirt"],
        status: "suggested",
        calendarDerived: false,
      },
      {
        _id: "calendar-outfit",
        userId: "alice",
        itemIds: ["shirt"],
        status: "planned",
        calendarDerived: true,
      },
      {
        _id: "foreign-outfit",
        userId: "bob",
        itemIds: ["foreign"],
        status: "suggested",
        calendarDerived: true,
      },
    ],
    planningSettings: [
      {
        _id: "settings",
        userId: "alice",
        calendarEnabled: true,
        calendarIds: ["primary"],
        lastGenerationAt: 0,
      },
    ],
  };
  const db = {
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((r) => r._id === id) ?? null,
    patch: async (id: string, patch: object) => {
      const row = await db.get(id);
      if (row) Object.assign(row, patch);
    },
    delete: async (id: string) => {
      for (const key of Object.keys(tables))
        tables[key] = tables[key].filter((r) => r._id !== id);
    },
    insert: async (table: string, value: Row) => {
      const id = `${table}-${tables[table].length}`;
      tables[table].push({ ...value, _id: id });
      return id;
    },
    query: (table: string) => {
      let rows = tables[table];
      const chain = {
        withIndex: (_: string, filter: (q: unknown) => unknown) => {
          const indexQuery = {
            eq: (key: string, val: unknown) => {
              rows = rows.filter((r) => r[key] === val);
              return indexQuery;
            },
          };
          filter(indexQuery);
          return chain;
        },
        order: () => chain,
        take: async (n: number) => rows.slice(0, n),
        unique: async () => rows[0] ?? null,
      };
      return chain;
    },
  };
  return {
    tables,
    ctx: {
      db,
      auth: {
        getUserIdentity: async () => (userId ? { subject: userId } : null),
      },
    },
  };
}
describe("planning ownership and lifecycle", () => {
  test("requires authentication and ownership", async () => {
    await expect(
      invoke(update, fixture("").ctx, { id: "suggestion", status: "planned" }),
    ).rejects.toThrow();
    await expect(
      invoke(update, fixture("bob").ctx, {
        id: "suggestion",
        status: "planned",
      }),
    ).rejects.toThrow();
    await expect(
      invoke(update, fixture().ctx, { id: "suggestion", itemIds: ["foreign"] }),
    ).rejects.toThrow();
  });
  test("accepts, swaps, and records the actual worn pieces atomically", async () => {
    const f = fixture();
    await expect(
      invoke(update, f.ctx, { id: "suggestion", status: "worn" }),
    ).rejects.toThrow();
    await invoke(update, f.ctx, { id: "suggestion", status: "planned" });
    await invoke(update, f.ctx, {
      id: "suggestion",
      status: "worn",
      itemIds: ["coat"],
    });
    expect(await f.ctx.db.get("suggestion")).toMatchObject({
      status: "worn",
      itemIds: ["coat"],
    });
    await expect(
      invoke(update, f.ctx, { id: "suggestion", itemIds: ["shirt"] }),
    ).rejects.toThrow();
  });
  test("requires a dismissal reason and rejects deleted pieces on accept", async () => {
    const f = fixture();
    await expect(
      invoke(update, f.ctx, { id: "suggestion", status: "dismissed" }),
    ).rejects.toThrow();
    await f.ctx.db.delete("shirt");
    await expect(
      invoke(update, f.ctx, { id: "suggestion", status: "planned" }),
    ).rejects.toThrow();
    await invoke(update, f.ctx, {
      id: "suggestion",
      status: "dismissed",
      reason: "Pieces unavailable",
    });
  });
  test("disconnect removes only this user's calendar-derived outfits", async () => {
    const f = fixture();
    await invoke(calendar, f.ctx, { enabled: false, calendarIds: [] });
    expect(await f.ctx.db.get("calendar-outfit")).toBeNull();
    expect(await f.ctx.db.get("suggestion")).not.toBeNull();
    expect(await f.ctx.db.get("foreign-outfit")).not.toBeNull();
    expect(await f.ctx.db.get("settings")).toMatchObject({
      calendarEnabled: false,
      calendarIds: [],
    });
    await expect(
      invoke(save, f.ctx, {
        date: "2026-09-13",
        title: "Outfit",
        rationale: "Rationale",
        context: [],
        itemIds: ["shirt"],
        missing: [],
        calendarDerived: true,
      }),
    ).rejects.toThrow();
  });
  test("throttles generation separately from transcription", async () => {
    const f = fixture();
    await invoke(reserveGeneration, f.ctx, { transcription: true });
    await invoke(reserveGeneration, f.ctx, {});
    await invoke(reserveGeneration, f.ctx, { interpretation: true });
    await expect(
      invoke(reserveGeneration, f.ctx, { interpretation: true }),
    ).rejects.toThrow();
    await expect(invoke(reserveGeneration, f.ctx, {})).rejects.toThrow();
    await expect(
      invoke(reserveGeneration, f.ctx, { transcription: true }),
    ).rejects.toThrow();
  });
  test("week updates preserve concurrent planned outfits and other dates", async () => {
    const f = fixture();
    await f.ctx.db.patch("calendar-outfit", { date: "2026-09-18" });
    await f.ctx.db.patch("suggestion", { date: "2026-09-17" });
    const row = (date: string) => ({
      date,
      title: "Outfit",
      rationale: "Owned pieces",
      context: [],
      itemIds: ["coat"],
      missing: [],
    });
    expect(
      await invoke(saveWeek, f.ctx, {
        outfits: [row("2026-09-18"), row("2026-09-17"), row("2026-09-20")],
        calendarDerived: false,
      }),
    ).toEqual({ updated: 2, kept: 1 });
    expect(await f.ctx.db.get("calendar-outfit")).toMatchObject({
      status: "planned",
      itemIds: ["shirt"],
    });
    expect(await f.ctx.db.get("suggestion")).toMatchObject({
      itemIds: ["coat"],
    });
    expect(await f.ctx.db.get("foreign-outfit")).toMatchObject({
      userId: "bob",
    });
  });
  test("week retention preserves committed outfits and bounds private history", async () => {
    const f = fixture();
    f.tables.outfitSuggestions = Array.from({ length: 100 }, (_, i) => ({
      _id: `history-${i}`,
      userId: "alice",
      status: i === 99 ? "suggested" : "worn",
      date: `old-${i}`,
      itemIds: ["shirt"],
    }));
    await invoke(saveWeek, f.ctx, {
      calendarDerived: false,
      outfits: [
        {
          date: "2026-09-17",
          title: "Outfit",
          rationale: "Owned",
          context: [],
          itemIds: ["coat"],
          missing: [],
        },
      ],
    });
    expect(f.tables.outfitSuggestions.length).toBe(100);
    expect(await f.ctx.db.get("history-0")).not.toBeNull();
    expect(await f.ctx.db.get("history-99")).toBeNull();
    f.tables.outfitSuggestions.forEach((row) => (row.status = "worn"));
    await expect(
      invoke(saveWeek, f.ctx, {
        calendarDerived: false,
        outfits: [
          {
            date: "2026-09-18",
            title: "Outfit",
            rationale: "Owned",
            context: [],
            itemIds: ["coat"],
            missing: [],
          },
        ],
      }),
    ).rejects.toThrow("history is full");
  });
  test("week saves validate ownership, duplicates, and Calendar revision", async () => {
    const row = {
      date: "2026-09-17",
      title: "Outfit",
      rationale: "Owned pieces",
      context: [],
      itemIds: ["foreign"],
      missing: [],
    };
    await expect(
      invoke(saveWeek, fixture().ctx, {
        outfits: [row],
        calendarDerived: false,
      }),
    ).rejects.toThrow();
    await expect(
      invoke(saveWeek, fixture().ctx, {
        outfits: [row, row],
        calendarDerived: false,
      }),
    ).rejects.toThrow();
    await expect(
      invoke(saveWeek, fixture().ctx, {
        outfits: [{ ...row, itemIds: ["shirt"] }],
        calendarDerived: true,
        calendarRevision: 99,
      }),
    ).rejects.toThrow();
  });
  test("a reconnect cannot revive an in-flight recommendation from an old calendar grant", async () => {
    const f = fixture();
    await invoke(calendar, f.ctx, { enabled: false, calendarIds: [] });
    await invoke(calendar, f.ctx, {
      enabled: true,
      calendarIds: ["different"],
    });
    await expect(
      invoke(save, f.ctx, {
        date: "2026-09-13",
        title: "Outfit",
        rationale: "Rationale",
        context: [],
        itemIds: ["shirt"],
        missing: [],
        calendarDerived: true,
        calendarRevision: 0,
      }),
    ).rejects.toThrow();
  });
});
