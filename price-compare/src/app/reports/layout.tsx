import { Breadcrumbs } from "@/components/breadcrumbs";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <Breadcrumbs />
      {children}
    </div>
  );
}