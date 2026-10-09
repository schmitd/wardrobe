import { afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import React, {useState} from "react";
import { getFunctionName } from "convex/server";
GlobalRegistrator.register();
let clerk = {isLoaded:true,isSignedIn:true,userId:"synthetic-owner",sessionId:"synthetic-session"};
let convex = {isLoading:false,isAuthenticated:true};
let archived=true, removed=true, failed=false, queryFailed=false, loading=false;
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
  const name=getFunctionName(api as never); reads.push({name,args});
  if(queryFailed) throw new Error("Synthetic query failure");
  return {results:loading?[]:name==="wardrobe:pageCollections"?(Boolean(args.archived)===archived?[collection]:[]):(removed?[reference]:[]),status:loading?"LoadingFirstPage":"Exhausted",loadMore(){}};
 },
 useMutation:(api:unknown)=>{
  const [,refresh]=useState(0);
  return async(args:{archived?:boolean;removed?:boolean})=>{
   writes.push(args);
   if(failed)throw new Error("Synthetic restore failure");
   if(pending)await new Promise<void>(resolve=>{pending=resolve;});
   if(getFunctionName(api as never)==="wardrobe:archiveCollection")archived=Boolean(args.archived);else removed=Boolean(args.removed);
   refresh(x=>x+1);
  };
 }
}));
const {render,screen,fireEvent,cleanup,waitFor}=await import("@testing-library/react");
const {default:DataManagement}=await import("./DataManagement");
afterEach(()=>{cleanup();clerk={isLoaded:true,isSignedIn:true,userId:"synthetic-owner",sessionId:"synthetic-session"};convex={isLoading:false,isAuthenticated:true};archived=true;removed=true;failed=false;queryFailed=false;loading=false;pending=null;writes.length=0;reads.length=0;});
test("private queries wait for both authorities; session change resets selection",()=>{
 clerk.isLoaded=false;
 const view=render(<DataManagement/>);
 expect(reads).toEqual([]);
 expect(screen.getByRole("status").textContent).toContain("Connecting");
 clerk.isLoaded=true;convex.isLoading=true;view.rerender(<DataManagement/>);expect(reads).toEqual([]);
 convex.isLoading=false;convex.isAuthenticated=false;view.rerender(<DataManagement/>);expect(reads).toEqual([]);expect(screen.getByRole("button",{name:"Retry connection"})).toBeTruthy();
 convex.isAuthenticated=true;view.rerender(<DataManagement/>);
 expect(reads.every(value => (value as {name:string}).name === "wardrobe:pageCollections")).toBe(true);
 fireEvent.change(screen.getByRole("combobox"),{target:{value:collection._id}});
 expect(screen.getByRole("button",{name:"Restore inspiration"})).toBeTruthy();
 clerk.sessionId="synthetic-other-session";view.rerender(<DataManagement/>);
 expect(screen.queryByRole("button",{name:"Restore inspiration"})).toBeNull();
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
test("restore collection before inspiration; visible mutation failure/retry; restored state persists on remount",async()=>{
 const view=render(<DataManagement/>);
 fireEvent.change(screen.getByRole("combobox"),{target:{value:collection._id}});
 expect((screen.getByRole("button",{name:"Restore inspiration"}) as HTMLButtonElement).disabled).toBe(true);
 failed=true;fireEvent.click(screen.getByRole("button",{name:"Restore collection"}));
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Could not restore this collection"));
 failed=false;fireEvent.click(screen.getByRole("button",{name:"Restore collection"}));
 // Reactive fixtures update their parent after server results, as Convex subscriptions do.
 await waitFor(()=>expect(archived).toBe(false));view.rerender(<DataManagement/>);
 failed=true;fireEvent.click(screen.getByRole("button",{name:"Restore inspiration"}));
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Could not restore this inspiration"));
 failed=false;fireEvent.click(screen.getByRole("button",{name:"Restore inspiration"}));
 await waitFor(()=>expect(removed).toBe(false));view.rerender(<DataManagement/>);
 expect(screen.getByText("No removed inspiration in this collection.")).toBeTruthy();
 expect(document.activeElement?.textContent).toContain("Inspiration restored");
 expect(writes.at(-1)).toEqual({wardrobeId:collection._id,membershipId:reference.membershipId,removed:false});
 view.unmount();render(<DataManagement/>);fireEvent.change(screen.getByRole("combobox"),{target:{value:collection._id}});
 expect(screen.getByText("No removed collections.")).toBeTruthy();expect(screen.getByText("No removed inspiration in this collection.")).toBeTruthy();
});
test("pending restore ignores repeated clicks and completion after owner switch",async()=>{
 pending=()=>{};const view=render(<DataManagement/>);
 const button=screen.getByRole("button",{name:"Restore collection"});fireEvent.click(button);fireEvent.click(button);expect(writes).toHaveLength(1);
 clerk.userId="synthetic-second-owner";view.rerender(<DataManagement/>);
 pending!();await waitFor(()=>expect(archived).toBe(false));
 expect(screen.queryByText("Collection restored. It is available in your wardrobe.")).toBeNull();
});
