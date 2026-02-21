import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StoreEditor } from "@/components/admin/store-editor";
import { StoreCsvImport } from "@/components/admin/store-csv-import";
import { StoreCreateForm } from "@/components/admin/store-create-form";

export default async function AdminStoresPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/observations");

  const stores = await prisma.store.findMany({
    orderBy: [{ city: "asc" }, { customerName: "asc" }],
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin Stores</h1>
      <p className="text-sm opacity-80">Import stores from CSV and edit location data.</p>
      <StoreCsvImport />
      <StoreCreateForm />
      <StoreEditor
        stores={stores.map((store) => ({
          id: store.id,
          customerCode: store.customerCode,
          customerName: store.customerName,
          chain: store.chain ?? "",
          city: store.city ?? "",
          address: store.address ?? "",
          lat: store.lat,
          lng: store.lng,
          isActive: store.isActive,
        }))}
      />
    </div>
  );
}
