import { test, expect } from "playwright/test";
import { cameraFixture } from "./camera-fixture";
const add = (page: import("playwright/test").Page) => page.getByRole("button", {name:"Add outfit",exact:true});
test("front/rear switching releases the old source and mirrors only confirmed front preview", async ({page}) => {
 await cameraFixture(page); await page.goto("/?scenario=wardrobe"); await add(page).click();
 await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled();
 for (const mirrored of ["true", "false"]) {
  await page.getByRole("button",{name:"Switch camera"}).click();
  await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled();
  await expect(page.getByLabel("Camera preview")).toHaveAttribute("data-mirrored",mirrored);
 }
 expect(await page.evaluate(()=>window.cameraProbe.constraints.map(c=>(c.video as MediaTrackConstraints).facingMode))).toEqual([{ideal:"environment"},{ideal:"user"},{ideal:"environment"}]);
 await page.getByRole("button",{name:"Close camera"}).click();
 expect(await page.evaluate(()=>({active:window.cameraProbe.active,maximum:window.cameraProbe.maximum,stops:window.cameraProbe.stops}))).toEqual({active:0,maximum:1,stops:3});
});
test("switch failure retries and unsupported facing fallback stays truthful",async({page})=>{
 await cameraFixture(page); await page.goto("/?scenario=wardrobe"); await add(page).click();
 await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled();
 await page.evaluate(()=>{window.cameraProbe.failNext=true;}); await page.getByRole("button",{name:"Switch camera"}).click();
 await expect(page.getByRole("alert")).toContainText("Camera unavailable");
 expect(await page.evaluate(()=>window.cameraProbe.active)).toBe(0);
 await page.evaluate(()=>{window.cameraProbe.sameCamera=true;}); await page.getByRole("button",{name:"Retry camera"}).click();
 await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled();
 await expect(page.getByRole("status")).toContainText("Requested camera unavailable");
 await expect(page.getByLabel("Camera preview")).toHaveAttribute("data-mirrored","false");
 await page.getByRole("button",{name:"Close camera"}).click(); await expect(add(page)).toBeFocused();
});
test("switch pending blocks shutter and a late result after close is released",async({page})=>{
 await cameraFixture(page,"pending"); await page.goto("/?scenario=wardrobe"); await add(page).click();
 await expect.poll(()=>page.evaluate(()=>window.cameraProbe.requests)).toBe(1); await page.evaluate(()=>window.cameraProbe.resolve());
 await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled(); await page.getByRole("button",{name:"Switch camera"}).click();
 await expect.poll(()=>page.evaluate(()=>window.cameraProbe.requests)).toBe(2); await expect(page.getByRole("button",{name:"Take photo"})).toBeDisabled();
 await page.getByRole("button",{name:"Close camera"}).click(); await page.evaluate(()=>window.cameraProbe.resolve());
 await expect.poll(()=>page.evaluate(()=>window.cameraProbe.stops)).toBe(2);
 expect(await page.evaluate(()=>window.cameraProbe.active)).toBe(0);
 const state=await page.request.get("/__fixture/state").then(r=>r.json()); expect(state.uploadImages).toHaveLength(0);
});
test("responsive controls remain centered and full frame preview avoids artificial zoom",async({page})=>{
 await cameraFixture(page);
 for(const size of [{width:320,height:844},{width:390,height:844},{width:430,height:844},{width:844,height:390}]){
  await page.setViewportSize(size); await page.goto("/?scenario=wardrobe"); await add(page).click(); await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled();
  expect(await page.getByLabel("Camera preview").evaluate(e=>getComputedStyle(e).objectFit)).toBe("contain");
  const shutter=(await page.getByRole("button",{name:"Take photo"}).boundingBox())!;
  expect(size.width < size.height ? shutter.x+shutter.width/2 : shutter.y+shutter.height/2).toBeCloseTo((size.width<size.height?size.width:size.height)/2,0);
  for(const name of ["Close camera","Choose photos","Switch camera","Take photo","My wardrobe","Try on"]){const b=(await page.getByRole("button",{name,exact:true}).boundingBox())!; expect(b.width).toBeGreaterThanOrEqual(44);expect(b.height).toBeGreaterThanOrEqual(44);expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(size.width);expect(b.y+b.height).toBeLessThanOrEqual(size.height);}
  const close=(await page.getByRole("button",{name:"Close camera"}).boundingBox())!; const mode=(await page.getByRole("button",{name:"My wardrobe",exact:true}).boundingBox())!; expect(mode.x).toBeGreaterThanOrEqual(close.x+close.width);
  await page.screenshot({path:`../../output/playwright/selfie-${size.width}.png`}); await page.getByRole("button",{name:"Close camera"}).click();
 }
});

test("unknown camera settings are disclosed and front photo preserves the full scene", async({page})=>{
 await cameraFixture(page); await page.goto("/?scenario=wardrobe"); await add(page).click(); await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled();
 await page.evaluate(()=>{window.cameraProbe.unknownSettings=true;}); await page.getByRole("button",{name:"Switch camera"}).click(); await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled();
 await expect(page.getByRole("status")).toContainText("could not be confirmed"); await expect(page.getByLabel("Camera preview")).toHaveAttribute("data-mirrored","false");
 await page.evaluate(()=>{window.cameraProbe.unknownSettings=false;}); await page.getByRole("button",{name:"Switch camera"}).click(); await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled(); await page.getByRole("button",{name:"Switch camera"}).click(); await expect(page.getByLabel("Camera preview")).toHaveAttribute("data-mirrored","true");
 await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){original.call(this,blob=>{if(blob) void blob.arrayBuffer().then(bytes=>{(window as unknown as {photoProbe:number[]}).photoProbe=Array.from(new Uint8Array(bytes));});callback(blob);},type,quality);};});
 const upload=page.waitForRequest(r=>r.method()==="POST"&&r.url().endsWith("/__fixture/upload")); await page.getByRole("button",{name:"Take photo"}).click(); await upload;
 const sharp=(await import("sharp")).default; const {data,info}=await sharp(Buffer.from(await page.evaluate(()=>(window as unknown as {photoProbe:number[]}).photoProbe))).raw().toBuffer({resolveWithObject:true}); expect(info.width).toBe(640); expect(info.height).toBe(480); expect(data[0]).toBeGreaterThan(data[2]); const right=639*info.channels; expect(data[right+2]).toBeGreaterThan(data[right]);
 await expect.poll(()=>page.evaluate(()=>window.cameraProbe.active)).toBe(0);
});
test("late encoded photo after close cannot upload and ended camera can retry", async({page})=>{
 await cameraFixture(page); await page.goto("/?scenario=wardrobe"); await add(page).click(); await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled();
 await page.getByLabel("Camera preview").evaluate(e=>(e as HTMLVideoElement).srcObject && ((e as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0].dispatchEvent(new Event("ended")));
 await expect(page.getByRole("alert")).toContainText("Camera unavailable"); await page.getByRole("button",{name:"Retry camera"}).click(); await expect(page.getByRole("button",{name:"Take photo"})).toBeEnabled();
 await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){original.call(this,blob=>{(window as unknown as {finishPhoto:()=>void}).finishPhoto=()=>callback(blob);},type,quality);};});
 await page.getByRole("button",{name:"Take photo"}).click(); await expect(page.getByRole("button",{name:"Switch camera"})).toBeDisabled();
 await expect.poll(()=>page.evaluate(()=>typeof (window as unknown as {finishPhoto?:()=>void}).finishPhoto)).toBe("function");
 await page.getByRole("button",{name:"Close camera"}).click(); await page.evaluate(()=>(window as unknown as {finishPhoto:()=>void}).finishPhoto());
 const state=await page.request.get("/__fixture/state").then(r=>r.json()); expect(state.uploadImages).toHaveLength(0); expect(await page.evaluate(()=>window.cameraProbe.active)).toBe(0);
});
test("a track stopped after readiness cannot create a stale photo; reopen captures normally", async ({page}) => {
 await cameraFixture(page); await page.goto("/?scenario=wardrobe"); await add(page).click();
 await expect(page.getByRole("button", {name:"Take photo"})).toBeEnabled();
 await page.getByLabel("Camera preview").evaluate(node => ((node as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0].stop());
 await page.getByRole("button", {name:"Take photo"}).click();
 expect(await page.request.get("/__fixture/state").then(r => r.json()).then(state => state.uploadImages.length)).toBe(0);
 await page.getByRole("button", {name:"Close camera"}).click();
 await add(page).click(); await expect(page.getByRole("button", {name:"Take photo"})).toBeEnabled();
 const upload = page.waitForRequest(request => request.method()==="POST" && request.url().endsWith("/__fixture/upload"));
 await page.getByRole("button", {name:"Take photo"}).click(); await upload;
 await expect.poll(() => page.evaluate(() => window.cameraProbe.active)).toBe(0);
});
