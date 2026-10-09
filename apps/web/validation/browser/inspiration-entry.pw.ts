import { test, expect } from "playwright/test";

// Real components, disposable server fixture; account link is a harness, not Clerk's popup.
for (const width of [320, 390]) test(`remove, account recovery, reload and restore retry (${width})`, async ({page}) => {
  await page.setViewportSize({width,height:844});
  await page.goto("/?scenario=wardrobe");
  const open = async () => {
    await page.getByRole("button",{name:"Saved ideas",exact:true}).click();
    await page.getByRole("button",{name:"inspiration",exact:true}).click();
  };
  await open();
  const card = page.getByRole("article").filter({hasText:"Navy layers"});
  await card.getByRole("button",{name:"Remove",exact:true}).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(card.getByRole("button",{name:"Remove",exact:true})).toBeFocused();
  await card.getByRole("button",{name:"Remove",exact:true}).click();
  await card.getByRole("button",{name:"Remove inspiration",exact:true}).click();
  await expect(page.getByRole("button",{name:"Undo",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Removed inspiration",exact:true})).toHaveCount(0);
  await page.reload();await open();await expect(card).toHaveCount(0);
  await page.getByRole("link",{name:"Data management (synthetic account entry)"}).click();
  await expect(page.getByRole("heading",{name:"Data management",exact:true})).toBeVisible();
  await page.getByRole("combobox").selectOption("ideas");
  const restore=page.getByRole("button",{name:"Restore inspiration"});
  await expect(restore).toBeVisible();
  let fail=true;
  await page.route("**/__fixture/action/mutation", async route => {
    if(fail && route.request().postDataJSON().name === "wardrobe.setInspirationRemoved"){
      fail=false;await route.fulfill({status:503,json:{error:"Synthetic failure"}});
    }else await route.continue();
  });
  await restore.focus();await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Could not restore this inspiration");
  await page.keyboard.press("Enter");
  await expect(page.getByText("No removed inspiration in this collection.")).toBeVisible();
  await expect(page.getByRole("status").filter({hasText:"Inspiration restored"})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const contrast = await page.getByRole("status").filter({hasText:"Inspiration restored"}).evaluate(element => {
    const style=getComputedStyle(element);
    const luminance=(color:string)=>{const rgb=color.match(/\d+/g)!.slice(0,3).map(Number).map(x=>{const c=x/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;});return rgb[0]!*0.2126+rgb[1]!*0.7152+rgb[2]!*0.0722;};
    const a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  });
  expect(contrast).toBeGreaterThan(4.5);
  await page.screenshot({path:`../../output/playwright/data-management-${width}.png`,fullPage:true});
  await page.getByRole("link",{name:"Back to wardrobe"}).click();await open();await expect(card).toHaveCount(1);
  await page.reload();await open();await expect(card).toHaveCount(1);
  const state=await page.request.get("/__fixture/state").then(r=>r.json());
  expect(state.catalog.items).toHaveLength(4);expect(state.catalog.inspirations).toHaveLength(3);
});

test("collection removal relocates recovery; load error retries actual queries",async({page})=>{
 await page.setViewportSize({width:320,height:844});
 await page.goto("/?scenario=wardrobe");
 await page.getByRole("button",{name:"Saved ideas",exact:true}).click();
 await page.getByRole("button",{name:"Edit collection"}).click();
 await page.getByRole("button",{name:"Remove collection",exact:true}).click();
 await page.getByRole("button",{name:"Remove collection",exact:true}).click();
 await expect(page.getByRole("button",{name:"Saved ideas",exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Removed collections",exact:true})).toHaveCount(0);
 let failQuery=true,queries=0;
 await page.route("**/__fixture/query",async route=>{
  queries++;
  if(failQuery && route.request().headers()["referer"]?.includes("/account/data")){await route.fulfill({status:503,json:{error:"Synthetic unavailable"}});}else await route.continue();
 });
 await page.getByRole("link",{name:"Data management (synthetic account entry)"}).click();
 await expect(page.getByRole("alert")).toContainText("could not load");
 const before=queries;failQuery=false;
 await page.getByRole("button",{name:"Retry data"}).focus();await page.keyboard.press("Enter");
 const restore=page.getByRole("button",{name:"Restore collection"});await expect(restore).toBeVisible();expect(queries).toBeGreaterThan(before);
 const rect=await restore.boundingBox();expect(rect?.height).toBeGreaterThanOrEqual(44);
 let failWrite=true;
 await page.route("**/__fixture/action/mutation",async route=>{
  if(failWrite){failWrite=false;await route.fulfill({status:503,json:{error:"Synthetic unavailable"}});}else await route.continue();
 });
 await restore.focus();await page.keyboard.press("Enter");
 await expect(page.getByRole("alert")).toContainText("Could not restore this collection");
 await expect(restore).toBeFocused();await page.keyboard.press("Enter");
 await expect(page.getByRole("status").filter({hasText:"Collection restored"})).toBeFocused();
 await expect(page.getByText("No removed collections.")).toBeVisible();
 await page.getByRole("link",{name:"Back to wardrobe"}).click();
 await expect(page.getByRole("button",{name:"Saved ideas",exact:true})).toBeVisible();await page.reload();await expect(page.getByRole("button",{name:"Saved ideas",exact:true})).toBeVisible();
});
