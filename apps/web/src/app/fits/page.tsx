import { redirect } from "next/navigation";
export default async function FitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "view" || value === undefined) continue;
    for (const part of Array.isArray(value) ? value : [value])
      query.append(key, part);
  }
  const suffix = query.size ? `?${query}` : "";
  redirect(`/fits/${params.view === "diary" ? "diary" : "plan"}${suffix}`);
}
