import {expect,mock,test} from "bun:test";
let denied=false, protections=0;
mock.module("@clerk/nextjs/server",()=>({auth:{protect:async()=>{protections++;if(denied)throw new Error("Synthetic denied");}}}));
mock.module("@/components/DataManagement",()=>({default:()=>null}));
const {default:Page}=await import("./page");
test("private route protects before returning data UI",async()=>{
 denied=true;await expect(Page()).rejects.toThrow("Synthetic denied");
 denied=false;expect(await Page()).toBeTruthy();expect(protections).toBe(2);
});
