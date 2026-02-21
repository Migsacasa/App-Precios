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
  const productName = String(formData.get("productName") ?? "").trim();
  const specs = String(formData.get("specs") ?? "").trim();
  const ourPrice = Number(formData.get("ourPrice") ?? 0);
  const referencePhotoUrl = String(formData.get("referencePhotoUrl") ?? "").trim();

  if (!["LUBRICANTS", "BATTERIES", "TIRES"].includes(segment)) return;
  if (!productName || !Number.isFinite(ourPrice) || ourPrice <= 0) return;

  await prisma.ourProduct.create({
    data: {
      segment: segment as "LUBRICANTS" | "BATTERIES" | "TIRES",
      productName,
      specs: specs || null,
      ourPrice,
      referencePhotoUrl: referencePhotoUrl || null,
    },
  });

  revalidatePath("/admin/products");
}

export default async function AdminProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/observations");

  const products = await prisma.ourProduct.findMany({
    orderBy: [{ segment: "asc" }, { productName: "asc" }],
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin Products</h1>
      <p className="text-sm opacity-80">Manage segment specs, our prices, and reference photos.</p>

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
          <input name="productName" className="w-full border rounded px-2 py-2" required />
        </div>
        <div>
          <label className="text-xs">Specs</label>
          <input name="specs" className="w-full border rounded px-2 py-2" />
        </div>
        <div>
          <label className="text-xs">Our Price</label>
          <input name="ourPrice" type="number" step="0.01" min="0" className="w-full border rounded px-2 py-2" required />
        </div>
        <button className="border rounded px-3 py-2">Add Product</button>
        <div className="md:col-span-5">
          <label className="text-xs">Reference Photo URL (optional)</label>
          <input name="referencePhotoUrl" className="w-full border rounded px-2 py-2" />
        </div>
      </form>

      <ProductCsvImport />

      <ProductsInlineTable
        initialRows={products.map((product) => ({
          id: product.id,
          segment: product.segment,
          productName: product.productName,
          specs: product.specs ?? "",
          ourPrice: Number(product.ourPrice),
          referencePhotoUrl: product.referencePhotoUrl ?? "",
          isActive: product.isActive,
        }))}
      />
    </div>
  );
}
