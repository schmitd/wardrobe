import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { getConvexAuth } from "@/server/auth";
import { RequestFailure, publicServerFailure } from "@/server/errors";
import { exportFitPixels, readFitImage } from "@/server/fitImage";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { token } = await getConvexAuth();
    const { id } = await context.params;
    if (!/^[a-z0-9]{20,64}$/.test(id))
      throw new RequestFailure({ status: 403, message: "Photo unavailable." });
    const source = await fetchQuery(
      api.fitChecks.exportImage,
      { id: id as Id<"fitChecks"> },
      { token },
    );
    if (!source)
      throw new RequestFailure({ status: 403, message: "Photo unavailable." });
    const format =
      new URL(request.url).searchParams.get("format") === "png"
        ? "png"
        : "jpeg";
    const bytes = await readFitImage(
      await fetch(source.imageUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
        redirect: "error",
      }),
    );
    const exported = await exportFitPixels(bytes, format);
    const current = await fetchQuery(
      api.fitChecks.exportImage,
      { id: id as Id<"fitChecks"> },
      { token },
    );
    if (!current || current.revision !== source.revision)
      throw new RequestFailure({
        status: 409,
        message: "This photo changed. Prepare it again.",
      });
    return new Response(new Uint8Array(exported), {
      headers: {
        "Content-Type": `image/${format}`,
        "Content-Disposition": `attachment; filename="fit.${format === "jpeg" ? "jpg" : "png"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    const failure = publicServerFailure(
      error,
      "Could not prepare this photo. Please try again.",
    );
    return Response.json(
      { error: failure.message },
      { status: failure.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
