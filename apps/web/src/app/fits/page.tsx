import FitsClient from "@/components/FitsClient";
export default async function FitsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  return (
    <FitsClient initialView={params.view === "diary" ? "diary" : "plan"} />
  );
}
