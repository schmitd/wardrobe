import { afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React, { useState } from "react";
import { getFunctionName } from "convex/server";
GlobalRegistrator.register();
let failed = false;
let collectionArchived = false;
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
    return async (args: { removed?: boolean; archived?:boolean }) => {
      if (getFunctionName(api as never) === "wardrobe:setInspirationRemoved") {
        writes.push(args);
        if (inspirationFailure) throw new Error("Synthetic failure");
        inspirationRemoved = Boolean(args.removed);
        setRestored(value => !value);
        return;
      }
      if (getFunctionName(api as never) === "wardrobe:archiveCollection") {
        writes.push(args);
        if (failed) throw new Error("Synthetic restore failure");
        collectionArchived = Boolean(args.archived);
        setRestored(value => !value);
      }
    };
  },
  usePaginatedQuery: (api: unknown, args: { archived?: boolean } | string) => {
    if (getFunctionName(api as never) === "wardrobe:pageCollections" && typeof args === "object") {
      const restored = inspirationJourney || removedCollection.name === "Synthetic restored collection";
      return { results: args.archived ? collectionArchived ? [removedCollection] : [] : restored && !collectionArchived ? [removedCollection] : [], status: "Exhausted", loadMore() {} };
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
afterEach(() => {cleanup();failed=false;collectionArchived=false;removedCollection.name="Synthetic removed collection";inspirationJourney=false;inspirationRemoved=false;inspirationFailure=false;writes.length=0;});
const props = {items:[],optimisticItems:[]} as unknown as React.ComponentProps<typeof CollectionsWorkspace>;
test("main workspace does not mount removed-data browsers", () => {
  render(<CollectionsWorkspace {...props}/>);
  expect(screen.queryByRole("button",{name:"Removed collections"})).toBeNull();
  expect(screen.queryByRole("button",{name:"Removed inspiration"})).toBeNull();
});

test("true inspiration entry supports cancel, removal failure/retry, immediate Undo error/retry and persistence", async () => {
  inspirationJourney=true;
  const view=render(<CollectionsWorkspace {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Synthetic removed collection"}));
  fireEvent.click(screen.getByRole("button",{name:"inspiration"}));
  fireEvent.click(screen.getByRole("button",{name:"Remove"}));
  fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
  expect(writes).toEqual([]);
  inspirationFailure=true;
  fireEvent.click(screen.getByRole("button",{name:"Remove"}));
  fireEvent.click(screen.getByRole("button",{name:"Remove inspiration"}));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Try again"));
  inspirationFailure=false;
  fireEvent.click(screen.getByRole("button",{name:"Remove inspiration"}));
  await waitFor(() => expect(screen.getByRole("button",{name:"Undo"})).toBeTruthy());
  expect(screen.getByText("Save a photo to begin your moodboard.")).toBeTruthy();
  expect(document.activeElement?.textContent).toContain("Data management under your account");
  expect(writes.at(-1)).toEqual({wardrobeId:"synthetic-collection",membershipId:"synthetic-member",removed:true});
  inspirationFailure=true;
  fireEvent.click(screen.getByRole("button",{name:"Undo"}));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Could not undo"));
  inspirationFailure=false;
  fireEvent.click(screen.getByRole("button",{name:"Undo"}));
  await waitFor(() => expect(screen.getByRole("button",{name:"Remove"})).toBeTruthy());
  expect(document.activeElement?.textContent).toBe("Synthetic removed collection");
  fireEvent.click(screen.getByRole("button",{name:"Remove"}));
  fireEvent.click(screen.getByRole("button",{name:"Remove inspiration"}));
  await waitFor(() => expect(screen.getByRole("button",{name:"Dismiss"})).toBeTruthy());
  fireEvent.click(screen.getByRole("button",{name:"Dismiss"}));
  expect(screen.queryByRole("button",{name:"Undo"})).toBeNull();
  view.unmount();
  render(<CollectionsWorkspace {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"Synthetic removed collection"}));
  fireEvent.click(screen.getByRole("button",{name:"inspiration"}));
  expect(screen.queryByRole("button",{name:"Remove"})).toBeNull();
  expect(screen.queryByRole("button",{name:"Removed inspiration"})).toBeNull();
});

test("collection edit entry removes collection, retains immediate Undo, then no inline archive after reload",async()=>{
 inspirationJourney=true;
 const view=render(<CollectionsWorkspace {...props}/>);
 fireEvent.click(screen.getByRole("button",{name:"Synthetic removed collection"}));
 fireEvent.click(screen.getByRole("button",{name:"Edit collection"}));
 fireEvent.click(screen.getByRole("button",{name:"Remove collection"}));
 expect(screen.getByText(/Restore this collection later in Data management/)).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Remove collection"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Undo"})).toBeTruthy());
 expect(collectionArchived).toBe(true);expect(screen.queryByRole("button",{name:"Synthetic removed collection"})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Undo"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Synthetic removed collection"})).toBeTruthy());
 expect(collectionArchived).toBe(false);
 expect(writes.at(-1)).toEqual({wardrobeId:"synthetic-collection",archived:false});
 view.unmount();collectionArchived=true;render(<CollectionsWorkspace {...props}/>);
 expect(screen.queryByRole("button",{name:"Removed collections"})).toBeNull();
 expect(screen.queryByRole("button",{name:"Synthetic removed collection"})).toBeNull();
});
