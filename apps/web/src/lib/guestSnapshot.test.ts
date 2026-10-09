import {afterEach,expect,test} from "bun:test";
import {GlobalRegistrator} from "@happy-dom/global-registrator";
import {saveGuestSnapshot,loadGuestSnapshot,updateGuestSnapshotItem,clearGuestSnapshot,type GuestSnapshot} from "./guestSnapshot";
if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
afterEach(()=>sessionStorage.clear());
const owned:GuestSnapshot={version:1,createdAt:1000,importOwnerId:"A",bio:"A private style",items:[{id:"first",fileName:"private.jpg",mimeType:"image/jpeg",dataUrl:"data:image/jpeg;base64,AA",category:"Shirt",description:"A private photo",styleTags:[],createdItemId:"existing-id"}]};
test("new anonymous draft preserves resumable account import and IDs without exposing it to B",()=>{
 saveGuestSnapshot(owned);
 const anonymous:GuestSnapshot={...owned,createdAt:2000,importOwnerId:undefined,bio:"New anonymous style",items:[]};
 saveGuestSnapshot(anonymous);
 expect(loadGuestSnapshot()).toEqual(JSON.parse(JSON.stringify(anonymous)));
 expect(loadGuestSnapshot("B")).toEqual(JSON.parse(JSON.stringify(anonymous)));
 expect(loadGuestSnapshot("A")).toEqual(owned);
 updateGuestSnapshotItem("first",{description:"retry"},"A");
 expect(loadGuestSnapshot("A")?.items[0]?.createdItemId).toBe("existing-id");
 expect(loadGuestSnapshot()?.bio).toBe("New anonymous style");
 clearGuestSnapshot("A");
 expect(loadGuestSnapshot("A")).toEqual(JSON.parse(JSON.stringify(anonymous)));
});
test("foreign mutation and anonymous cleanup cannot remove an owned draft",()=>{
 saveGuestSnapshot(owned);
 updateGuestSnapshotItem("first",{createdItemId:"foreign"},"B");
 clearGuestSnapshot();
 expect(loadGuestSnapshot("A")).toEqual(owned);
});
test("quota failure after recovery copy clears duplicate completed snapshot without reimport",()=>{
 saveGuestSnapshot(owned);
 const original=sessionStorage;
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,"sessionStorage");
 Object.defineProperty(globalThis,"sessionStorage",{configurable:true,value:{getItem:original.getItem.bind(original),removeItem:original.removeItem.bind(original),setItem:(key:string,value:string)=>{if(key==="wardrobe.guestSnapshot.v1") throw new Error("Quota exceeded"); original.setItem(key,value);}}});
 try {saveGuestSnapshot({...owned,importOwnerId:undefined,createdAt:2000});} finally {if(descriptor) Object.defineProperty(globalThis,"sessionStorage",descriptor);}
 expect(loadGuestSnapshot("A")).toEqual(owned);
 expect(JSON.parse(sessionStorage.getItem("wardrobe.guestSnapshot.v1")!).importOwnerId).toBe("A");
 clearGuestSnapshot("A",1000);
 expect(loadGuestSnapshot("A")).toBeNull();
});
test("completion cannot clear a newer same-owner snapshot",()=>{
 saveGuestSnapshot({...owned,createdAt:2000});
 clearGuestSnapshot("A",1000);
 expect(loadGuestSnapshot("A")?.createdAt).toBe(2000);
});
