-- CreateTable
CREATE TABLE "InstalledEquipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "equipmentNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "projectId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productCode" TEXT,
    "serialNumberId" TEXT,
    "serialNumberText" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "installationDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INSTALLED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstalledEquipment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstalledEquipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstalledEquipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstalledEquipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EnergyProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstalledEquipment_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstalledEquipment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstalledEquipment_serialNumberId_fkey" FOREIGN KEY ("serialNumberId") REFERENCES "SerialNumber" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "warrantyNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "projectId" TEXT,
    "installedEquipmentId" TEXT,
    "warrantyType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "durationMonths" INTEGER,
    "terms" TEXT,
    "coverage" TEXT,
    "exclusions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "documentReference" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Warranty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Warranty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Warranty_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Warranty_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EnergyProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Warranty_installedEquipmentId_fkey" FOREIGN KEY ("installedEquipmentId") REFERENCES "InstalledEquipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AMC" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "amcNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "projectId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "contractValue" REAL,
    "billingFrequency" TEXT,
    "numberOfVisits" INTEGER NOT NULL DEFAULT 0,
    "coverage" TEXT,
    "exclusions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AMC_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AMC_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AMC_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AMC_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EnergyProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "projectId" TEXT,
    "installedEquipmentId" TEXT,
    "source" TEXT NOT NULL,
    "requestDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issue" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "serviceType" TEXT NOT NULL DEFAULT 'CHARGEABLE',
    "amcId" TEXT,
    "warrantyId" TEXT,
    "warrantyStatusAtRequest" TEXT,
    "amcStatusAtRequest" TEXT,
    "assignedToId" TEXT,
    "expectedVisitDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "invoiceId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServiceRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EnergyProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_installedEquipmentId_fkey" FOREIGN KEY ("installedEquipmentId") REFERENCES "InstalledEquipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_amcId_fkey" FOREIGN KEY ("amcId") REFERENCES "AMC" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "visitNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "siteId" TEXT,
    "projectId" TEXT,
    "installedEquipmentId" TEXT,
    "serviceRequestId" TEXT,
    "amcId" TEXT,
    "technicianId" TEXT,
    "visitType" TEXT NOT NULL,
    "visitDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "checklistJson" TEXT,
    "findings" TEXT,
    "workPerformed" TEXT,
    "result" TEXT,
    "customerRemarks" TEXT,
    "technicianRemarks" TEXT,
    "nextMaintenanceDate" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceVisit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceVisit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceVisit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EnergyProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceVisit_installedEquipmentId_fkey" FOREIGN KEY ("installedEquipmentId") REFERENCES "InstalledEquipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceVisit_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceVisit_amcId_fkey" FOREIGN KEY ("amcId") REFERENCES "AMC" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceVisit_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServicePartUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maintenanceVisitId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "locationId" TEXT NOT NULL,
    "stockMovementId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServicePartUsage_maintenanceVisitId_fkey" FOREIGN KEY ("maintenanceVisitId") REFERENCES "MaintenanceVisit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServicePartUsage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ServicePartUsage_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "clientId" TEXT NOT NULL,
    "billingAddressText" TEXT,
    "siteAddressText" TEXT,
    "salesOrderId" TEXT,
    "quotationId" TEXT,
    "amcId" TEXT,
    "invoiceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "salespersonId" TEXT,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "discountPercent" REAL,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "taxableAmount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "otherCharges" REAL NOT NULL DEFAULT 0,
    "grandTotal" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "outstandingAmount" REAL NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_amcId_fkey" FOREIGN KEY ("amcId") REFERENCES "AMC" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("billingAddressText", "clientId", "companyId", "createdAt", "createdBy", "discountAmount", "discountPercent", "dueDate", "grandTotal", "id", "invoiceDate", "invoiceNumber", "notes", "otherCharges", "outstandingAmount", "paidAmount", "paymentTerms", "quotationId", "salesOrderId", "salespersonId", "siteAddressText", "status", "subtotal", "taxAmount", "taxableAmount", "updatedAt") SELECT "billingAddressText", "clientId", "companyId", "createdAt", "createdBy", "discountAmount", "discountPercent", "dueDate", "grandTotal", "id", "invoiceDate", "invoiceNumber", "notes", "otherCharges", "outstandingAmount", "paidAmount", "paymentTerms", "quotationId", "salesOrderId", "salespersonId", "siteAddressText", "status", "subtotal", "taxAmount", "taxableAmount", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_companyId_status_idx" ON "Invoice"("companyId", "status");
CREATE INDEX "Invoice_companyId_clientId_idx" ON "Invoice"("companyId", "clientId");
CREATE INDEX "Invoice_companyId_dueDate_idx" ON "Invoice"("companyId", "dueDate");
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InstalledEquipment_companyId_customerId_idx" ON "InstalledEquipment"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "InstalledEquipment_companyId_siteId_idx" ON "InstalledEquipment"("companyId", "siteId");

-- CreateIndex
CREATE INDEX "InstalledEquipment_companyId_projectId_idx" ON "InstalledEquipment"("companyId", "projectId");

-- CreateIndex
CREATE INDEX "InstalledEquipment_companyId_status_idx" ON "InstalledEquipment"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InstalledEquipment_companyId_equipmentNumber_key" ON "InstalledEquipment"("companyId", "equipmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InstalledEquipment_serialNumberId_key" ON "InstalledEquipment"("serialNumberId");

-- CreateIndex
CREATE INDEX "Warranty_companyId_customerId_idx" ON "Warranty"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "Warranty_companyId_installedEquipmentId_idx" ON "Warranty"("companyId", "installedEquipmentId");

-- CreateIndex
CREATE INDEX "Warranty_companyId_status_idx" ON "Warranty"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_companyId_warrantyNumber_key" ON "Warranty"("companyId", "warrantyNumber");

-- CreateIndex
CREATE INDEX "AMC_companyId_customerId_idx" ON "AMC"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "AMC_companyId_status_idx" ON "AMC"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AMC_companyId_amcNumber_key" ON "AMC"("companyId", "amcNumber");

-- CreateIndex
CREATE INDEX "ServiceRequest_companyId_customerId_idx" ON "ServiceRequest"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "ServiceRequest_companyId_status_idx" ON "ServiceRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "ServiceRequest_companyId_priority_idx" ON "ServiceRequest"("companyId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_companyId_requestNumber_key" ON "ServiceRequest"("companyId", "requestNumber");

-- CreateIndex
CREATE INDEX "MaintenanceVisit_companyId_customerId_idx" ON "MaintenanceVisit"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "MaintenanceVisit_companyId_status_idx" ON "MaintenanceVisit"("companyId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceVisit_companyId_serviceRequestId_idx" ON "MaintenanceVisit"("companyId", "serviceRequestId");

-- CreateIndex
CREATE INDEX "MaintenanceVisit_companyId_amcId_idx" ON "MaintenanceVisit"("companyId", "amcId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceVisit_companyId_visitNumber_key" ON "MaintenanceVisit"("companyId", "visitNumber");

-- CreateIndex
CREATE INDEX "ServicePartUsage_maintenanceVisitId_idx" ON "ServicePartUsage"("maintenanceVisitId");
