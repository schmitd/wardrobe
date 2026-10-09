import { expect, test } from "bun:test";
import React, { type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RackItemCard from "./RackItemCard";
const base: ComponentProps<typeof RackItemCard> = {
  compact: true,
  imageUrl: "/synthetic.svg",
  category: "Shirt",
  description: "Navy cotton shirt",
  styleTags: [],
};
const paint = (props: ComponentProps<typeof RackItemCard> = base) =>
  renderToStaticMarkup(<RackItemCard {...props} />);

test("card server paint already carries differentiated synced color; metadata change updates it immediately", () => {
  const navy = paint();
  expect(navy).toContain("--rack-item-accent:rgb(192 204 221)");
  const beige = paint({ ...base, description: "Beige cotton shirt" });
  expect(beige).toContain("--rack-item-accent:rgb(235 222 201)");
  expect(beige).not.toContain("rgb(192 204 221)");
  expect(paint({ ...base, imageUrl: "/replacement.svg" })).toContain(
    "--rack-item-accent:rgb(192 204 221)",
  );
});

test("missing color metadata falls back independently; only bounded named color data becomes a tint", () => {
  expect(paint({ ...base, description: "Woven top" })).toContain(
    "--rack-item-accent:rgb(240 255 189)",
  );
  expect(
    paint({ ...base, description: "Woven top", styleTags: ["Olive"] }),
  ).toContain("--rack-item-accent:rgb(215 219 187)");
  expect(
    paint({
      ...base,
      description: "redwood texture",
      styleTags: ["url(https://invalid.example)"],
    }),
  ).toContain("--rack-item-accent:rgb(240 255 189)");
});

test("loading cutout reserves its photo area and hanger without inventing rectangular garment pixels", () => {
  const html = paint({ ...base, loading: true });
  expect(html).toContain('class="rack-piece-photo"');
  expect(html).toContain('class="rack-piece-frame"');
  expect(html).toContain('class="rack-piece-caption"');
  expect(html).not.toContain("loading-image-region");
  expect(html).not.toContain("<img");
});
