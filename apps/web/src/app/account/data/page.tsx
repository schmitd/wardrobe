import { auth } from "@clerk/nextjs/server";
import DataManagement from "@/components/DataManagement";

export default async function DataManagementPage() {
  await auth.protect();
  return <DataManagement />;
}
