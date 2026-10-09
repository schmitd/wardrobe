import { test, expect } from "playwright/test";
import { cameraFixture } from "./camera-fixture";

const photo = {name:"synthetic.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==","base64")};
test("pending/next account clears try-on photos and late results; legitimate next-account Add works", async ({page}) => {
  await cameraFixture(page);
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    const urls = new Set<string>(); Object.assign(window,{fixturePreviewUrls:urls});
    URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url; };
    URL.revokeObjectURL = url => { urls.delete(url); revoke(url); };
  });
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/__fixture/try-on", async route => {
    const response = await route.fetch();
    await barrier;
    await route.fulfill({ response });
  });
  const completed = page.waitForResponse(response => response.url().endsWith("/try-on"));
  await page.goto("/?scenario=wardrobe&latency=200");
  await page.getByRole("button",{name:"Add outfit",exact:true}).click();
  await page.getByRole("button",{name:"Try on",exact:true}).click();
  const chooser = page.waitForEvent("filechooser"); await page.getByRole("button",{name:"Choose photos",exact:true}).click();
  await (await chooser).setFiles(photo);
  await expect(page.getByRole("dialog",{name:"Try on outfit",exact:true})).toBeVisible();
  await page.evaluate(() => { window.fixtureAuth={isLoaded:false,isSignedIn:false,userId:null}; window.dispatchEvent(new Event("fixture-auth")); });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as {fixturePreviewUrls:Set<string>}).fixturePreviewUrls.size)).toBe(0);
  await page.evaluate(() => { window.fixtureAuth={isLoaded:true,isSignedIn:true,userId:"synthetic-bob"}; window.dispatchEvent(new Event("fixture-auth")); });
  await expect(page.getByRole("heading",{name:"Strong closet fit",exact:true})).toHaveCount(0);
  await expect(page.getByRole("region",{name:"Notifications",exact:true}).getByRole("link")).toHaveCount(0);
  await page.getByRole("button",{name:"Add outfit",exact:true}).click();
  await expect(page.getByRole("button",{name:"Take photo",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Close camera",exact:true}).click();
  release();
  expect((await completed).ok()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Strong closet fit",exact:true})).toHaveCount(0);
});

test("account switch and logout dispose persistent notices and Undo actions", async ({page}) => {
  await page.goto("/?scenario=notifications");
  await page.getByRole("button",{name:"Error notice",exact:true}).click();
  await page.getByRole("button",{name:"Undo notice",exact:true}).click();
  await expect(page.getByRole("button",{name:"Undo",exact:true})).toBeVisible();
  await page.evaluate(() => { window.fixtureAuth={isLoaded:true,isSignedIn:true,userId:"synthetic-bob"}; window.dispatchEvent(new Event("fixture-auth")); });
  await expect(page.getByRole("button",{name:"Undo",exact:true})).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button",{name:"Error notice",exact:true}).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.evaluate(() => { window.fixtureAuth={isLoaded:true,isSignedIn:false,userId:null}; window.dispatchEvent(new Event("fixture-auth")); });
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("same-owner backend confirmation loss cancels camera and prevents stale picker uploads", async ({page})=>{
 await cameraFixture(page,"pending");
 await page.goto("/?scenario=home-import");
 await page.getByRole("button",{name:"Add outfit",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Camera",exact:true})).toBeVisible();
 const oldInput=await page.locator('input[type="file"]').last().elementHandle();
 await page.evaluate(()=>{window.fixtureAuth={isLoaded:true,isSignedIn:true,userId:"synthetic-alice",backendPending:true};window.dispatchEvent(new Event("fixture-auth"));});
 await expect(page.getByRole("dialog")).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Add outfit",exact:true})).toBeDisabled();
 if(oldInput) await oldInput.evaluate(node=>node.dispatchEvent(new Event("change",{bubbles:true})));
 const state=await page.request.get("/__fixture/state").then(r=>r.json());
 expect(state.calls.filter((call:{operation:string})=>["upload-url","create-piece","daily-fit"].includes(call.operation))).toHaveLength(0);
 await page.evaluate(()=>{window.fixtureAuth={isLoaded:true,isSignedIn:true,userId:"synthetic-alice",backendUnavailable:true};window.dispatchEvent(new Event("fixture-auth"));});
 await expect(page.getByRole("alert")).toContainText("could not be confirmed");
 await expect(page.getByRole("button",{name:"Retry connection"})).toBeVisible();
 await page.evaluate(()=>{window.fixtureAuth={isLoaded:true,isSignedIn:true,userId:"synthetic-alice"};window.dispatchEvent(new Event("fixture-auth"));});
 await page.getByRole("button",{name:"Add outfit",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Camera",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Close camera"}).click();
});
