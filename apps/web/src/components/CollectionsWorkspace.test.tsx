import { afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React, { useState } from "react";
import { getFunctionName } from "convex/server";
GlobalRegistrator.register();
let failed = false;
let restores = 0;
let inspirationJourney = false;
let inspirationRemoved = false;
let inspirationFailure = false;
const writes: unknown[] = [];
const reference = { _id: "synthetic-reference", membershipId: "synthetic-member", imageUrl: null, description: "Synthetic reference", category: null };
const removedCollection = { _id: "synthetic-collection", name: "Synthetic removed collection", description: null, previews: [] };
mock.module("convex/react", () => ({
  useMutation: (api: unknown) => {
    const [restored, setRestored] = useState(false);
    void restored;
    return async (args: { removed?: boolean }) => {
      if (getFunctionName(api as never) === "wardrobe:setInspirationRemoved") {
        writes.push(args);
        if (inspirationFailure) throw new Error("Synthetic failure");
        inspirationRemoved = Boolean(args.removed);
        setRestored(value => !value);
        return;
      }
      if (getFunctionName(api as never) === "wardrobe:archiveCollection") {
        restores++;
        if (failed) throw new Error("Synthetic restore failure");
        removedCollection.name = "Synthetic restored collection";
        setRestored(true);
      }
    };
  },
  usePaginatedQuery: (api: unknown, args: { archived?: boolean } | string) => {
    if (getFunctionName(api as never) === "wardrobe:pageCollections" && typeof args === "object") {
      const restored = inspirationJourney || removedCollection.name === "Synthetic restored collection";
      return { results: args.archived ? restored ? [] : [removedCollection] : restored ? [removedCollection] : [], status: "Exhausted", loadMore() {} };
    }
    if (getFunctionName(api as never) === "wardrobe:pageInspiration" && typeof args === "object") {
      return { results: inspirationRemoved === Boolean((args as {removed?:boolean}).removed) ? [reference] : [], status: "Exhausted", loadMore() {} };
    }
    return { results: [], status: "Exhausted", loadMore() {} };
  },
}));
mock.module("./WardrobeGrid", () => ({default: () => null}));
mock.module("./ItemDetailsDrawer", () => ({default: () => null}));
mock.module("./InspirationIntake", () => ({default: () => <button>Add inspiration</button>}));
mock.module("./TaskSheet", () => ({default: ({open,children,footer}: {open:boolean;children:React.ReactNode;footer:React.ReactNode}) => open ? <div role="dialog">{children}{footer}</div> : null}));
mock.module("posthog-js", () => ({default:{capture() {}}}));
const {render,screen,fireEvent,cleanup,waitFor} = await import("@testing-library/react");
const { default: CollectionsWorkspace } = await import("./CollectionsWorkspace");
afterEach(() => {cleanup();failed=false;restores=0;removedCollection.name="Synthetic removed collection";inspirationJourney=false;inspirationRemoved=false;inspirationFailure=false;writes.length=0;});
const props = {items:[],optimisticItems:[]} as unknown as React.ComponentProps<typeof CollectionsWorkspace>;
test("collection Restore error is visible outside the closed task sheet; retry restores and clears error", async () => {
  failed=true;
  render(<CollectionsWorkspace {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Removed collections"}));
  fireEvent.click(screen.getByRole("button",{name:"Restore"}));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("try again"));
  expect(screen.queryByRole("dialog")).toBeNull();
  failed=false;
  fireEvent.click(screen.getByRole("button",{name:"Restore"}));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(restores).toBe(2);
  expect(screen.getByRole("button",{name:"Synthetic restored collection"})).toBeTruthy();
  expect(screen.queryByRole("button",{name:"Restore"})).toBeNull();
});
test("ordinary successful Restore returns collection to the rail without an error", async () => {
  render(<CollectionsWorkspace {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Removed collections"}));
  fireEvent.click(screen.getByRole("button",{name:"Restore"}));
  await waitFor(() => expect(screen.getByRole("button",{name:"Synthetic restored collection"})).toBeTruthy());
  expect(screen.queryByRole("alert")).toBeNull();
  expect(restores).toBe(1);
});

test("true collections entry exposes inspiration Remove, supports Cancel/error/retry, recovery and remount", async () => {
  inspirationJourney=true;
  const view=render(<CollectionsWorkspace {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Synthetic removed collection"}));
  fireEvent.click(screen.getByRole("button",{name:"inspiration"}));
  expect(screen.getByRole("button",{name:"Add inspiration"})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Remove"}));
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  expect(writes).toEqual([]);
  inspirationFailure=true;
  fireEvent.click(screen.getByRole("button",{name:"Remove"}));
  fireEvent.click(screen.getByRole("button",{name:"Remove inspiration"}));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Try again"));
  inspirationFailure=false;
  fireEvent.click(screen.getByRole("button",{name:"Remove inspiration"}));
  await waitFor(() => expect(screen.getByRole("button",{name:"Restore"})).toBeTruthy());
  expect(screen.getByText("Save a photo to begin your moodboard.")).toBeTruthy();
  expect(writes.at(-1)).toEqual({wardrobeId:"synthetic-collection",membershipId:"synthetic-member",removed:true});
  view.unmount();
  render(<CollectionsWorkspace {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Synthetic removed collection"}));
  fireEvent.click(screen.getByRole("button",{name:"inspiration"}));
  expect(screen.queryByRole("button",{name:"Remove"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Removed inspiration"}));
  fireEvent.click(screen.getByRole("button",{name:"Restore"}));
  await waitFor(() => expect(screen.getByRole("button",{name:"Remove"})).toBeTruthy());
  expect(writes.at(-1)).toEqual({wardrobeId:"synthetic-collection",membershipId:"synthetic-member",removed:false});
});
