import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// DEVELOPMENT-ONLY SEED SCRIPT.
//
// Creates role-based login accounts sharing one well-known password, purely
// so a fresh dev environment is immediately usable for testing every role.
// This must never be run against a production database — real deployments
// should create staff accounts (with their own passwords) through the
// application's own user management once that exists, not through this
// script. Refuses to run unless explicitly allowed, so a stray `npm run
// db:seed` against a production DATABASE_URL can't silently plant these
// accounts there.
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_SEED !== "true") {
  console.error(
    "Refusing to run prisma/seed.ts with NODE_ENV=production. This script creates development-only " +
      "accounts with a shared, publicly-known password and must never be used to provision production users."
  );
  process.exit(1);
}

const SEED_PASSWORD = "Passw0rd!123";

const SEED_USERS = [
  { email: "owner@shanvienterprises.com", name: "Asha Shanvi", role: "OWNER_ADMIN" },
  { email: "sales@shanvienterprises.com", name: "Rohan Sales", role: "SALES" },
  { email: "purchase@shanvienterprises.com", name: "Meera Purchase", role: "PURCHASE" },
  { email: "inventory@shanvienterprises.com", name: "Vikram Inventory", role: "INVENTORY" },
  { email: "accounts@shanvienterprises.com", name: "Priya Accounts", role: "ACCOUNTS" },
  { email: "pm@shanvienterprises.com", name: "Karan PM", role: "PROJECT_MANAGER" },
  { email: "installer@shanvienterprises.com", name: "Suresh Installer", role: "INSTALLATION_TEAM" },
  { email: "service@shanvienterprises.com", name: "Divya Service", role: "SERVICE_MAINTENANCE" },
] as const;

// Master data — reference/config data, not transactions, so seeding a
// sensible starting set is reasonable (matches the categories/brands/units
// named as examples in the product spec).
const SEED_CATEGORIES = [
  { name: "Solar Panel", group: "SOLAR" },
  { name: "Solar Inverter", group: "SOLAR" },
  { name: "Mounting Structure", group: "SOLAR" },
  { name: "Solar Cable", group: "SOLAR" },
  { name: "ACDB", group: "SOLAR" },
  { name: "DCDB", group: "SOLAR" },
  { name: "Connector", group: "SOLAR" },
  { name: "Protection", group: "SOLAR" },
  { name: "Accessories", group: "SOLAR" },
  { name: "DG Set", group: "GENERATOR" },
  { name: "AMF Panel", group: "GENERATOR" },
  { name: "Synchronization Panel", group: "GENERATOR" },
  { name: "Generator Accessories", group: "GENERATOR" },
  { name: "Battery", group: "POWER_BACKUP" },
  { name: "Inverter", group: "POWER_BACKUP" },
  { name: "UPS", group: "POWER_BACKUP" },
  { name: "Battery Accessories", group: "POWER_BACKUP" },
  { name: "Installation", group: "SERVICES" },
  { name: "Transportation", group: "SERVICES" },
  { name: "Civil Work", group: "SERVICES" },
  { name: "Maintenance", group: "SERVICES" },
  { name: "AMC", group: "SERVICES" },
  { name: "Repair", group: "SERVICES" },
  { name: "Other Services", group: "SERVICES" },
] as const;

const SEED_BRANDS = ["Waaree", "Adani Solar", "Tata Power Solar", "Exide", "Kirloskar"] as const;

const SEED_UNITS = [
  { name: "Piece", abbreviation: "Pc" },
  { name: "Nos", abbreviation: "Nos" },
  { name: "Set", abbreviation: "Set" },
  { name: "Meter", abbreviation: "m" },
  { name: "Kg", abbreviation: "kg" },
  { name: "Litre", abbreviation: "L" },
  { name: "Hour", abbreviation: "hr" },
  { name: "Service", abbreviation: "Svc" },
] as const;

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "shanvi-enterprises" },
    update: {},
    create: {
      id: "shanvi-enterprises",
      name: "Shanvi Enterprises",
      businessType: "ENERGY_SOLUTIONS",
    },
  });

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const seedUser of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {},
      create: {
        companyId: company.id,
        email: seedUser.email,
        name: seedUser.name,
        role: seedUser.role,
        passwordHash,
      },
    });
  }

  await prisma.location.upsert({
    where: { companyId_name: { companyId: company.id, name: "Main Warehouse" } },
    update: {},
    create: { companyId: company.id, name: "Main Warehouse", isDefault: true },
  });

  for (const category of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { companyId_name: { companyId: company.id, name: category.name } },
      update: {},
      create: { companyId: company.id, ...category },
    });
  }

  for (const brandName of SEED_BRANDS) {
    await prisma.brand.upsert({
      where: { companyId_name: { companyId: company.id, name: brandName } },
      update: {},
      create: { companyId: company.id, name: brandName },
    });
  }

  for (const unit of SEED_UNITS) {
    await prisma.unit.upsert({
      where: { companyId_name: { companyId: company.id, name: unit.name } },
      update: {},
      create: { companyId: company.id, ...unit },
    });
  }

  console.log(`Seeded company "${company.name}" with ${SEED_USERS.length} users.`);
  console.log(
    `Seeded ${SEED_CATEGORIES.length} categories, ${SEED_BRANDS.length} brands, ${SEED_UNITS.length} units, and a default warehouse.`
  );
  console.log(`All seed users share the password: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
