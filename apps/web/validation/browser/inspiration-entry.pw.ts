import { test, expect } from "playwright/test";

for (const width of [320, 390]) test(`collection inspiration cancel/remove/reload/restore failure retry (${width})`, async ({page}) => {
  await page.setViewportSize({width,height:844});
  await page.goto("/?scenario=wardrobe");
  const open = async () => {
    await page.getByRole("button",{name:"Saved ideas",exact:true}).click();
    await page.getByRole("button",{name:"inspiration",exact:true}).click();
  };
  await open();
  const card = page.getByRole("article").filter({hasText:"Navy layers"});
  await card.getByRole("button",{name:"Remove",exact:true}).click();
  await card.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(card.getByRole("button",{name:"Remove",exact:true})).toBeFocused();
  await card.getByRole("button",{name:"Remove",exact:true}).click();
  await card.getByRole("button",{name:"Remove inspiration",exact:true}).click();
  await expect(page.getByRole("region",{name:"Removed inspiration",exact:true}).getByText("Navy layers",{exact:true})).toBeVisible();
  await page.reload(); await open(); await expect(card).toHaveCount(0);
  await page.getByRole("button",{name:"Removed inspiration",exact:true}).click();
  const removed = page.getByRole("region",{name:"Removed inspiration",exact:true});
  await expect(removed.getByText("Navy layers",{exact:true})).toBeVisible();
  let fail = true;
  await page.route("**/__fixture/action/mutation", async route => {
    const input = route.request().postDataJSON();
    if (fail && input.name === "wardrobe.setInspirationRemoved") {
      fail = false; await route.fulfill({status:503,json:{error:"Synthetic temporary failure"}});
    } else await route.continue();
  });
  await removed.getByRole("button",{name:"Restore",exact:true}).click();
  await expect(removed.getByRole("alert")).toHaveText("Could not restore inspiration. Try again.");
  await removed.getByRole("button",{name:"Restore",exact:true}).click();
  await expect(removed.getByRole("article")).toHaveCount(0);
  await expect(card).toHaveCount(1);
  const state = await page.request.get("/__fixture/state").then(r=>r.json());
  expect(state.catalog.items).toHaveLength(4);
  expect(state.catalog.inspirations).toHaveLength(3);
});
