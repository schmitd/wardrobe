import { expect, test } from "bun:test";
import { Effect } from "effect";
import { outfitText } from "../lib/outfitText";
import { nearbyWeatherCity, requestWeatherCity } from "../lib/weatherLocation";
import { everydayOutfits } from "./planningFallback";
import { recommendWeek } from "./inference/planning";
import { type InferenceRequest, InferenceService } from "../services/InferenceService";

const itemId = "jh706w4cy2qx11yv9mq6nzpn758fzwg5";
test("legacy prose loses removed IDs and aliases without changing garment names", () => {
  expect(outfitText(`Khaki trousers (${itemId}), with sneakers (piece_2).`)).toBe("Khaki trousers, with sneakers.");
  expect(outfitText("Cotton tee; 32-inch waist, navy, spring 2026.")).toBe("Cotton tee; 32-inch waist, navy, spring 2026.");
});
const piece = (id: string, category: string) => ({ id, category, description: `${id} cotton`, note: "" });
const data = { items: [piece("topA", "top"), piece("topB", "top"), piece("bottomA", "bottom"), piece("bottomB", "bottom"), piece("shoe", "footwear")], plans: [], bio: "", history: [], suggestions: [], inventoryTruncated: false };
const days = Array.from({length:7}, (_, i) => ({ date:`2026-10-${String(i+10).padStart(2,"0")}`, description:"", calendar:null }));
test("seven-day fallback rotates available clothing and records honest repeat checks", () => {
  const outfits = everydayOutfits(data, days);
  expect(outfits[0].itemIds).not.toEqual(outfits[1].itemIds);
  expect(outfits[2].rationale).toContain("Check repeated clothing is ready");
  expect(outfits.every(outfit => outfit.itemIds.includes("shoe"))).toBe(true);
});
test("recorded wear and user preparation rules apply; user readiness correction restores eligibility", () => {
  const source = { ...data, items: data.items.map(item => ({...item, ...(item.id === "topA" ? {wearPolicy:"after_each_wear" as const} : {})})), wearHistory:[{date:"2026-10-09",itemIds:["topA"],wornAt:100}] };
  expect(everydayOutfits(source, days)[0].itemIds).toContain("topB");
  expect(everydayOutfits(source, days).every(outfit => !outfit.itemIds.includes("topA"))).toBe(true);
  const corrected = { ...source, items:source.items.map(item => ({...item, wearReadyAt:200})) };
  const outfits = everydayOutfits(corrected, days);
  expect(outfits.filter(outfit => outfit.itemIds.includes("topA"))).toHaveLength(1);
});
test("inference sends aliases, maps only known aliases and removes references from prose", async () => {
  let prompt="";
  const source={...data,items:[{...piece(itemId,"top"),description:"Blue shirt"}]};
  const service={generateContent:(input:InferenceRequest|string)=>{prompt=JSON.stringify(input);return Effect.succeed({response:{text:()=>JSON.stringify({outfits:[{date:days[0].date,title:`Blue shirt (${itemId})`,rationale:"Wear the blue shirt (piece_1).",itemIds:["piece_1"],missing:["Shoes"]}]})}});},embedContent:()=>Effect.die("unexpected"),batchEmbedContents:()=>Effect.die("unexpected"),transcribe:()=>Effect.die("unexpected")};
  const [outfit]=await Effect.runPromise(recommendWeek({data:source,days:[days[0]],timezone:"UTC"}).pipe(Effect.provideService(InferenceService,service)));
  expect(prompt).not.toContain(itemId);expect(prompt).toContain("piece_1");
  expect(outfit.itemIds).toEqual([itemId]);expect(outfit.title).toBe("Blue shirt");expect(outfit.rationale).toBe("Wear the blue shirt.");
});
test("location maps locally to a supported coarse city and denial leaves manual fallback", async () => {
  expect(nearbyWeatherCity(35.23,-80.84)?.id).toBe("4460243");
  expect(nearbyWeatherCity(NaN,0)).toBeNull();expect(nearbyWeatherCity(0,0)).toBeNull();
  let options:PositionOptions|undefined;
  await expect(requestWeatherCity({getCurrentPosition:(_success,error,opts)=>{options=opts;error?.({code:1} as GeolocationPositionError);}})).rejects.toThrow("Choose a city");
  expect(options?.enableHighAccuracy).toBe(false);
});

test("limited wardrobe repeats remain valid when the spare clothing needs preparation", async () => {
  const items = [piece("shirt", "Shirt"), piece("pants", "Trousers"), piece("shoe", "Shoes"), {...piece("spare", "Top"), wearPolicy:"after_each_wear" as const}];
  const source = {...data, items, wearHistory:[{date:"2026-10-09", itemIds:["spare"], wornAt:100}]};
  const service = { generateContent:()=>Effect.succeed({response:{text:()=>JSON.stringify({outfits:days.slice(0,2).map(day=>({date:day.date,title:"Client meeting outfit", rationale:"Check the only available clothing before repeating.",itemIds:["piece_1","piece_2","piece_3"],missing:[]}))})}}), embedContent:()=>Effect.die("unexpected"),batchEmbedContents:()=>Effect.die("unexpected"),transcribe:()=>Effect.die("unexpected") };
  const outfits = await Effect.runPromise(recommendWeek({data:source,days:days.slice(0,2),timezone:"UTC"}).pipe(Effect.provideService(InferenceService,service)));
  expect(outfits.map(outfit=>outfit.title)).toEqual(["Client meeting outfit","Client meeting outfit"]);
});

test("an accessory cannot disguise repeated clothing when an eligible shirt alternative exists", async () => {
  const source={...data,items:[piece("shirt","Shirt"),piece("pants","Trousers"),piece("shoe","Shoes"),piece("alternate","Shirt"),piece("watch","Watch")]};
  const service={generateContent:()=>Effect.succeed({response:{text:()=>JSON.stringify({outfits:days.slice(0,2).map((day,index)=>({date:day.date,title:"Business outfit",rationale:"Review readiness.",itemIds:["piece_1","piece_2","piece_3",...(index?["piece_5"]:[])],missing:[]}))})}}),embedContent:()=>Effect.die("unexpected"),batchEmbedContents:()=>Effect.die("unexpected"),transcribe:()=>Effect.die("unexpected")};
  await expect(Effect.runPromise(recommendWeek({data:source,days:days.slice(0,2),timezone:"UTC"}).pipe(Effect.provideService(InferenceService,service)))).rejects.toThrow();
  const varied={...service,generateContent:()=>Effect.succeed({response:{text:()=>JSON.stringify({outfits:days.slice(0,2).map((day,index)=>({date:day.date,title:"Business outfit",rationale:"Review readiness.",itemIds:[index?"piece_4":"piece_1","piece_2","piece_3","piece_5"],missing:[]}))})}})};
  const outfits=await Effect.runPromise(recommendWeek({data:source,days:days.slice(0,2),timezone:"UTC"}).pipe(Effect.provideService(InferenceService,varied)));
  expect(outfits[1].itemIds).toContain("alternate");
});
