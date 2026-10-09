import { test, expect } from "playwright/test";
import { cameraFixture } from "./camera-fixture";

test("cold Home uses known palette and loading state; delayed images keep reserved geometry", async ({ page }) => {
  let finishImages!: () => void;
  const images = new Promise<void>(resolve => { finishImages = resolve; });
  await page.route("**/__fixture/piece-*.svg", async route => { await images; await route.continue(); });
  await page.goto("/?scenario=home-continuity&latency=600");
  const palette = () => page.evaluate(() => ({ background: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.documentElement).getPropertyValue("--rack-ink").trim(), shell: getComputedStyle(document.documentElement).getPropertyValue("--rack-shell").trim() }));
  const first = await palette(); expect(first.ink).toBe("#241426"); expect(first.shell).toBe("#d8c9dc");
  await expect(page.getByRole("status", { name: "", exact: true }).filter({ hasText: "Loading pieces" })).toBeVisible();
  await expect(page.getByText("Start with a few clear pieces", { exact: true })).toHaveCount(0);
  const card = page.locator('[data-wardrobe-item-id="piece-0"]');
  await expect(card).toBeVisible(); const before = await card.boundingBox();
  finishImages();
  await expect.poll(() => card.locator("img").last().evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  const after = await card.boundingBox(); expect(after!.width).toBe(before!.width); expect(after!.height).toBe(before!.height);
  expect(await palette()).toEqual(first);
});

test("warm Fits to Wardrobe retains Home nodes, live insertion/deletion preserves unaffected keys", async ({ page }) => {
  await page.goto("/?scenario=home-continuity&latency=100");
  const card = page.locator('[data-wardrobe-item-id="piece-0"]'); await expect(card).toBeVisible();
  const original = await card.elementHandle();
  await page.getByRole("button", { name: "Open Overshirt details", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate(() => { history.pushState({}, "", "/fits?scenario=home-continuity"); window.dispatchEvent(new Event("fixture-navigation")); });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Wardrobe", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "Fits", exact: true }).click();
  expect(new URL(page.url()).pathname).toBe("/fits"); expect(await original!.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole("link", { name: "Wardrobe", exact: true }).click();
  await expect(card).toBeVisible(); expect(await original!.evaluate(node => node === document.querySelector('[data-wardrobe-item-id="piece-0"]'))).toBe(true);
  await expect(page.getByText("Loading pieces…", { exact: true })).toHaveCount(0);
  await page.request.post("/__fixture/action/fixture-insert-piece", { data: {} });
  await page.evaluate(() => window.dispatchEvent(new Event("fixture-refresh")));
  await expect(card).toBeVisible();
  await expect(page.locator('[data-wardrobe-item-id="live-piece"]')).toBeVisible();
  expect(await original!.evaluate(node => node === document.querySelector('[data-wardrobe-item-id="piece-0"]'))).toBe(true);
  await page.request.post("/__fixture/action/delete-piece", { data: { itemId: "live-piece" } });
  await page.evaluate(() => window.dispatchEvent(new Event("fixture-refresh")));
  await expect(page.locator('[data-wardrobe-item-id="live-piece"]')).toHaveCount(0);
  expect(await original!.evaluate(node => node === document.querySelector('[data-wardrobe-item-id="piece-0"]'))).toBe(true);
});

test("an interrupted guest import is partitioned by account and resumes only for its owner", async ({ page }) => {
  await page.addInitScript(() => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
    sessionStorage.setItem("wardrobe.guestSnapshot.v1", JSON.stringify({version:1,createdAt:1000,importOwnerId:"synthetic-alice",bio:"Private guest style",sourceFit:{fileName:"fit.png",mimeType:"image/png",dataUrl,transcription:"Synthetic"},items:[{id:"guest-0",fileName:"piece.png",mimeType:"image/png",dataUrl,createdItemId:"existing-piece",category:"Shirt",description:"Synthetic",styleTags:[]}]}));
    window.fixtureAuth = {isLoaded:true,isSignedIn:true,userId:"synthetic-bob"};
  });
  await page.goto("/?scenario=home-import");
  await expect(page.getByRole("button", {name:"Open Bob shirt details",exact:true})).toBeVisible();
  const other = await page.request.get("/__fixture/state").then(r => r.json());
  expect(other.calls.some((call:{operation:string}) => ["update-bio","create-piece","complete-onboarding"].includes(call.operation))).toBe(false);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("wardrobe.guestSnapshot.v1")!).importOwnerId)).toBe("synthetic-alice");
  await page.evaluate(() => { window.fixtureAuth = {isLoaded:true,isSignedIn:true,userId:"synthetic-alice"}; window.dispatchEvent(new Event("fixture-auth")); });
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("wardrobe.guestSnapshot.v1"))).toBeNull();
  const resumed = await page.request.get("/__fixture/state").then(r => r.json());
  expect(resumed.calls.filter((call:{operation:string}) => call.operation === "create-piece")).toHaveLength(0);
  expect(resumed.calls.filter((call:{operation:string}) => call.operation === "complete-onboarding")).toHaveLength(1);
});

test("delayed auth has guest escape; account switch clears private Home state before next account loads", async ({ page }) => {
  await page.addInitScript(() => { window.fixtureAuth = {isLoaded:false,isSignedIn:false,userId:null}; });
  await page.clock.install();
  await page.goto("/?scenario=home-continuity");
  await expect(page.locator("[data-home-shell]")).toBeVisible();
  await expect(page.locator("[data-wardrobe-item-id]")).toHaveCount(0);
  await page.clock.runFor(8100);
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("button", { name: "Choose photo", exact: true })).toBeVisible();
  await page.evaluate(() => { window.fixtureAuth = {isLoaded:true,isSignedIn:true,userId:"synthetic-alice"}; window.dispatchEvent(new Event("fixture-auth")); });
  await expect(page.getByRole("button", { name: "Open Overshirt details", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Use my wardrobe" }).click();
  await expect(page.getByRole("button", { name: "Open Overshirt details", exact: true })).toBeVisible();
  await page.evaluate(() => { window.fixtureAuth = {isLoaded:true,isSignedIn:true,userId:"synthetic-bob",backendPending:true}; window.dispatchEvent(new Event("fixture-auth")); });
  await expect(page.locator("[data-wardrobe-item-id]")).toHaveCount(0);
  await expect(page.locator("[data-home-shell]")).toBeVisible();
  await page.evaluate(() => { window.fixtureAuth = {isLoaded:true,isSignedIn:true,userId:"synthetic-bob"}; window.dispatchEvent(new Event("fixture-auth")); });
  await expect(page.getByRole("button", { name: "Open Bob shirt details", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Overshirt details", exact: true })).toHaveCount(0);
  await expect(page.getByText("Second account style", { exact: false })).toBeVisible();
  await page.evaluate(() => { window.fixtureAuth = {isLoaded:true,isSignedIn:false,userId:null}; window.dispatchEvent(new Event("fixture-auth")); });
  await expect(page.locator("[data-wardrobe-item-id]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose photo", exact: true })).toBeVisible();
});

test("confirmed empty Home Add a photo uses actual capture entry; failed query has bounded retry", async ({ page }) => {
  await cameraFixture(page, "pending");
  await page.goto("/?scenario=home-import&case=home-empty");
  await expect(page.getByText("Start with a few clear pieces", { exact: true })).toBeVisible();
  await expect(page.locator('main #rack-upload-input')).toHaveCount(0);
  await page.getByRole("button", { name: "Add a photo", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Camera", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close camera" }).click();
  await page.goto("/?scenario=home-import&case=home-load-error");
  await expect(page.getByRole("alert")).toContainText("Your wardrobe could not load");
  await page.getByRole("button", { name: "Retry wardrobe", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Overshirt details", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("bound account draft stays private during guest recovery and late foreign auth; owner reuses IDs",async({page})=>{
 await page.clock.install();
 await page.addInitScript(()=>{
  window.fixtureAuth={isLoaded:false,isSignedIn:false,userId:null};
  const dataUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  sessionStorage.setItem("wardrobe.guestSnapshot.v1",JSON.stringify({version:1,createdAt:1000,importOwnerId:"synthetic-alice",bio:"A owned secret bio",sourceFit:{fileName:"fit.png",mimeType:"image/png",dataUrl,transcription:"Synthetic"},items:[{id:"guest-0",fileName:"private.png",mimeType:"image/png",dataUrl,createdItemId:"existing-piece",category:"Shirt",description:"A owned secret garment",styleTags:[]}]}));
 });
 await page.goto("/?scenario=home-import");
 await expect(page.locator("[data-home-shell]")).toBeVisible();
 await page.clock.runFor(8100);
 await page.getByRole("button",{name:"Continue as guest"}).click();
 await expect(page.getByRole("button",{name:"Choose photo",exact:true})).toBeVisible();
 await expect(page.getByText("A owned secret bio")).toHaveCount(0);
 await expect(page.getByText("A owned secret garment")).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("wardrobe.guestSnapshot.v1")!).importOwnerId)).toBe("synthetic-alice");
 await page.evaluate(()=>{window.fixtureAuth={isLoaded:true,isSignedIn:true,userId:"synthetic-bob"};window.dispatchEvent(new Event("fixture-auth"));});
 await expect(page.getByRole("button",{name:"Use my wardrobe"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Choose photo",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Use my wardrobe"}).click();
 await expect(page.getByRole("button",{name:"Open Bob shirt details",exact:true})).toBeVisible();
 let state=await page.request.get("/__fixture/state").then(r=>r.json());
 expect(state.calls.some((call:{operation:string})=>["create-piece","complete-onboarding","update-bio"].includes(call.operation))).toBe(false);
 await page.evaluate(()=>{window.fixtureAuth={isLoaded:true,isSignedIn:true,userId:"synthetic-alice"};window.dispatchEvent(new Event("fixture-auth"));});
 await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem("wardrobe.guestSnapshot.v1"))).toBeNull();
 state=await page.request.get("/__fixture/state").then(r=>r.json());
 expect(state.calls.filter((call:{operation:string})=>call.operation==="create-piece")).toHaveLength(0);
 expect(state.calls.filter((call:{operation:string})=>call.operation==="complete-onboarding")).toHaveLength(1);
});
