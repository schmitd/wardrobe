import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { getConvexAuth } from "@/server/auth";
import { publicServerFailure, RequestFailure } from "@/server/errors";
import { observeMobileRequest } from "@/server/mobileTelemetry";
export const runtime = "nodejs";
export async function GET(request: Request) { return observeMobileRequest(request, "bootstrap", handle); }
async function handle(request: Request) {
  try {
    const { token } = await getConvexAuth();
    const params = new URL(request.url).searchParams;
    const paginationOpts = { cursor: params.get("cursor"), numItems: 48 };
    if ((paginationOpts.cursor?.length ?? 0) > 5000) throw new RequestFailure({ status: 400, message: "Invalid page." });
    switch (params.get("view")) {
      case "closet": return Response.json(await fetchQuery(api.wardrobe.pageWardrobeItems, { paginationOpts }, { token }));
      case "fits": return Response.json(await fetchQuery(api.mobile.fits, { paginationOpts }, { token }));
      case "item": {
        const id = params.get("id");
        if (!id || !/^[a-z0-9]{20,64}$/.test(id)) throw new RequestFailure({ status: 400, message: "Invalid piece." });
        const [item] = await fetchQuery(api.wardrobe.getWardrobeItemsDisplayByIds, { itemIds: [id as Id<"wardrobeItems">] }, { token });
        return Response.json(item ?? null);
      }
      case "preview": {
        const id = params.get("id");
        if (!id || !/^[a-z0-9]{20,64}$/.test(id)) throw new RequestFailure({ status: 400, message: "Invalid piece." });
        return Response.json(await fetchQuery(api.garmentPreviewData.status, { itemId: id as Id<"wardrobeItems"> }, { token }));
      }
      case "plans": return Response.json(await fetchQuery(api.mobile.plans, { paginationOpts }, { token }));
      case "collection": {
        const id = params.get("id");
        if (!id || !/^[a-z0-9]{20,64}$/.test(id)) throw new RequestFailure({ status: 400, message: "Invalid plan." });
        return Response.json(await fetchQuery(api.mobile.collection, { wardrobeId: id as Id<"wardrobes">, paginationOpts }, { token }));
      }
      default: throw new RequestFailure({ status: 400, message: "Unknown view." });
    }
  } catch (error) {
    const failure = publicServerFailure(error, "Could not load this view. Please retry.");
    return Response.json({ error: failure.message }, { status: failure.status });
  }
}
