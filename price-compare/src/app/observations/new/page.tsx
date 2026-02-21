import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NewObservationForm } from "./NewObservationForm";

export default async function NewObservationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [stores, products] = await Promise.all([
    prisma.store.findMany({
      where: { active: true },
      orderBy: [{ city: "asc" }, { name: "asc" }],
      select: {
        id: true,
        customerCode: true,
        name: true,
        city: true,
        lat: true,
        lng: true,
      },
    }),
    prisma.product.findMany({ where: { active: true }, orderBy: [{ segment: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Store Evaluation Capture</h1>
      <NewObservationForm
        initialStores={stores.map((store) => ({
          id: store.id,
          customerCode: store.customerCode,
          name: store.name,
          city: store.city,
          lat: Number(store.lat),
          lng: Number(store.lng),
        }))}
        productRefs={products.map((p) => ({
          id: p.id,
          segment: p.segment,
          name: p.name,
          brand: p.brand,
          category: p.category,
        }))}
      />
    </div>
  );
}