-- CreateTable
CREATE TABLE "ProjectSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "landmark" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectSite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectSite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnergyProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "type" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "siteId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME,
    "expectedCompletionDate" DATETIME,
    "actualCompletionDate" DATETIME,
    "projectManagerId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EnergyProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EnergyProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EnergyProject_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EnergyProject_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EnergyProject_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productCode" TEXT,
    "unitLabel" TEXT,
    "requiredQuantity" REAL NOT NULL,
    "assignedQuantity" REAL NOT NULL DEFAULT 0,
    "installedQuantity" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProjectItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EnergyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "plannedDate" DATETIME,
    "actualDate" DATETIME,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EnergyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "installationNumber" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "installationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technicianId" TEXT,
    "checklistJson" TEXT,
    "notes" TEXT,
    "completedAt" DATETIME,
    "completedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Installation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Installation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EnergyProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Installation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ProjectSite" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Installation_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "projectItemId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "serialNumbersJson" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InstallationItem_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InstallationItem_projectItemId_fkey" FOREIGN KEY ("projectItemId") REFERENCES "ProjectItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstallationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SerialNumber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "locationId" TEXT,
    "purchaseReference" TEXT,
    "notes" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SerialNumber_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SerialNumber_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SerialNumber_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SerialNumber_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "EnergyProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SerialNumber" ("companyId", "createdAt", "id", "locationId", "notes", "productId", "purchaseReference", "serialNumber", "status", "updatedAt") SELECT "companyId", "createdAt", "id", "locationId", "notes", "productId", "purchaseReference", "serialNumber", "status", "updatedAt" FROM "SerialNumber";
DROP TABLE "SerialNumber";
ALTER TABLE "new_SerialNumber" RENAME TO "SerialNumber";
CREATE INDEX "SerialNumber_companyId_productId_idx" ON "SerialNumber"("companyId", "productId");
CREATE INDEX "SerialNumber_companyId_status_idx" ON "SerialNumber"("companyId", "status");
CREATE INDEX "SerialNumber_companyId_projectId_idx" ON "SerialNumber"("companyId", "projectId");
CREATE UNIQUE INDEX "SerialNumber_companyId_productId_serialNumber_key" ON "SerialNumber"("companyId", "productId", "serialNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProjectSite_companyId_customerId_idx" ON "ProjectSite"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "EnergyProject_companyId_status_idx" ON "EnergyProject"("companyId", "status");

-- CreateIndex
CREATE INDEX "EnergyProject_companyId_customerId_idx" ON "EnergyProject"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "EnergyProject_companyId_siteId_idx" ON "EnergyProject"("companyId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "EnergyProject_companyId_projectNumber_key" ON "EnergyProject"("companyId", "projectNumber");

-- CreateIndex
CREATE INDEX "ProjectItem_projectId_idx" ON "ProjectItem"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");

-- CreateIndex
CREATE INDEX "Installation_companyId_status_idx" ON "Installation"("companyId", "status");

-- CreateIndex
CREATE INDEX "Installation_companyId_projectId_idx" ON "Installation"("companyId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Installation_companyId_installationNumber_key" ON "Installation"("companyId", "installationNumber");

-- CreateIndex
CREATE INDEX "InstallationItem_installationId_idx" ON "InstallationItem"("installationId");

-- CreateIndex
CREATE INDEX "InstallationItem_projectItemId_idx" ON "InstallationItem"("projectItemId");
