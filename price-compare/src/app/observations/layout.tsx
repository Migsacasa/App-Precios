import { Breadcrumbs } from "@/components/breadcrumbs";

export default function ObservationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <Breadcrumbs />
      {children}
    </div>
  );
}