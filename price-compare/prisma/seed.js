const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const bcrypt = require("bcryptjs");

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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
    { customerCode: "CUST-001", customerName: "Market Central", city: "Managua", lat: 12.1364, lng: -86.2514 },
    { customerCode: "CUST-002", customerName: "Tienda Norte", city: "Managua", lat: 12.151, lng: -86.245 },
    { customerCode: "CUST-003", customerName: "Repuestos Sur", city: "Masaya", lat: 11.9744, lng: -86.0942 },
  ];

  for (const store of stores) {
    await prisma.store.upsert({
      where: { customerCode: store.customerCode },
      update: { ...store, isActive: true },
      create: store,
    });
  }

  const products = [
    { segment: "LUBRICANTS", productName: "Premium Oil 10W-30", specs: "1L", ourPrice: 320 },
    { segment: "LUBRICANTS", productName: "Synthetic Oil 5W-30", specs: "1L", ourPrice: 410 },
    { segment: "BATTERIES", productName: "Battery 12V 70Ah", specs: "Maintenance-free", ourPrice: 3950 },
    { segment: "TIRES", productName: "Radial Tire 15in", specs: "All season", ourPrice: 2850 },
  ];

  for (const item of products) {
    await prisma.ourProduct.upsert({
      where: {
        id: `${item.segment}-${item.productName}`.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase(),
      },
      update: {
        segment: item.segment,
        productName: item.productName,
        specs: item.specs,
        ourPrice: item.ourPrice,
        isActive: true,
      },
      create: {
        id: `${item.segment}-${item.productName}`.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase(),
        segment: item.segment,
        productName: item.productName,
        specs: item.specs,
        ourPrice: item.ourPrice,
      },
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
