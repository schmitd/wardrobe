import {test,expect} from "playwright/test";
test("rejected lazy loader recovers through actual reload while preserving guest draft",async({page})=>{
 await page.addInitScript(()=>{if(!sessionStorage.getItem("wardrobe.guestSnapshot.v1"))sessionStorage.setItem("wardrobe.guestSnapshot.v1",JSON.stringify({version:1,createdAt:100,bio:"Anonymous draft",items:[]}));});
 await page.goto("/?scenario=module-recovery");
 await expect(page.getByRole("alert")).toContainText("could not load");
 const reload=page.waitForEvent("load");
 await page.getByRole("button",{name:"Reload wardrobe"}).click();
 await reload;
 await expect(page.getByRole("heading",{name:"Recovered wardrobe module"})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("wardrobe.guestSnapshot.v1")!).bio)).toBe("Anonymous draft");
});
