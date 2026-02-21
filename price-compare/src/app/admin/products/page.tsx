import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductsInlineTable } from "@/components/admin/products-inline-table";
import { ProductCsvImport } from "@/components/admin/product-csv-import";
import { revalidatePath } from "next/cache";

async function createProduct(formData: FormData) {
  "use server";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/observations");
  }

  const segment = String(formData.get("segment") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!["LUBRICANTS", "BATTERIES", "TIRES"].includes(segment)) return;
  if (!name) return;

  await prisma.product.create({
    data: {
      segment: segment as "LUBRICANTS" | "BATTERIES" | "TIRES",
      name,
      sku: sku || `AUTO-${name.replace(/\s+/g, "-").toUpperCase()}`,
      brand: brand || null,
      category: category || null,
    },
  });

  revalidatePath("/admin/products");
}

export default async function AdminProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/observations");

  const products = await prisma.product.findMany({
    orderBy: [{ segment: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin Products</h1>
      <p className="text-sm opacity-80">Manage segment specs, pricing, and reference photos.</p>

      <form action={createProduct} className="border rounded p-4 grid md:grid-cols-5 gap-2 items-end">
        <div>
          <label className="text-xs">Segment</label>
          <select name="segment" className="w-full border rounded px-2 py-2" defaultValue="LUBRICANTS">
            <option value="LUBRICANTS">LUBRICANTS</option>
            <option value="BATTERIES">BATTERIES</option>
            <option value="TIRES">TIRES</option>
          </select>
        </div>
        <div>
          <label className="text-xs">Product Name</label>
          <input name="name" className="w-full border rounded px-2 py-2" required />
        </div>
        <div>
          <label className="text-xs">SKU</label>
          <input name="sku" className="w-full border rounded px-2 py-2" />
        </div>
        <div>
          <label className="text-xs">Brand</label>
          <input name="brand" className="w-full border rounded px-2 py-2" />
        </div>
        <button className="border rounded px-3 py-2">Add Product</button>
        <div className="md:col-span-5">
          <label className="text-xs">Category (optional)</label>
          <input name="category" className="w-full border rounded px-2 py-2" />
        </div>
      </form>

      <ProductCsvImport />

      <ProductsInlineTable
        initialRows={products.map((product) => ({
          id: product.id,
          segment: product.segment,
          name: product.name,
          sku: product.sku,
          brand: product.brand ?? "",
          category: product.category ?? "",
          active: product.active,
        }))}
      />
    </div>
  );
}
