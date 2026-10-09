import { test, expect } from "playwright/test";
const photo = { name:"synthetic.png", mimeType:"image/png", buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==","base64") };

test("mobile web FAB offers camera, handles denied camera and imports selected photos separately", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => { Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:async()=>{throw new DOMException("Synthetic denial","NotAllowedError");}}}); });
  await page.goto("/?scenario=wardrobe");
  await page.getByRole("button",{name:"Add outfit",exact:true}).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("access declined");
  const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"Choose photo",exact:true}).click();
  const picker=await chooser;expect(picker.isMultiple()).toBe(true);
  await picker.setFiles([photo,{...photo,name:"second.png"}]);
  await expect(page.getByRole("button",{name:"Add outfit",exact:true})).toBeEnabled();
  await expect.poll(async()=>{const s=await page.request.get("/__fixture/state").then(r=>r.json());return s.calls.filter((c:{operation:string})=>c.operation==="daily-fit").length;}).toBe(2);
});

test("piece selection and dismissal stay inside the sheet with images and inline choices",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/?scenario=history");
  await page.getByRole("button",{name:"Swap a piece",exact:true}).click();await page.getByRole("button",{name:"Add a piece",exact:true}).click();
  const choices=page.getByRole("region",{name:"Choose a piece"});await expect(choices).toBeVisible();await expect(choices.getByRole("combobox")).toHaveCount(0);
  await expect.poll(async () => choices.locator("img").evaluateAll(images => images.length > 0 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await choices.getByRole("searchbox").fill("coat");await expect(choices.getByRole("button")).toHaveCount(1);await choices.getByRole("button").click();
  await expect(page.getByRole("dialog").getByText("Synthetic coat",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Done",exact:true}).click();
  await page.getByRole("button",{name:"Dismiss suggestion",exact:true}).click();await expect(page.getByRole("dialog").getByRole("combobox")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Dismiss outfit",exact:true})).toBeEnabled();
  await page.getByRole("button", {name:"Dismiss outfit",exact:true}).click(); await expect(page.getByRole("dialog")).toHaveCount(0); await page.reload();
  const dismissed = await page.request.get("/__fixture/state").then(r=>r.json()); expect(dismissed.data.suggestions[0].status).toBe("dismissed");
});

test("labels save and collection removal restores while preserving pieces",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/?scenario=wardrobe");
  await page.getByRole("button",{name:"Open Overshirt details",exact:true}).click();await page.getByRole("button",{name:"Labels",exact:false}).click();
  await expect(page.getByText("Between wears",{exact:true})).toHaveCount(0); await expect(page.getByRole("checkbox",{name:/ready to wear/})).toHaveCount(0); await expect(page.getByRole("button",{name:/check before wearing|Wash or prepare|suitable to rewear/})).toHaveCount(0);
  await page.getByRole("textbox",{name:"Category",exact:true}).fill("Personal category");await page.getByRole("textbox",{name:"Labels, separated by commas",exact:true}).fill("My label, Cotton");await page.getByRole("button",{name:"Save labels",exact:true}).click();await expect(page.getByText("Labels saved.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Close",exact:true}).click();
  await page.reload(); await page.getByRole("button",{name:"Open Personal category details",exact:true}).click(); await page.getByRole("button",{name:"Labels",exact:false}).click(); await expect(page.getByRole("textbox",{name:"Category",exact:true})).toHaveValue("Personal category"); await expect(page.getByRole("textbox",{name:"Labels, separated by commas",exact:true})).toHaveValue("My label, Cotton"); await page.getByRole("button",{name:"Close",exact:true}).click();
  await page.getByRole("button",{name:"Work edit",exact:true}).click();await page.getByRole("button",{name:"Edit collection",exact:true}).click();await page.getByRole("button",{name:"Remove collection",exact:true}).click();
  await expect(page.getByText("Your pieces and photos stay in your wardrobe.",{exact:false})).toBeVisible();await page.getByRole("button",{name:"Remove collection",exact:true}).click();
  await expect(page.getByRole("region",{name:"Removed collections"}).getByText("Work edit")).toBeVisible();
  const before=await page.request.get("/__fixture/state").then(r=>r.json());expect(before.catalog.items).toHaveLength(4);expect(before.catalog.memberships).toHaveLength(6);
  await page.getByRole("region",{name:"Removed collections"}).getByRole("button",{name:"Restore",exact:true}).click();await expect(page.getByRole("button",{name:"Work edit",exact:true})).toBeVisible();
});


test("intentional planning requests location once; denial allows planning and options contain no manual city picker", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => { let calls = 0; Object.defineProperty(navigator, "geolocation", { configurable:true,value:{getCurrentPosition:(_success:unknown,failure:(error:{code:number})=>void)=>{ calls++; (window as unknown as {geoCalls:number}).geoCalls = calls; failure({code:1}); }} }); });
  await page.goto("/?scenario=planner&case=permissions");
  expect(await page.evaluate(() => (window as unknown as {geoCalls?:number}).geoCalls ?? 0)).toBe(0);
  await expect(page.getByRole("button",{name:"Planner options",exact:true})).toHaveCount(0);
  await expect(page.getByRole("combobox",{name:"City for weather (optional)"})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Use my location",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Describe your day or week",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"access declined"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Continue without Calendar",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Continue without Calendar",exact:true}).click();
  await expect(page.getByRole("button",{name:"Suggest outfit",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Close",exact:true}).click();
  await page.getByRole("button",{name:"Describe your day or week",exact:true}).click();
  expect(await page.evaluate(() => (window as unknown as {geoCalls?:number}).geoCalls)).toBe(1);
  await expect(page.getByRole("button",{name:"Continue without Calendar",exact:true})).toHaveCount(0);
  const state=await page.request.get("/__fixture/state").then(r=>r.json());expect(state.calls.some((call:{operation:string})=>call.operation==="calendar_connect")).toBe(false);
});
