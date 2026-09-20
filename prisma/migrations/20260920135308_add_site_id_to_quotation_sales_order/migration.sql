-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "rootQuotationId" TEXT,
    "isLatestRevision" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "siteAddressId" TEXT,
    "siteAddressText" TEXT,
    "billingAddressText" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "quotationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "salespersonId" TEXT,
    "reference" TEXT,
    "subject" TEXT,
    "notes" TEXT,
    "technicalConfigJson" TEXT,
    "proposalContentJson" TEXT,
    "paymentTerms" TEXT,
    "equipmentWarranty" TEXT,
    "installationWarranty" TEXT,
    "deliveryTimeline" TEXT,
    "installationTimeline" TEXT,
    "termsAndConditions" TEXT,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discountPercent" REAL,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "taxableAmount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "otherCharges" REAL NOT NULL DEFAULT 0,
    "grandTotal" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quotation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quotation_siteAddressId_fkey" FOREIGN KEY ("siteAddressId") REFERENCES "PartyAddress" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quotation_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quotation_rootQuotationId_fkey" FOREIGN KEY ("rootQuotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quotation" ("billingAddressText", "clientId", "companyId", "createdAt", "createdBy", "deliveryTimeline", "discountAmount", "discountPercent", "equipmentWarranty", "grandTotal", "id", "installationTimeline", "installationWarranty", "isLatestRevision", "notes", "otherCharges", "paymentTerms", "proposalContentJson", "quotationDate", "quotationNumber", "reference", "revisionNumber", "rootQuotationId", "salespersonId", "siteAddressId", "siteAddressText", "status", "subject", "subtotal", "taxAmount", "taxableAmount", "technicalConfigJson", "termsAndConditions", "type", "updatedAt", "validUntil") SELECT "billingAddressText", "clientId", "companyId", "createdAt", "createdBy", "deliveryTimeline", "discountAmount", "discountPercent", "equipmentWarranty", "grandTotal", "id", "installationTimeline", "installationWarranty", "isLatestRevision", "notes", "otherCharges", "paymentTerms", "proposalContentJson", "quotationDate", "quotationNumber", "reference", "revisionNumber", "rootQuotationId", "salespersonId", "siteAddressId", "siteAddressText", "status", "subject", "subtotal", "taxAmount", "taxableAmount", "technicalConfigJson", "termsAndConditions", "type", "updatedAt", "validUntil" FROM "Quotation";
DROP TABLE "Quotation";
ALTER TABLE "new_Quotation" RENAME TO "Quotation";
CREATE INDEX "Quotation_companyId_status_idx" ON "Quotation"("companyId", "status");
CREATE INDEX "Quotation_companyId_clientId_idx" ON "Quotation"("companyId", "clientId");
CREATE INDEX "Quotation_companyId_quotationNumber_idx" ON "Quotation"("companyId", "quotationNumber");
CREATE UNIQUE INDEX "Quotation_companyId_quotationNumber_revisionNumber_key" ON "Quotation"("companyId", "quotationNumber", "revisionNumber");
CREATE TABLE "new_SalesOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "soNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "siteAddressId" TEXT,
    "siteAddressText" TEXT,
    "quotationId" TEXT,
    "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" DATETIME,
    "salespersonId" TEXT,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discountPercent" REAL,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "taxableAmount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "otherCharges" REAL NOT NULL DEFAULT 0,
    "grandTotal" REAL NOT NULL DEFAULT 0,
    "stockReserved" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalesOrder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalesOrder_siteAddressId_fkey" FOREIGN KEY ("siteAddressId") REFERENCES "PartyAddress" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SalesOrder_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SalesOrder" ("clientId", "companyId", "createdAt", "createdBy", "discountAmount", "discountPercent", "expectedDeliveryDate", "grandTotal", "id", "notes", "orderDate", "otherCharges", "paymentTerms", "quotationId", "salespersonId", "siteAddressId", "siteAddressText", "soNumber", "status", "stockReserved", "subtotal", "taxAmount", "taxableAmount", "updatedAt") SELECT "clientId", "companyId", "createdAt", "createdBy", "discountAmount", "discountPercent", "expectedDeliveryDate", "grandTotal", "id", "notes", "orderDate", "otherCharges", "paymentTerms", "quotationId", "salespersonId", "siteAddressId", "siteAddressText", "soNumber", "status", "stockReserved", "subtotal", "taxAmount", "taxableAmount", "updatedAt" FROM "SalesOrder";
DROP TABLE "SalesOrder";
ALTER TABLE "new_SalesOrder" RENAME TO "SalesOrder";
CREATE INDEX "SalesOrder_companyId_status_idx" ON "SalesOrder"("companyId", "status");
CREATE INDEX "SalesOrder_companyId_clientId_idx" ON "SalesOrder"("companyId", "clientId");
CREATE UNIQUE INDEX "SalesOrder_companyId_soNumber_key" ON "SalesOrder"("companyId", "soNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
