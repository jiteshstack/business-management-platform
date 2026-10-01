import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// DEMO-DATA SEED — populates a deployment with realistic, obviously-fake
// business data so a client can walk the whole flow (quote → order → invoice
// → payment, purchase → receipt → payable, project → installation → warranty
// → service) without entering anything first.
//
// This DELETES all existing transactional data for the company before
// re-seeding, so it is a "reset the demo" button, not an "add more data"
// one. That is destructive by design and must never run against a database
// holding real business records — hence the explicit opt-in flag below,
// mirroring the guard on prisma/seed.ts.
if (process.env.CONFIRM_DEMO_RESET !== "true") {
  console.error(
    "Refusing to run: this wipes and re-seeds ALL transactional data for the company.\n" +
      "It is only for a demo/UAT environment. If that is genuinely what you want, re-run with:\n" +
      "  CONFIRM_DEMO_RESET=true npx tsx prisma/demo-seed.ts"
  );
  process.exit(1);
}

const DEMO_PASSWORD = "Shanvi@123";
const COMPANY_NAME = "Shanvi Enterprises";

// Staff accounts. The first is the client's main login; the rest exist so
// assignments (service engineer, installer, …) reference real people and so
// the role-based access control is demonstrable.
const DEMO_USERS = [
  { email: "sandeep@shanvi.com", name: "Sandeep Kumar", role: "OWNER_ADMIN" },
  { email: "rohan@shanvi.com", name: "Rohan Mehta", role: "SALES" },
  { email: "meera@shanvi.com", name: "Meera Iyer", role: "PURCHASE" },
  { email: "vikram@shanvi.com", name: "Vikram Singh", role: "INVENTORY" },
  { email: "priya@shanvi.com", name: "Priya Nair", role: "ACCOUNTS" },
  { email: "karan@shanvi.com", name: "Karan Desai", role: "PROJECT_MANAGER" },
  { email: "suresh@shanvi.com", name: "Suresh Yadav", role: "INSTALLATION_TEAM" },
  { email: "divya@shanvi.com", name: "Divya Rao", role: "SERVICE_MAINTENANCE" },
] as const;

const CATEGORIES = [
  { name: "Solar Panel", group: "SOLAR" },
  { name: "Solar Inverter", group: "SOLAR" },
  { name: "Mounting Structure", group: "SOLAR" },
  { name: "Solar Cable", group: "SOLAR" },
  { name: "ACDB", group: "SOLAR" },
  { name: "DCDB", group: "SOLAR" },
  { name: "DG Set", group: "GENERATOR" },
  { name: "AMF Panel", group: "GENERATOR" },
  { name: "Battery", group: "POWER_BACKUP" },
  { name: "Inverter", group: "POWER_BACKUP" },
  { name: "UPS", group: "POWER_BACKUP" },
  { name: "Installation", group: "SERVICES" },
  { name: "Transportation", group: "SERVICES" },
  { name: "Maintenance", group: "SERVICES" },
  { name: "AMC", group: "SERVICES" },
] as const;

const BRANDS = ["Waaree", "Adani Solar", "Tata Power Solar", "Exide", "Kirloskar", "Luminous"] as const;

const UNITS = [
  { name: "Piece", abbreviation: "Pc" },
  { name: "Nos", abbreviation: "Nos" },
  { name: "Set", abbreviation: "Set" },
  { name: "Meter", abbreviation: "m" },
  { name: "Service", abbreviation: "Svc" },
] as const;

const EXPENSE_CATEGORIES = [
  "Installation Labour",
  "Transportation",
  "Site Civil Work",
  "Tools & Consumables",
  "Travel & Lodging",
] as const;

// ---- date helpers: everything is relative to "today" so the dashboard,
// ageing buckets and 6-month trend chart always look populated, whenever
// the demo is run. ----
const NOW = new Date();
function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(10, 30, 0, 0);
  return d;
}
function daysAhead(n: number): Date {
  return daysAgo(-n);
}
// A date inside the CURRENT calendar month, clamped to today. The dashboard
// and reports default to a "This Month" range, so without at least a couple
// of documents dated this month the headline figures read zero — which is
// exactly what a demo must not do when it happens to be run on the 1st.
function thisMonth(dayOfMonth: number): Date {
  const candidate = new Date(NOW.getFullYear(), NOW.getMonth(), dayOfMonth, 11, 15, 0, 0);
  const today = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 11, 15, 0, 0);
  return candidate > today ? today : candidate;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type LineInput = {
  productId: string;
  productName: string;
  productCode: string | null;
  unitLabel: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

// Mirrors src/lib/energy/shared/pricing.ts: per-line tax on the discounted
// line, document total = taxable + tax + charges - overall discount.
function priceLines(lines: LineInput[], discountPercent = 0, otherCharges = 0) {
  const rows = lines.map((l, index) => {
    const lineSubtotal = round2(l.quantity * l.unitPrice);
    const taxAmount = round2((lineSubtotal * l.taxRate) / 100);
    return {
      productId: l.productId,
      productName: l.productName,
      productCode: l.productCode,
      unitLabel: l.unitLabel,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPercent: null,
      discountAmount: 0,
      taxRate: l.taxRate,
      taxAmount,
      lineSubtotal,
      lineTotal: round2(lineSubtotal + taxAmount),
      sortOrder: index,
    };
  });

  const subtotal = round2(rows.reduce((s, r) => s + r.lineSubtotal, 0));
  const taxAmount = round2(rows.reduce((s, r) => s + r.taxAmount, 0));
  const discountAmount = round2((subtotal * discountPercent) / 100);
  const taxableAmount = round2(subtotal - discountAmount);
  const grandTotal = round2(taxableAmount + taxAmount + otherCharges);

  return {
    rows,
    totals: {
      subtotal,
      discountPercent: discountPercent || null,
      discountAmount,
      taxableAmount,
      taxAmount,
      otherCharges,
      grandTotal,
    },
  };
}

async function main() {
  const company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) throw new Error(`Company "${COMPANY_NAME}" not found — nothing to seed into.`);
  const companyId = company.id;

  console.log(`Seeding demo data into "${company.name}" (${companyId})…`);

  // ---- 1. wipe existing transactional data (children first) ----
  await prisma.$transaction([
    prisma.maintenanceVisit.deleteMany({ where: { companyId } }),
    prisma.serviceRequest.deleteMany({ where: { companyId } }),
    prisma.aMC.deleteMany({ where: { companyId } }),
    prisma.warranty.deleteMany({ where: { companyId } }),
    prisma.installedEquipment.deleteMany({ where: { companyId } }),
    prisma.installation.deleteMany({ where: { companyId } }),
    prisma.projectMilestone.deleteMany({ where: { project: { companyId } } }),
    prisma.projectItem.deleteMany({ where: { project: { companyId } } }),
    prisma.energyProject.deleteMany({ where: { companyId } }),
    prisma.expense.deleteMany({ where: { companyId } }),
    prisma.vendorPaymentAllocation.deleteMany({ where: { vendorPayment: { companyId } } }),
    prisma.vendorPayment.deleteMany({ where: { companyId } }),
    prisma.vendorInvoiceLineItem.deleteMany({ where: { vendorInvoice: { companyId } } }),
    prisma.vendorInvoice.deleteMany({ where: { companyId } }),
    prisma.purchaseReceiptLineItem.deleteMany({ where: { purchaseReceipt: { companyId } } }),
    prisma.purchaseReceipt.deleteMany({ where: { companyId } }),
    prisma.purchaseOrderLineItem.deleteMany({ where: { purchaseOrder: { companyId } } }),
    prisma.purchaseOrder.deleteMany({ where: { companyId } }),
    prisma.paymentAllocation.deleteMany({ where: { payment: { companyId } } }),
    prisma.payment.deleteMany({ where: { companyId } }),
    prisma.invoiceLineItem.deleteMany({ where: { invoice: { companyId } } }),
    prisma.invoice.deleteMany({ where: { companyId } }),
    prisma.salesOrderLineItem.deleteMany({ where: { salesOrder: { companyId } } }),
    prisma.salesOrder.deleteMany({ where: { companyId } }),
    prisma.quotationLineItem.deleteMany({ where: { quotation: { companyId } } }),
    prisma.quotation.deleteMany({ where: { companyId } }),
    prisma.serialNumber.deleteMany({ where: { companyId } }),
    prisma.stockMovement.deleteMany({ where: { companyId } }),
    prisma.inventoryBalance.deleteMany({ where: { companyId } }),
    prisma.product.deleteMany({ where: { companyId } }),
    prisma.projectSite.deleteMany({ where: { companyId } }),
    prisma.partyNote.deleteMany({ where: { party: { companyId } } }),
    prisma.partyContact.deleteMany({ where: { party: { companyId } } }),
    prisma.partyAddress.deleteMany({ where: { party: { companyId } } }),
    prisma.party.deleteMany({ where: { companyId } }),
    prisma.expenseCategory.deleteMany({ where: { companyId } }),
    prisma.numberSequence.deleteMany({ where: { companyId } }),
    prisma.auditLog.deleteMany({ where: { companyId } }),
  ]);

  // ---- 2. company profile (used on printed quotations/invoices) ----
  await prisma.company.update({
    where: { id: companyId },
    data: {
      gstin: "27AABCS1429B1ZX",
      pan: "AABCS1429B",
      addressLine1: "Plot 14, MIDC Industrial Area",
      addressLine2: "Andheri East",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400093",
      phone: "+91 22 4512 7788",
      email: "info@shanvi.com",
      website: "www.shanvi.com",
      tagline: "Powering a cleaner tomorrow",
      bankAccountName: "Shanvi Enterprises",
      bankName: "HDFC Bank",
      bankAccountNumber: "50200034781902",
      bankIfsc: "HDFC0000312",
      defaultQuotationTerms:
        "1. Prices are inclusive of standard installation at site.\n" +
        "2. 50% advance along with purchase order, balance on commissioning.\n" +
        "3. Delivery within 3-4 weeks from receipt of confirmed order.\n" +
        "4. Warranty as per manufacturer terms stated in the annexure.\n" +
        "5. Any civil work, scaffolding or crane charges are to the client's account.",
    },
  });

  // ---- 3. users ----
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash, isActive: true, companyId },
      create: { companyId, email: u.email, name: u.name, role: u.role, passwordHash },
    });
    users[u.role] = user.id;
  }
  const adminId = users.OWNER_ADMIN;

  // ---- 4. master data ----
  const location =
    (await prisma.location.findFirst({ where: { companyId, isDefault: true } })) ??
    (await prisma.location.create({ data: { companyId, name: "Main Warehouse", isDefault: true } }));

  const categories: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { companyId_name: { companyId, name: c.name } },
      update: {},
      create: { companyId, ...c },
    });
    categories[c.name] = row.id;
  }

  const brands: Record<string, string> = {};
  for (const name of BRANDS) {
    const row = await prisma.brand.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name },
    });
    brands[name] = row.id;
  }

  const units: Record<string, string> = {};
  for (const u of UNITS) {
    const row = await prisma.unit.upsert({
      where: { companyId_name: { companyId, name: u.name } },
      update: {},
      create: { companyId, ...u },
    });
    units[u.name] = row.id;
  }

  const expenseCategories: Record<string, string> = {};
  for (const name of EXPENSE_CATEGORIES) {
    const row = await prisma.expenseCategory.create({ data: { companyId, name } });
    expenseCategories[name] = row.id;
  }

  // ---- 5. customers & vendors ----
  const customerSpecs = [
    {
      name: "Greenfield Textiles Pvt Ltd",
      businessName: "Greenfield Textiles Pvt Ltd",
      category: "Industrial",
      mobile: "9820012345",
      email: "accounts@greenfieldtextiles.in",
      gstin: "27AAACG2458P1Z9",
      city: "Mumbai",
      state: "Maharashtra",
      contact: { name: "Rakesh Shah", designation: "Plant Head", phone: "9820012346" },
      site: { name: "Greenfield Mill — Rooftop", line1: "Survey 42, Tarapur MIDC", city: "Boisar", pincode: "401506" },
    },
    {
      name: "Sunrise Hospitality Group",
      businessName: "Sunrise Hospitality Group",
      category: "Commercial",
      mobile: "9867045522",
      email: "projects@sunrisehotels.in",
      gstin: "27AAFCS8821K1ZT",
      city: "Pune",
      state: "Maharashtra",
      contact: { name: "Anita Desai", designation: "Facilities Manager", phone: "9867045523" },
      site: { name: "Sunrise Resort — Lonavala", line1: "Old Mumbai-Pune Highway", city: "Lonavala", pincode: "410401" },
    },
    {
      name: "Patel Agro Farms",
      businessName: "Patel Agro Farms LLP",
      category: "Agriculture",
      mobile: "9924478811",
      email: "patelagro@gmail.com",
      gstin: "24AALFP3391M1Z2",
      city: "Anand",
      state: "Gujarat",
      contact: { name: "Hiren Patel", designation: "Proprietor", phone: "9924478811" },
      site: { name: "Patel Farm — Pump House", line1: "Village Vadtal, Tal. Nadiad", city: "Anand", pincode: "388325" },
    },
    {
      name: "Nova Logistics Park",
      businessName: "Nova Logistics Park Pvt Ltd",
      category: "Warehousing",
      mobile: "9711203344",
      email: "ops@novalogistics.co.in",
      gstin: "27AADCN7712Q1ZB",
      city: "Bhiwandi",
      state: "Maharashtra",
      contact: { name: "Sameer Qureshi", designation: "Site Engineer", phone: "9711203345" },
      site: { name: "Nova Warehouse B2", line1: "Kalyan-Bhiwandi Road", city: "Bhiwandi", pincode: "421302" },
    },
    {
      name: "Dr. Kulkarni Diagnostics",
      businessName: "Kulkarni Diagnostics & Imaging",
      category: "Healthcare",
      mobile: "9890011223",
      email: "admin@kulkarnidiagnostics.in",
      gstin: "27AAJPK5567R1ZV",
      city: "Nashik",
      state: "Maharashtra",
      contact: { name: "Dr. Sunil Kulkarni", designation: "Director", phone: "9890011223" },
      site: { name: "Kulkarni Centre — Basement", line1: "Gangapur Road", city: "Nashik", pincode: "422013" },
    },
  ];

  const customers: { id: string; name: string; siteId: string }[] = [];
  for (const spec of customerSpecs) {
    const party = await prisma.party.create({
      data: {
        companyId,
        type: "CLIENT",
        name: spec.name,
        businessName: spec.businessName,
        category: spec.category,
        mobile: spec.mobile,
        email: spec.email,
        gstin: spec.gstin,
        city: spec.city,
        state: spec.state,
        paymentTerms: "30 days from invoice date",
        contacts: { create: [{ ...spec.contact, isPrimary: true }] },
        addresses: {
          create: [
            {
              type: "BILLING",
              label: "Registered Office",
              line1: spec.site.line1,
              city: spec.city,
              state: spec.state,
              pincode: spec.site.pincode,
              isDefault: true,
            },
          ],
        },
      },
    });
    const site = await prisma.projectSite.create({
      data: {
        companyId,
        customerId: party.id,
        name: spec.site.name,
        line1: spec.site.line1,
        city: spec.site.city,
        state: spec.state,
        pincode: spec.site.pincode,
        contactPerson: spec.contact.name,
        contactPhone: spec.contact.phone,
      },
    });
    customers.push({ id: party.id, name: party.name, siteId: site.id });
  }

  const vendorSpecs = [
    { name: "Waaree Energies Ltd", city: "Surat", state: "Gujarat", gstin: "24AAACW1234F1Z5", mobile: "9099887766" },
    { name: "Kirloskar Oil Engines", city: "Pune", state: "Maharashtra", gstin: "27AAACK0983N1ZQ", mobile: "9823011447" },
    { name: "Exide Industries", city: "Kolkata", state: "West Bengal", gstin: "19AAACE1234H1ZP", mobile: "9830022115" },
    { name: "Mahalaxmi Steel & Structures", city: "Nashik", state: "Maharashtra", gstin: "27AAGFM4432L1ZY", mobile: "9881234567" },
  ];
  const vendors: { id: string; name: string }[] = [];
  for (const v of vendorSpecs) {
    const party = await prisma.party.create({
      data: {
        companyId,
        type: "VENDOR",
        name: v.name,
        businessName: v.name,
        mobile: v.mobile,
        gstin: v.gstin,
        city: v.city,
        state: v.state,
        paymentTerms: "45 days",
      },
    });
    vendors.push({ id: party.id, name: party.name });
  }

  // ---- 6. products + opening stock ----
  const productSpecs = [
    { code: "SP-540W", name: "540W Monocrystalline Solar Panel", type: "EQUIPMENT", category: "Solar Panel", brand: "Waaree", unit: "Piece", purchase: 11200, selling: 15500, tax: 12, hsn: "85414011", warrantyMonths: 300, serial: true, stock: 160, reorder: 40 },
    { code: "INV-5KW", name: "5kW Grid-Tie Solar Inverter", type: "EQUIPMENT", category: "Solar Inverter", brand: "Tata Power Solar", unit: "Piece", purchase: 34000, selling: 47500, tax: 18, hsn: "85044090", warrantyMonths: 60, serial: true, stock: 24, reorder: 6 },
    { code: "INV-10KW", name: "10kW Grid-Tie Solar Inverter", type: "EQUIPMENT", category: "Solar Inverter", brand: "Tata Power Solar", unit: "Piece", purchase: 62000, selling: 84000, tax: 18, hsn: "85044090", warrantyMonths: 60, serial: true, stock: 9, reorder: 4 },
    { code: "MS-STD", name: "Standard Mounting Structure Set", type: "MATERIAL", category: "Mounting Structure", brand: "Mahalaxmi", unit: "Set", purchase: 3900, selling: 5500, tax: 18, hsn: "73089090", warrantyMonths: 60, serial: false, stock: 85, reorder: 25 },
    { code: "DC-CBL-6", name: "6 sq.mm Solar DC Cable", type: "MATERIAL", category: "Solar Cable", brand: "Waaree", unit: "Meter", purchase: 62, selling: 95, tax: 18, hsn: "85444920", warrantyMonths: null, serial: false, stock: 2400, reorder: 500 },
    { code: "ACDB-1P", name: "ACDB Single Phase Protection Box", type: "MATERIAL", category: "ACDB", brand: "Waaree", unit: "Piece", purchase: 2600, selling: 3900, tax: 18, hsn: "85371000", warrantyMonths: 24, serial: false, stock: 18, reorder: 8 },
    { code: "DG-125KVA", name: "125 kVA Diesel Generator Set", type: "EQUIPMENT", category: "DG Set", brand: "Kirloskar", unit: "Piece", purchase: 785000, selling: 985000, tax: 18, hsn: "85021100", warrantyMonths: 24, serial: true, stock: 3, reorder: 1 },
    { code: "DG-250KVA", name: "250 kVA Diesel Generator Set", type: "EQUIPMENT", category: "DG Set", brand: "Kirloskar", unit: "Piece", purchase: 1320000, selling: 1640000, tax: 18, hsn: "85021100", warrantyMonths: 24, serial: true, stock: 1, reorder: 1 },
    { code: "BAT-150AH", name: "150Ah Tubular Battery", type: "EQUIPMENT", category: "Battery", brand: "Exide", unit: "Piece", purchase: 12800, selling: 17200, tax: 28, hsn: "85072000", warrantyMonths: 36, serial: true, stock: 40, reorder: 12 },
    { code: "UPS-3KVA", name: "3 kVA Online UPS", type: "EQUIPMENT", category: "UPS", brand: "Luminous", unit: "Piece", purchase: 28500, selling: 39000, tax: 18, hsn: "85044010", warrantyMonths: 24, serial: false, stock: 6, reorder: 3 },
    { code: "SRV-INST", name: "Installation & Commissioning", type: "SERVICE", category: "Installation", brand: null, unit: "Service", purchase: null, selling: 25000, tax: 18, hsn: "995461", warrantyMonths: null, serial: false, stock: null, reorder: null },
    { code: "SRV-AMC", name: "Annual Maintenance Visit", type: "SERVICE", category: "AMC", brand: null, unit: "Service", purchase: null, selling: 8500, tax: 18, hsn: "998719", warrantyMonths: null, serial: false, stock: null, reorder: null },
    { code: "SRV-TRANS", name: "Transportation & Unloading", type: "SERVICE", category: "Transportation", brand: null, unit: "Service", purchase: null, selling: 12000, tax: 18, hsn: "996511", warrantyMonths: null, serial: false, stock: null, reorder: null },
  ];

  type DemoProduct = { id: string; code: string; name: string; unitLabel: string; selling: number; purchase: number | null; tax: number; serial: boolean };
  const products: Record<string, DemoProduct> = {};

  for (const p of productSpecs) {
    const stockTracked = p.type !== "SERVICE";
    const created = await prisma.product.create({
      data: {
        companyId,
        code: p.code,
        name: p.name,
        type: p.type,
        categoryId: categories[p.category] ?? null,
        brandId: p.brand ? (brands[p.brand] ?? null) : null,
        unitId: units[p.unit] ?? null,
        purchasePrice: p.purchase,
        sellingPrice: p.selling,
        taxRate: p.tax,
        hsnCode: p.hsn,
        warrantyMonths: p.warrantyMonths,
        serialTracked: p.serial,
        stockTracked,
        reorderLevel: p.reorder,
        description: `${p.name} — demo catalogue item.`,
      },
    });
    products[p.code] = {
      id: created.id,
      code: p.code,
      name: p.name,
      unitLabel: p.unit,
      selling: p.selling,
      purchase: p.purchase,
      tax: p.tax,
      serial: p.serial,
    };

    if (stockTracked && p.stock != null) {
      await prisma.inventoryBalance.create({
        data: { companyId, productId: created.id, locationId: location.id, totalQty: p.stock, reservedQty: 0, damagedQty: 0 },
      });
      await prisma.stockMovement.create({
        data: {
          companyId,
          productId: created.id,
          locationId: location.id,
          type: "OPENING_STOCK",
          quantity: p.stock,
          previousTotalQty: 0,
          newTotalQty: p.stock,
          previousReservedQty: 0,
          newReservedQty: 0,
          previousDamagedQty: 0,
          newDamagedQty: 0,
          reference: "Opening balance",
          reason: "Demo opening stock",
          userId: users.INVENTORY,
          createdAt: daysAgo(150),
        },
      });

      if (p.serial) {
        const serialCount = Math.min(p.stock, 6);
        await prisma.serialNumber.createMany({
          data: Array.from({ length: serialCount }, (_, i) => ({
            companyId,
            productId: created.id,
            locationId: location.id,
            serialNumber: `${p.code}-${String(2600 + i).padStart(5, "0")}`,
            status: "IN_STOCK",
          })),
        });
      }
    }
  }

  // ---- 7. sales chain: quotations → orders → invoices → payments ----
  const seq: Record<string, number> = {};
  const nextNo = (series: string, prefix: string) => {
    seq[series] = (seq[series] ?? 0) + 1;
    return `${prefix}-${String(seq[series]).padStart(4, "0")}`;
  };

  async function createQuotation(opts: {
    customer: { id: string; siteId: string };
    type: string;
    status: string;
    subject: string;
    lines: LineInput[];
    discountPercent?: number;
    otherCharges?: number;
    date: Date;
  }) {
    const { rows, totals } = priceLines(opts.lines, opts.discountPercent ?? 0, opts.otherCharges ?? 0);
    return prisma.quotation.create({
      data: {
        companyId,
        quotationNumber: nextNo("QTN", "QTN"),
        revisionNumber: 0,
        isLatestRevision: true,
        clientId: opts.customer.id,
        siteId: opts.customer.siteId,
        type: opts.type,
        status: opts.status,
        subject: opts.subject,
        quotationDate: opts.date,
        validUntil: new Date(opts.date.getTime() + 30 * 86400000),
        createdBy: users.SALES,
        ...totals,
        items: { create: rows },
      },
    });
  }

  const L = (code: string, quantity: number): LineInput => {
    const p = products[code];
    return { productId: p.id, productName: p.name, productCode: p.code, unitLabel: p.unitLabel, quantity, unitPrice: p.selling, taxRate: p.tax };
  };

  // Approved — drives the order→invoice→project chain below.
  const qApproved = await createQuotation({
    customer: customers[0],
    type: "ON_GRID_SOLAR",
    status: "APPROVED",
    subject: "100 kWp rooftop solar plant — Greenfield Mill",
    lines: [L("SP-540W", 60), L("INV-10KW", 4), L("MS-STD", 30), L("DC-CBL-6", 600), L("ACDB-1P", 4), L("SRV-INST", 1)],
    discountPercent: 3,
    otherCharges: 18000,
    date: daysAgo(74),
  });

  await createQuotation({
    customer: customers[1],
    type: "DIESEL_GENERATOR",
    status: "SENT",
    subject: "125 kVA DG set with AMF panel — Sunrise Resort",
    lines: [L("DG-125KVA", 1), L("SRV-INST", 1), L("SRV-TRANS", 1)],
    otherCharges: 9500,
    date: daysAgo(16),
  });

  await createQuotation({
    customer: customers[2],
    type: "OFF_GRID_SOLAR",
    status: "NEGOTIATION",
    subject: "Off-grid solar pump backup — Patel Farm",
    lines: [L("SP-540W", 18), L("INV-5KW", 2), L("BAT-150AH", 8), L("MS-STD", 9), L("SRV-INST", 1)],
    discountPercent: 5,
    date: daysAgo(9),
  });

  await createQuotation({
    customer: customers[3],
    type: "BATTERY_INVERTER",
    status: "DRAFT",
    subject: "UPS backup for warehouse B2 — Nova Logistics",
    lines: [L("UPS-3KVA", 3), L("BAT-150AH", 12), L("SRV-INST", 1)],
    date: daysAgo(3),
  });

  await createQuotation({
    customer: customers[4],
    type: "HYBRID_SOLAR",
    status: "REJECTED",
    subject: "Hybrid solar + battery backup — Kulkarni Diagnostics",
    lines: [L("SP-540W", 24), L("INV-10KW", 2), L("BAT-150AH", 10), L("SRV-INST", 1)],
    date: daysAgo(55),
  });

  // Sales order from the approved quotation.
  const soLines = [L("SP-540W", 60), L("INV-10KW", 4), L("MS-STD", 30), L("DC-CBL-6", 600), L("ACDB-1P", 4), L("SRV-INST", 1)];
  const soPriced = priceLines(soLines, 3, 18000);
  const salesOrder = await prisma.salesOrder.create({
    data: {
      companyId,
      soNumber: nextNo("SO", "SO"),
      status: "PARTIALLY_FULFILLED",
      clientId: customers[0].id,
      siteId: customers[0].siteId,
      quotationId: qApproved.id,
      orderDate: daysAgo(66),
      expectedDeliveryDate: daysAhead(10),
      paymentTerms: "50% advance, balance on commissioning",
      createdBy: users.SALES,
      stockReserved: false,
      ...soPriced.totals,
      items: { create: soPriced.rows },
    },
  });

  // A second, smaller confirmed order so the module isn't single-row.
  const so2Lines = [L("UPS-3KVA", 2), L("BAT-150AH", 6)];
  const so2Priced = priceLines(so2Lines);
  await prisma.salesOrder.create({
    data: {
      companyId,
      soNumber: nextNo("SO", "SO"),
      status: "CONFIRMED",
      clientId: customers[3].id,
      siteId: customers[3].siteId,
      orderDate: daysAgo(12),
      expectedDeliveryDate: daysAhead(18),
      createdBy: users.SALES,
      ...so2Priced.totals,
      items: { create: so2Priced.rows },
    },
  });

  // Invoices: one fully paid, one partially paid, one overdue, one draft.
  async function createInvoice(opts: {
    customer: { id: string; siteId: string };
    lines: LineInput[];
    discountPercent?: number;
    otherCharges?: number;
    date: Date;
    dueDate: Date;
    status: string;
    paid: number;
    salesOrderId?: string;
  }) {
    const { rows, totals } = priceLines(opts.lines, opts.discountPercent ?? 0, opts.otherCharges ?? 0);
    return prisma.invoice.create({
      data: {
        companyId,
        invoiceNumber: nextNo("EINV", "EINV"),
        status: opts.status,
        clientId: opts.customer.id,
        salesOrderId: opts.salesOrderId ?? null,
        invoiceDate: opts.date,
        dueDate: opts.dueDate,
        paymentTerms: "30 days from invoice date",
        createdBy: users.ACCOUNTS,
        ...totals,
        paidAmount: opts.paid,
        outstandingAmount: round2(totals.grandTotal - opts.paid),
        items: { create: rows },
      },
    });
  }

  // Advance invoice against the big solar order — fully paid.
  const invAdvanceLines = [L("SP-540W", 30), L("INV-10KW", 2), L("MS-STD", 15)];
  const invAdvanceTotal = priceLines(invAdvanceLines).totals.grandTotal;
  const invAdvance = await createInvoice({
    customer: customers[0],
    lines: invAdvanceLines,
    date: daysAgo(60),
    dueDate: daysAgo(30),
    status: "PAID",
    paid: invAdvanceTotal,
    salesOrderId: salesOrder.id,
  });

  // Balance invoice — partially paid.
  const invBalanceLines = [L("SP-540W", 30), L("INV-10KW", 2), L("MS-STD", 15), L("DC-CBL-6", 600), L("ACDB-1P", 4), L("SRV-INST", 1)];
  const invBalanceTotal = priceLines(invBalanceLines, 0, 18000).totals.grandTotal;
  const invBalancePaid = 400000; // clean round part-payment, keeps the ageing figure readable
  const invBalance = await createInvoice({
    customer: customers[0],
    lines: invBalanceLines,
    otherCharges: 18000,
    date: daysAgo(21),
    dueDate: daysAhead(9),
    status: "PARTIALLY_PAID",
    paid: invBalancePaid,
    salesOrderId: salesOrder.id,
  });

  // Overdue invoice for a different customer.
  const invOverdueLines = [L("BAT-150AH", 6), L("UPS-3KVA", 1), L("SRV-INST", 1)];
  await createInvoice({
    customer: customers[4],
    lines: invOverdueLines,
    date: daysAgo(78),
    dueDate: daysAgo(48),
    status: "OVERDUE",
    paid: 0,
  });

  // Draft invoice, not yet issued.
  await createInvoice({
    customer: customers[1],
    lines: [L("SRV-AMC", 4)],
    date: daysAgo(2),
    dueDate: daysAhead(28),
    status: "DRAFT",
    paid: 0,
  });

  // Payments + allocations matching the invoice paid amounts above.
  async function createPayment(opts: { customer: { id: string }; invoiceId: string; amount: number; mode: string; date: Date; reference?: string }) {
    const payment = await prisma.payment.create({
      data: {
        companyId,
        paymentNumber: nextNo("EPAY", "EPAY"),
        clientId: opts.customer.id,
        amount: opts.amount,
        allocatedAmount: opts.amount,
        unallocatedAmount: 0,
        mode: opts.mode,
        status: "ALLOCATED",
        paymentDate: opts.date,
        referenceNumber: opts.reference ?? null,
        createdBy: users.ACCOUNTS,
      },
    });
    await prisma.paymentAllocation.create({
      data: { paymentId: payment.id, invoiceId: opts.invoiceId, amount: opts.amount },
    });
    return payment;
  }

  await createPayment({ customer: customers[0], invoiceId: invAdvance.id, amount: 500000, mode: "BANK_TRANSFER", date: daysAgo(57), reference: "NEFT HDFC0098231" });
  await createPayment({ customer: customers[0], invoiceId: invAdvance.id, amount: round2(invAdvanceTotal - 500000), mode: "BANK_TRANSFER", date: daysAgo(44), reference: "NEFT HDFC0104887" });
  await createPayment({ customer: customers[0], invoiceId: invBalance.id, amount: invBalancePaid, mode: "UPI", date: daysAgo(11), reference: "UPI 441290338211" });

  // Current-month activity, so "This Month" on the dashboard and reports is
  // never empty no matter which day the demo is seeded or shown on.
  const invThisMonthLines = [L("UPS-3KVA", 2), L("BAT-150AH", 6), L("SRV-INST", 1)];
  const invThisMonthTotal = priceLines(invThisMonthLines).totals.grandTotal;
  const invThisMonthPaid = await createInvoice({
    customer: customers[3],
    lines: invThisMonthLines,
    date: thisMonth(2),
    dueDate: daysAhead(20),
    status: "PAID",
    paid: invThisMonthTotal,
  });
  await createPayment({
    customer: customers[3],
    invoiceId: invThisMonthPaid.id,
    amount: invThisMonthTotal,
    mode: "BANK_TRANSFER",
    date: thisMonth(4),
    reference: "NEFT ICIC0338112",
  });

  const invThisMonthOpenLines = [L("SP-540W", 12), L("MS-STD", 6), L("SRV-INST", 1)];
  await createInvoice({
    customer: customers[2],
    lines: invThisMonthOpenLines,
    date: thisMonth(6),
    dueDate: daysAhead(25),
    status: "ISSUED",
    paid: 0,
  });

  // ---- 8. purchase chain ----
  const PL = (code: string, quantity: number): LineInput => {
    const p = products[code];
    return { productId: p.id, productName: p.name, productCode: p.code, unitLabel: p.unitLabel, quantity, unitPrice: p.purchase ?? 0, taxRate: p.tax };
  };

  const poLines = [PL("SP-540W", 80), PL("MS-STD", 40)];
  const poPriced = priceLines(poLines);
  const po = await prisma.purchaseOrder.create({
    data: {
      companyId,
      poNumber: nextNo("VPO", "VPO"),
      status: "FULLY_RECEIVED",
      vendorId: vendors[0].id,
      poDate: daysAgo(96),
      expectedDeliveryDate: daysAgo(80),
      createdBy: users.PURCHASE,
      ...poPriced.totals,
      items: { create: poPriced.rows },
    },
    include: { items: true },
  });

  await prisma.purchaseReceipt.create({
    data: {
      companyId,
      receiptNumber: nextNo("PREC", "PREC"),
      purchaseOrderId: po.id,
      vendorId: vendors[0].id,
      locationId: location.id,
      receiptDate: daysAgo(84),
      createdBy: users.INVENTORY,
      notes: "Full consignment received in good condition.",
      items: {
        create: po.items.map((item) => ({
          purchaseOrderLineItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
        })),
      },
    },
  });

  const viLines = [PL("SP-540W", 80), PL("MS-STD", 40)];
  const viPriced = priceLines(viLines);
  const vendorInvoice = await prisma.vendorInvoice.create({
    data: {
      companyId,
      invoiceNumber: nextNo("VINV", "VINV"),
      status: "PARTIALLY_PAID",
      vendorId: vendors[0].id,
      purchaseOrderId: po.id,
      vendorInvoiceNumber: "WAA/26-27/4471",
      invoiceDate: daysAgo(82),
      dueDate: daysAgo(37),
      createdBy: users.PURCHASE,
      ...viPriced.totals,
      paidAmount: 600000,
      outstandingAmount: round2(viPriced.totals.grandTotal - 600000),
      items: { create: viPriced.rows },
    },
  });

  const vPayment = await prisma.vendorPayment.create({
    data: {
      companyId,
      paymentNumber: nextNo("VPAY", "VPAY"),
      vendorId: vendors[0].id,
      amount: 600000,
      allocatedAmount: 600000,
      unallocatedAmount: 0,
      mode: "BANK_TRANSFER",
      status: "ALLOCATED",
      paymentDate: daysAgo(50),
      referenceNumber: "RTGS HDFCR52200931",
      createdBy: users.ACCOUNTS,
    },
  });
  await prisma.vendorPaymentAllocation.create({
    data: { vendorPaymentId: vPayment.id, vendorInvoiceId: vendorInvoice.id, amount: 600000 },
  });

  // A second PO still awaiting delivery, so the module shows a live pipeline.
  const po2Lines = [PL("BAT-150AH", 20)];
  const po2Priced = priceLines(po2Lines);
  await prisma.purchaseOrder.create({
    data: {
      companyId,
      poNumber: nextNo("VPO", "VPO"),
      status: "CONFIRMED",
      vendorId: vendors[2].id,
      poDate: daysAgo(8),
      expectedDeliveryDate: daysAhead(12),
      createdBy: users.PURCHASE,
      ...po2Priced.totals,
      items: { create: po2Priced.rows },
    },
  });

  // A current-month vendor bill, so the dashboard's "This Month" purchases
  // figure (and therefore the gross-margin calculation) reflects real cost.
  const vi2Lines = [PL("UPS-3KVA", 2), PL("BAT-150AH", 6)];
  const vi2Priced = priceLines(vi2Lines);
  await prisma.vendorInvoice.create({
    data: {
      companyId,
      invoiceNumber: nextNo("VINV", "VINV"),
      status: "UNPAID",
      vendorId: vendors[2].id,
      vendorInvoiceNumber: "EXI/26-27/8842",
      invoiceDate: thisMonth(4),
      dueDate: daysAhead(26),
      createdBy: users.PURCHASE,
      ...vi2Priced.totals,
      paidAmount: 0,
      outstandingAmount: vi2Priced.totals.grandTotal,
      items: { create: vi2Priced.rows },
    },
  });

  // ---- 9. project → installation → installed equipment ----
  const project = await prisma.energyProject.create({
    data: {
      companyId,
      projectNumber: nextNo("PRJ", "PRJ"),
      status: "IN_PROGRESS",
      priority: "HIGH",
      type: "SOLAR_INSTALLATION",
      customerId: customers[0].id,
      siteId: customers[0].siteId,
      salesOrderId: salesOrder.id,
      name: "Greenfield Mill — 100 kWp Rooftop Solar",
      description: "Rooftop grid-tie solar plant with net metering for Greenfield Textiles.",
      startDate: daysAgo(58),
      expectedCompletionDate: daysAhead(14),
      createdBy: users.PROJECT_MANAGER,
      items: {
        create: [
          { productId: products["SP-540W"].id, productName: products["SP-540W"].name, productCode: "SP-540W", unitLabel: "Piece", requiredQuantity: 60, assignedQuantity: 60, installedQuantity: 36, sortOrder: 0 },
          { productId: products["INV-10KW"].id, productName: products["INV-10KW"].name, productCode: "INV-10KW", unitLabel: "Piece", requiredQuantity: 4, assignedQuantity: 4, installedQuantity: 2, sortOrder: 1 },
          { productId: products["MS-STD"].id, productName: products["MS-STD"].name, productCode: "MS-STD", unitLabel: "Set", requiredQuantity: 30, assignedQuantity: 30, installedQuantity: 18, sortOrder: 2 },
        ],
      },
      milestones: {
        create: [
          { name: "Site Survey", status: "COMPLETED", actualDate: daysAgo(56), sortOrder: 0 },
          { name: "Design & Approval", status: "COMPLETED", actualDate: daysAgo(47), sortOrder: 1 },
          { name: "Material Dispatch", status: "COMPLETED", actualDate: daysAgo(33), sortOrder: 2 },
          { name: "Structure Installation", status: "COMPLETED", actualDate: daysAgo(21), sortOrder: 3 },
          { name: "Panel & Inverter Installation", status: "IN_PROGRESS", sortOrder: 4 },
          { name: "Testing & Commissioning", status: "PENDING", sortOrder: 5 },
          { name: "Net Metering & Handover", status: "PENDING", sortOrder: 6 },
        ],
      },
    },
  });

  const installation = await prisma.installation.create({
    data: {
      companyId,
      installationNumber: nextNo("INS", "INS"),
      projectId: project.id,
      siteId: customers[0].siteId,
      status: "COMPLETED",
      installationDate: daysAgo(24),
      completedAt: daysAgo(19),
      completedBy: users.INSTALLATION_TEAM,
      technicianId: users.INSTALLATION_TEAM,
      notes: "First array block (36 panels, 2 inverters) installed and tested.",
    },
  });

  const equipmentSeeds = [
    { product: "SP-540W", qty: 36, serial: null as string | null },
    { product: "INV-10KW", qty: 1, serial: "INV-10KW-02600" },
    { product: "INV-10KW", qty: 1, serial: "INV-10KW-02601" },
  ];
  const installedEquipment: { id: string; productName: string }[] = [];
  for (const e of equipmentSeeds) {
    const p = products[e.product];
    const eq = await prisma.installedEquipment.create({
      data: {
        companyId,
        equipmentNumber: nextNo("EQP", "EQP"),
        customerId: customers[0].id,
        siteId: customers[0].siteId,
        projectId: project.id,
        installationId: installation.id,
        productId: p.id,
        productName: p.name,
        serialNumberText: e.serial,
        quantity: e.qty,
        status: "ACTIVE",
        installationDate: daysAgo(19),
      },
    });
    installedEquipment.push({ id: eq.id, productName: p.name });
  }

  // ---- 10. warranty / AMC ----
  await prisma.warranty.create({
    data: {
      companyId,
      warrantyNumber: nextNo("WAR", "WAR"),
      customerId: customers[0].id,
      siteId: customers[0].siteId,
      projectId: project.id,
      installedEquipmentId: installedEquipment[0].id,
      warrantyType: "MANUFACTURER",
      startDate: daysAgo(19),
      endDate: daysAhead(3650),
      durationMonths: 300,
      coverage: "25-year linear performance warranty on panels, as per Waaree datasheet.",
      createdBy: adminId,
    },
  });
  await prisma.warranty.create({
    data: {
      companyId,
      warrantyNumber: nextNo("WAR", "WAR"),
      customerId: customers[0].id,
      siteId: customers[0].siteId,
      projectId: project.id,
      installedEquipmentId: installedEquipment[1].id,
      warrantyType: "MANUFACTURER",
      startDate: daysAgo(19),
      endDate: daysAhead(25),
      durationMonths: 60,
      coverage: "5-year inverter warranty — nearing renewal window.",
      createdBy: adminId,
    },
  });
  await prisma.warranty.create({
    data: {
      companyId,
      warrantyNumber: nextNo("WAR", "WAR"),
      customerId: customers[4].id,
      warrantyType: "SUPPLIER",
      startDate: daysAgo(800),
      endDate: daysAgo(70),
      durationMonths: 24,
      coverage: "Battery bank supplier warranty — expired, renewal quoted.",
      createdBy: adminId,
    },
  });

  // status stays "ACTIVE" on both: ACTIVE / EXPIRING_SOON / EXPIRED are
  // derived live from the dates (amc/types.ts:computeAmcStatus), so the
  // second contract below shows as "Expiring Soon" purely because its
  // endDate is 22 days out. Visits used is likewise computed from the
  // MaintenanceVisit rows linked via amcId, never stored.
  const amcActive = await prisma.aMC.create({
    data: {
      companyId,
      amcNumber: nextNo("AMC", "AMC"),
      customerId: customers[0].id,
      siteId: customers[0].siteId,
      projectId: project.id,
      status: "ACTIVE",
      startDate: daysAgo(19),
      endDate: daysAhead(346),
      billingFrequency: "ANNUAL",
      contractValue: 68000,
      numberOfVisits: 4,
      coverage: "Quarterly preventive maintenance, panel cleaning and inverter health check.",
      exclusions: "Module replacement, grid-side faults, and any civil work.",
      createdBy: adminId,
    },
  });
  await prisma.aMC.create({
    data: {
      companyId,
      amcNumber: nextNo("AMC", "AMC"),
      customerId: customers[1].id,
      status: "ACTIVE",
      startDate: daysAgo(340),
      endDate: daysAhead(22),
      billingFrequency: "ANNUAL",
      contractValue: 42000,
      numberOfVisits: 2,
      coverage: "DG set servicing contract — due for renewal.",
      createdBy: adminId,
    },
  });

  // ---- 11. service requests + maintenance visits ----
  const srResolved = await prisma.serviceRequest.create({
    data: {
      companyId,
      requestNumber: nextNo("SR", "SR"),
      customerId: customers[0].id,
      siteId: customers[0].siteId,
      projectId: project.id,
      installedEquipmentId: installedEquipment[1].id,
      source: "COMPLAINT",
      serviceType: "WARRANTY",
      priority: "HIGH",
      status: "RESOLVED",
      issue: "Inverter showing intermittent grid-fault error during peak afternoon load.",
      requestDate: daysAgo(13),
      assignedToId: users.SERVICE_MAINTENANCE,
      resolution: "Loose AC-side neutral termination re-torqued; firmware updated to v2.4.1. Monitored for 48 hours, no recurrence.",
      createdBy: users.SERVICE_MAINTENANCE,
    },
  });

  await prisma.serviceRequest.create({
    data: {
      companyId,
      requestNumber: nextNo("SR", "SR"),
      customerId: customers[1].id,
      source: "PHONE_CALL",
      serviceType: "AMC",
      priority: "MEDIUM",
      status: "ASSIGNED",
      issue: "DG set due for scheduled 500-hour service; customer reports minor oil seepage.",
      requestDate: daysAgo(4),
      assignedToId: users.SERVICE_MAINTENANCE,
      createdBy: users.SERVICE_MAINTENANCE,
    },
  });

  await prisma.serviceRequest.create({
    data: {
      companyId,
      requestNumber: nextNo("SR", "SR"),
      customerId: customers[4].id,
      source: "WARRANTY_ISSUE",
      serviceType: "CHARGEABLE",
      priority: "CRITICAL",
      status: "OPEN",
      issue: "Battery bank not holding charge beyond 20 minutes — warranty expired, chargeable replacement quote requested.",
      requestDate: daysAgo(1),
      createdBy: users.SERVICE_MAINTENANCE,
    },
  });

  await prisma.maintenanceVisit.create({
    data: {
      companyId,
      visitNumber: nextNo("MNT", "MNT"),
      customerId: customers[0].id,
      siteId: customers[0].siteId,
      projectId: project.id,
      serviceRequestId: srResolved.id,
      amcId: amcActive.id,
      visitType: "WARRANTY_SERVICE",
      status: "COMPLETED",
      visitDate: daysAgo(10),
      technicianId: users.SERVICE_MAINTENANCE,
      findings: "AC-side neutral termination found loose at inverter output. No component damage.",
      workPerformed: "Re-torqued terminations to spec, cleaned enclosure, updated inverter firmware to v2.4.1. No parts replaced.",
      result: "Fault cleared — monitored 48 hours with no recurrence.",
      nextMaintenanceDate: daysAhead(80),
      createdBy: users.SERVICE_MAINTENANCE,
    },
  });

  await prisma.maintenanceVisit.create({
    data: {
      companyId,
      visitNumber: nextNo("MNT", "MNT"),
      customerId: customers[0].id,
      siteId: customers[0].siteId,
      projectId: project.id,
      amcId: amcActive.id,
      visitType: "AMC_PREVENTIVE_MAINTENANCE",
      status: "PLANNED",
      visitDate: daysAhead(16),
      technicianId: users.SERVICE_MAINTENANCE,
      createdBy: users.SERVICE_MAINTENANCE,
    },
  });

  // ---- 12. expenses ----
  const expenseSeeds = [
    { category: "Installation Labour", amount: 48000, date: daysAgo(30), status: "PAID", desc: "Rooftop structure + panel mounting crew (6 days)", project: true },
    { category: "Transportation", amount: 16500, date: daysAgo(34), status: "PAID", desc: "Material transport Mumbai → Boisar", project: true },
    { category: "Site Civil Work", amount: 27500, date: daysAgo(40), status: "APPROVED", desc: "Inverter room foundation and cable trench", project: true },
    { category: "Tools & Consumables", amount: 8200, date: daysAgo(12), status: "APPROVED", desc: "MC4 connectors, cable ties, earthing strips", project: false },
    { category: "Travel & Lodging", amount: 6400, date: daysAgo(5), status: "DRAFT", desc: "Service engineer site visit — Nashik", project: false },
    // Current-month entries so the dashboard's "This Month" expense figure
    // and gross margin are realistic rather than a suspicious 100%.
    { category: "Installation Labour", amount: 36500, date: thisMonth(3), status: "PAID", desc: "Commissioning crew — Nova Logistics UPS install", project: false },
    { category: "Transportation", amount: 9800, date: thisMonth(5), status: "APPROVED", desc: "Battery consignment delivery — Bhiwandi", project: false },
  ];
  for (const e of expenseSeeds) {
    const taxAmount = 0;
    await prisma.expense.create({
      data: {
        companyId,
        expenseNumber: nextNo("EXP", "EXP"),
        categoryId: expenseCategories[e.category],
        projectId: e.project ? project.id : null,
        amount: e.amount,
        taxAmount,
        grandTotal: round2(e.amount + taxAmount),
        status: e.status,
        paidAmount: e.status === "PAID" ? round2(e.amount + taxAmount) : 0,
        expenseDate: e.date,
        description: e.desc,
        createdBy: users.ACCOUNTS,
      },
    });
  }

  // ---- 13. advance the number sequences past everything seeded, so the
  // first document the app creates continues the series instead of
  // colliding with a demo record. ----
  const seriesPrefixes: Record<string, string> = {
    QTN: "QTN", SO: "SO", EINV: "EINV", EPAY: "EPAY", VPO: "VPO", PREC: "PREC",
    VINV: "VINV", VPAY: "VPAY", PRJ: "PRJ", INS: "INS", EQP: "EQP", WAR: "WAR",
    AMC: "AMC", SR: "SR", MNT: "MNT", EXP: "EXP",
  };
  for (const series of Object.keys(seriesPrefixes)) {
    const used = seq[series] ?? 0;
    if (used > 0) {
      await prisma.numberSequence.upsert({
        where: { companyId_series: { companyId, series } },
        update: { currentValue: used },
        create: { companyId, series, currentValue: used },
      });
    }
  }

  const counts = {
    users: await prisma.user.count({ where: { companyId } }),
    customers: await prisma.party.count({ where: { companyId, type: "CLIENT" } }),
    vendors: await prisma.party.count({ where: { companyId, type: "VENDOR" } }),
    products: await prisma.product.count({ where: { companyId } }),
    quotations: await prisma.quotation.count({ where: { companyId } }),
    salesOrders: await prisma.salesOrder.count({ where: { companyId } }),
    invoices: await prisma.invoice.count({ where: { companyId } }),
    payments: await prisma.payment.count({ where: { companyId } }),
    purchaseOrders: await prisma.purchaseOrder.count({ where: { companyId } }),
    vendorInvoices: await prisma.vendorInvoice.count({ where: { companyId } }),
    projects: await prisma.energyProject.count({ where: { companyId } }),
    installedEquipment: await prisma.installedEquipment.count({ where: { companyId } }),
    warranties: await prisma.warranty.count({ where: { companyId } }),
    amcs: await prisma.aMC.count({ where: { companyId } }),
    serviceRequests: await prisma.serviceRequest.count({ where: { companyId } }),
    maintenanceVisits: await prisma.maintenanceVisit.count({ where: { companyId } }),
    expenses: await prisma.expense.count({ where: { companyId } }),
  };

  console.log("Demo data seeded:");
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  console.log(`\nAll logins use the password: ${DEMO_PASSWORD}`);
  for (const u of DEMO_USERS) console.log(`  ${u.email.padEnd(22)} ${u.role}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
