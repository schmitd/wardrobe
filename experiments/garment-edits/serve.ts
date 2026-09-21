import { resolve, relative, isAbsolute } from "node:path";

const isLoopbackHost = (host: string | null): boolean => {
  if (host === null) return false;
  const match = /^(?:127\.0\.0\.1|localhost)(?::(\d{1,5}))?$/i.exec(host);
  return match !== null && (match[1] === undefined || Number(match[1]) <= 65_535);
};

export const createGalleryHandler = (galleryRoot: string) =>
  async (request: Request): Promise<Response> => {
    if (!isLoopbackHost(request.headers.get("host"))) return new Response("Forbidden", { status: 403 });

    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const file = resolve(galleryRoot, `.${pathname === "/" ? "/index.html" : pathname}`);
    const suffix = relative(galleryRoot, file);
    if (suffix.startsWith("..") || isAbsolute(suffix) || !/\.(?:html|png|jpg)$/.test(file)) return new Response("Not found", { status: 404 });
    const data = Bun.file(file);
    if (!await data.exists()) return new Response("Not found", { status: 404 });
    return new Response(data, { headers: { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" } });
  };

if (import.meta.main) {
  const allowedRoot = resolve(import.meta.dir, "../../output/cutout-prototype");
  const root = resolve(allowedRoot, process.argv[2] ?? "local-second");
  if (relative(allowedRoot, root).startsWith("..") || isAbsolute(relative(allowedRoot, root))) throw new Error("Invalid study directory");

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: Number(process.argv[3] ?? 4918),
    fetch: createGalleryHandler(root),
  });
  console.log(`Private cutout study: ${server.url}`);
}
