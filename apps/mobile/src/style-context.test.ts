import { describe, expect, test } from "bun:test";

import { styleContextNote } from "./style-context";

describe("styleContextNote", () => {
  test("collapses ontology attributes into one readable note", () => {
    expect(styleContextNote({
      skinTone: "medium",
      complexion: "warm",
      hairColor: "brown",
      colorSeason: "autumn",
      bodyType: "tall",
    })).toBe("medium skin tone, warm complexion, brown hair, autumn color palette, and tall fit context.");
  });

  test("omits missing attributes without empty punctuation", () => {
    expect(styleContextNote({ hairColor: "black", colorSeason: "winter" }))
      .toBe("black hair and winter color palette.");
    expect(styleContextNote(null)).toBeNull();
  });
});
