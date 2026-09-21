import type { WardrobeItem } from "@wardrobe/shared";
export function collectionFixture() {
  return {
    bio: "Easy layers, earthy tones, and a little structure. Comfortable enough for everyday, considered enough for anything.",
    items: [
      {
        category: "Overshirt",
        description: "Navy cotton overshirt with a relaxed fit",
        styleTags: ["Navy", "Cotton", "Relaxed fit"],
        note: "Roll the sleeves once. Good with cream trousers.",
      },
      {
        category: "Trousers",
        description: "Cream straight-leg trousers",
        styleTags: ["Cream", "Cotton", "Straight leg"],
        note: "",
      },
      {
        category: "Jacket",
        description: "Light olive workwear jacket",
        styleTags: ["Olive", "Light layer"],
        note: "",
      },
      {
        category: "Loafers",
        description: "Warm brown leather loafers",
        styleTags: ["Brown", "Leather"],
        note: "",
      },
    ].map((item, i) => ({
      ...item,
      id: `piece-${i}`,
      imageUrl: `/__fixture/piece-${i}.svg`,
      analysisStatus: "ready",
      createdAt: i,
    })) as WardrobeItem[],
    collections: [
      {
        _id: "work",
        name: "Work edit",
        description: "Relaxed tailoring for client meetings",
      },
      {
        _id: "weekend",
        name: "Weekend",
        description: "Easy pieces for days off",
      },
      {
        _id: "ideas",
        name: "Saved ideas",
        description: "Shapes and textures to try",
      },
    ],
    memberships: [
      { wardrobeId: "work", itemId: "piece-0" },
      { wardrobeId: "work", itemId: "piece-1" },
      { wardrobeId: "weekend", itemId: "piece-2" },
    ],
  };
}
export function pieceSvg(index: number) {
  const color =
    ["#32445c", "#e3d6bd", "#778064", "#8c583b"][index] ?? "#c7b7d2";
  const shape =
    index === 1
      ? '<path d="M66 35H174L184 252H131L120 110L108 252H54Z"/><path d="M70 47H171M120 48V105"/>'
      : index === 3
        ? '<path d="M35 155Q64 94 110 113L133 178Q91 215 25 186Z"/><path d="M141 68Q202 58 215 116L194 199Q158 198 138 169Z"/><path d="M39 149L111 155M150 115L211 127"/>'
        : '<path d="M77 36L43 51L15 148L54 162L73 98L68 246H172L167 98L186 162L225 148L197 51L163 36L145 24H95Z"/><path d="M97 25L120 65L143 25M120 65V246M78 93H108V124H78ZM132 93H162V124H132Z"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="280" viewBox="0 0 240 280"><g fill="${color}" stroke="#29212a" stroke-width="2" stroke-linejoin="round">${shape}</g></svg>`;
}
