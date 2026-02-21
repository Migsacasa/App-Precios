const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function upsertUser(email, name, role, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return prisma.user.update({
      where: { email },
      data: { name, role, passwordHash },
    });
  }

  return prisma.user.create({
    data: { email, name, role, passwordHash },
  });
}

async function main() {
  await upsertUser("admin@local.com", "Admin", "ADMIN", "Admin123!");
  await upsertUser("manager@local.com", "Manager", "MANAGER", "Manager123!");
  await upsertUser("field@local.com", "Field", "FIELD", "Field123!");

  const stores = [
    { customerCode: "CUST-001", name: "Market Central", city: "Managua", lat: 12.1364, lng: -86.2514 },
    { customerCode: "CUST-002", name: "Tienda Norte", city: "Managua", lat: 12.151, lng: -86.245 },
    { customerCode: "CUST-003", name: "Repuestos Sur", city: "Masaya", lat: 11.9744, lng: -86.0942 },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { customerCode: store.customerCode },
      update: { ...store, active: true },
      create: store,
    });
  }

  const products = [
    { sku: "LUB-10W30-1L", segment: "LUBRICANTS", name: "Premium Oil 10W-30", brand: "Shell", category: "Motor Oil" },
    { sku: "LUB-5W30-1L", segment: "LUBRICANTS", name: "Synthetic Oil 5W-30", brand: "Mobil", category: "Motor Oil" },
    { sku: "BAT-12V-70AH", segment: "BATTERIES", name: "Battery 12V 70Ah", brand: "Bosch", category: "Automotive Battery" },
    { sku: "TIR-RAD-15IN", segment: "TIRES", name: "Radial Tire 15in", brand: "Bridgestone", category: "All-Season Tire" },
  ];

  for (const item of products) {
    await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        segment: item.segment,
        name: item.name,
        brand: item.brand,
        category: item.category,
        active: true,
      },
      create: item,
    });
  }

  console.log("Seed complete.");
  console.log("Admin: admin@local.com / Admin123!");
  console.log("Manager: manager@local.com / Manager123!");
  console.log("Field: field@local.com / Field123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
