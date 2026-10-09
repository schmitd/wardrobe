import { afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React, {useState} from "react";
import { getFunctionName } from "convex/server";
GlobalRegistrator.register();
let clerk = {isLoaded:true,isSignedIn:true,userId:"synthetic-owner",sessionId:"synthetic-session"};
let convex = {isLoading:false,isAuthenticated:true};
let archived=true, removed=true, failed=false, queryFailed=false, loading=false;
let failInspiration=false;
let emptyFilteredPage=false;
const loads:number[]=[];
let pending: (()=>void)|null=null;
const writes: unknown[]=[];
const reads: unknown[]=[];
const collection={_id:"synthetic-collection",name:"Synthetic collection"};
const reference={membershipId:"synthetic-member",description:"Synthetic reference",category:null};
mock.module("@clerk/nextjs",()=>({useAuth:()=>clerk}));
mock.module("next/link",()=>({default:({href,children,...props}:React.ComponentProps<"a">)=><a href={href} {...props}>{children}</a>}));
mock.module("posthog-js",()=>({default:{capture(){}}}));
mock.module("convex/react",()=>({
 useConvexAuth:()=>convex,
 usePaginatedQuery:(api:unknown,args:{archived?:boolean;wardrobeId?:string})=>{
  const [moreLoaded,setMoreLoaded]=useState(false);
  const name=getFunctionName(api as never); reads.push({name,args});
  if(name === "wardrobe:pageInspiration" && emptyFilteredPage && !moreLoaded)return {results:[],status:"CanLoadMore",loadMore(count:number){loads.push(count);setMoreLoaded(true);}};
  if(queryFailed) throw new Error("Synthetic query failure");
  return {results:loading?[]:name==="wardrobe:pageCollections"?(Boolean(args.archived)===archived?[collection]:[]):(removed?[reference]:[]),status:loading?"LoadingFirstPage":"Exhausted",loadMore(){}};
 },
 useMutation:(api:unknown)=>{
  const [,refresh]=useState(0);
  return async(args:{archived?:boolean;removed?:boolean})=>{
   writes.push(args);
   if(failed || (failInspiration && getFunctionName(api as never) === "wardrobe:setInspirationRemoved"))throw new Error("Synthetic restore failure");
   if(pending)await new Promise<void>(resolve=>{pending=resolve;});
   if(getFunctionName(api as never)==="wardrobe:archiveCollection")archived=Boolean(args.archived);else removed=Boolean(args.removed);
   refresh(x=>x+1);
  };
 }
}));
const {render,screen,fireEvent,cleanup,waitFor}=await import("@testing-library/react");
const {default:DataManagement}=await import("./DataManagement");
afterEach(()=>{cleanup();clerk={isLoaded:true,isSignedIn:true,userId:"synthetic-owner",sessionId:"synthetic-session"};convex={isLoading:false,isAuthenticated:true};archived=true;removed=true;failed=false;failInspiration=false;emptyFilteredPage=false;loads.length=0;queryFailed=false;loading=false;pending=null;writes.length=0;reads.length=0;});
test("private queries wait for both authorities; session change resets selection",()=>{
 clerk.isLoaded=false;
 const view=render(<DataManagement/>);
 expect(reads).toEqual([]);
 expect(screen.getByRole("status").textContent).toContain("Connecting");
 clerk.isLoaded=true;convex.isLoading=true;view.rerender(<DataManagement/>);expect(reads).toEqual([]);
 convex.isLoading=false;convex.isAuthenticated=false;view.rerender(<DataManagement/>);expect(reads).toEqual([]);expect(screen.getByRole("button",{name:"Retry connection"})).toBeTruthy();
 convex.isAuthenticated=true;view.rerender(<DataManagement/>);
 expect(reads.every(value => (value as {name:string}).name === "wardrobe:pageCollections")).toBe(true);
 fireEvent.click(screen.getByRole("button",{name:"Synthetic collection Removed"}));
 expect(screen.getByRole("button",{name:"Restore collection & inspiration"})).toBeTruthy();
 clerk.sessionId="synthetic-other-session";view.rerender(<DataManagement/>);
 expect(screen.queryByRole("button",{name:"Restore collection & inspiration"})).toBeNull();
});
test("loading is not empty; query failure Retry remounts subscriptions with ordinary successful control",async()=>{
 loading=true;const view=render(<DataManagement/>);
 expect(screen.queryByText("No removed collections.")).toBeNull();
 expect(screen.getByText("Loading removed collections…")).toBeTruthy();
 loading=false;queryFailed=true;view.rerender(<DataManagement/>);
 expect(screen.getByRole("alert").textContent).toContain("could not load");
 const count=reads.length;queryFailed=false;
 fireEvent.click(screen.getByRole("button",{name:"Retry data"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Restore collection"})).toBeTruthy());
 expect(reads.length).toBeGreaterThan(count);
 fireEvent.click(screen.getByRole("button",{name:"Restore collection"}));
 await waitFor(()=>expect(screen.getByText("Collection restored. It is available in your wardrobe.")).toBeTruthy());
 expect(screen.queryByRole("alert")).toBeNull();
});
test("one archived inspiration action preserves partial success, retries membership only, and persists",async()=>{
 const view=render(<DataManagement/>);
 expect(screen.queryByRole("combobox")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Synthetic collection Removed"}));
 expect(screen.queryByText(/Restore this collection above/)).toBeNull();
 failInspiration=true;
 fireEvent.click(screen.getByRole("button",{name:"Restore collection & inspiration"}));
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Collection restored. Inspiration could not be restored"));
 expect(archived).toBe(false);expect(removed).toBe(true);
 expect(writes).toEqual([{wardrobeId:collection._id,archived:false},{wardrobeId:collection._id,membershipId:reference.membershipId,removed:false}]);
 expect(document.activeElement?.textContent).toBe("Restore inspiration");
 failInspiration=false;fireEvent.click(screen.getByRole("button",{name:"Restore inspiration"}));
 await waitFor(()=>expect(removed).toBe(false));view.rerender(<DataManagement/>);
 expect(writes).toHaveLength(3);
 expect(screen.getByText("No removed inspiration in this collection.")).toBeTruthy();
 expect(document.activeElement?.textContent).toContain("Inspiration restored");
 view.unmount();render(<DataManagement/>);fireEvent.click(screen.getByRole("button",{name:"Synthetic collection"}));
 expect(screen.getByText("No removed collections.")).toBeTruthy();expect(screen.getByText("No removed inspiration in this collection.")).toBeTruthy();
});
test("archived collection without removed inspiration offers collection restoration without contradictory prerequisite or empty copy",()=>{
 removed=false;render(<DataManagement/>);fireEvent.click(screen.getByRole("button",{name:"Synthetic collection Removed"}));
 expect(screen.getByRole("button",{name:"Restore collection"})).toBeTruthy();
 expect(screen.queryByRole("button",{name:"Restore collection & inspiration"})).toBeNull();
 expect(screen.queryByText("No removed inspiration in this collection.")).toBeNull();
 expect(screen.queryByText(/Restore this collection above/)).toBeNull();
});
test("combined first-write failure supports retry and stale owner completion never starts membership write",async()=>{
 const view=render(<DataManagement/>);fireEvent.click(screen.getByRole("button",{name:"Synthetic collection Removed"}));
 failed=true;fireEvent.click(screen.getByRole("button",{name:"Restore collection & inspiration"}));
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Could not restore this collection"));
 expect(writes).toHaveLength(1);expect(archived).toBe(true);expect(removed).toBe(true);
 failed=false;pending=()=>{};
 const button=screen.getByRole("button",{name:"Restore collection & inspiration"});fireEvent.click(button);fireEvent.click(button);
 expect(writes).toHaveLength(2);
 clerk.userId="synthetic-second-owner";view.rerender(<DataManagement/>);
 pending!();await waitFor(()=>expect(archived).toBe(false));
 expect(writes).toHaveLength(2);expect(removed).toBe(true);
 expect(screen.queryByText("Inspiration restored. It is available in its collection.")).toBeNull();
});
test("pending restore ignores repeated clicks and completion after owner switch",async()=>{
 pending=()=>{};const view=render(<DataManagement/>);
 const button=screen.getByRole("button",{name:"Restore collection"});fireEvent.click(button);fireEvent.click(button);expect(writes).toHaveLength(1);
 clerk.userId="synthetic-second-owner";view.rerender(<DataManagement/>);
 pending!();await waitFor(()=>expect(archived).toBe(false));
 expect(screen.queryByText("Collection restored. It is available in your wardrobe.")).toBeNull();
});

test("ordinary combined restoration and active inspiration control restore only the requested relationship",async()=>{
 const view=render(<DataManagement/>);
 fireEvent.click(screen.getByRole("button",{name:"Synthetic collection Removed"}));
 fireEvent.click(screen.getByRole("button",{name:"Restore collection & inspiration"}));
 await waitFor(()=>expect(removed).toBe(false));
 expect(writes).toEqual([{wardrobeId:collection._id,archived:false},{wardrobeId:collection._id,membershipId:reference.membershipId,removed:false}]);
 view.unmount();removed=true;writes.length=0;
 render(<DataManagement/>);fireEvent.click(screen.getByRole("button",{name:"Synthetic collection"}));
 fireEvent.click(screen.getByRole("button",{name:"Restore inspiration"}));
 await waitFor(()=>expect(removed).toBe(false));expect(writes).toEqual([{wardrobeId:collection._id,membershipId:reference.membershipId,removed:false}]);
});

test("empty filtered membership page is not exhausted: bounded More loads a removed reference",async()=>{
 archived=false;emptyFilteredPage=true;render(<DataManagement/>);
 fireEvent.click(screen.getByRole("button",{name:"Synthetic collection"}));
 expect(screen.queryByText("No removed inspiration in this collection.")).toBeNull();
 expect(screen.queryByRole("button",{name:"Restore inspiration"})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"More removed inspiration"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Restore inspiration"})).toBeTruthy());
 expect(loads).toEqual([24]);
 expect(screen.queryByText("No removed inspiration in this collection.")).toBeNull();
});
