import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StoresTable } from "@/components/stores-table";

export default async function StoresPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  let data: Array<{
    id: string;
    competitor: string;
    chain: string;
    name: string;
    city: string;
    coords: string;
  }> = [];
  let error: string | null = null;

  try {
    const stores = await prisma.store.findMany({
      include: {
        evaluations: {
          orderBy: { capturedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ city: "asc" }, { name: "asc" }],
    });

    data = stores.map((s) => ({
      id: s.id,
      competitor: s.customerCode,
      chain: s.evaluations[0]?.aiRating ?? "PENDING",
      name: s.name,
      city: s.city ?? "-",
      coords: s.lat && s.lng ? `${s.lat}, ${s.lng}` : "-",
    }));
  } catch (e) {
    console.error("Failed to load stores:", e);
    error = "Could not load stores. Please try again later.";
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Imported Stores</h1>

      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded">
          {error}
        </div>
      )}

      <StoresTable data={data} />
    </div>
  );
}
