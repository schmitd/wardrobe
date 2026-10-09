import FitsClient from "@/components/FitsClient";
export default function FitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FitsClient>{children}</FitsClient>;
}
