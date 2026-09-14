-- AlterTable
ALTER TABLE "Company" ADD COLUMN "defaultQuotationTerms" TEXT;

-- CreateTable
CREATE TABLE "NumberSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "NumberSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 0,
    "rootQuotationId" TEXT,
    "isLatestRevision" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT NOT NULL,
    "siteAddressId" TEXT,
    "siteAddressText" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "quotationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "salespersonId" TEXT,
    "reference" TEXT,
    "subject" TEXT,
    "notes" TEXT,
    "technicalConfigJson" TEXT,
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
    CONSTRAINT "Quotation_siteAddressId_fkey" FOREIGN KEY ("siteAddressId") REFERENCES "PartyAddress" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quotation_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quotation_rootQuotationId_fkey" FOREIGN KEY ("rootQuotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuotationLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productCode" TEXT,
    "unitLabel" TEXT,
    "description" TEXT,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "discountPercent" REAL,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "lineSubtotal" REAL NOT NULL,
    "lineTotal" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuotationLineItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuotationLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_companyId_series_key" ON "NumberSequence"("companyId", "series");

-- CreateIndex
CREATE INDEX "Quotation_companyId_status_idx" ON "Quotation"("companyId", "status");

-- CreateIndex
CREATE INDEX "Quotation_companyId_clientId_idx" ON "Quotation"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "Quotation_companyId_quotationNumber_idx" ON "Quotation"("companyId", "quotationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_companyId_quotationNumber_revisionNumber_key" ON "Quotation"("companyId", "quotationNumber", "revisionNumber");

-- CreateIndex
CREATE INDEX "QuotationLineItem_quotationId_idx" ON "QuotationLineItem"("quotationId");
