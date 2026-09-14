-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vendorId" TEXT NOT NULL,
    "poDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" DATETIME,
    "referenceNumber" TEXT,
    "notes" TEXT,
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
    CONSTRAINT "PurchaseOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrderLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
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
    "receivedQuantity" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "PurchaseOrderLineItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "receiptDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReceipt_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReceipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseReceiptLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseReceiptId" TEXT NOT NULL,
    "purchaseOrderLineItemId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PurchaseReceiptLineItem_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReceiptLineItem_purchaseOrderLineItemId_fkey" FOREIGN KEY ("purchaseOrderLineItemId") REFERENCES "PurchaseOrderLineItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReceiptLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vendorId" TEXT NOT NULL,
    "vendorInvoiceNumber" TEXT,
    "purchaseOrderId" TEXT,
    "purchaseReceiptId" TEXT,
    "invoiceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "notes" TEXT,
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
    CONSTRAINT "VendorInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VendorInvoice_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorInvoiceLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorInvoiceId" TEXT NOT NULL,
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
    CONSTRAINT "VendorInvoiceLineItem_vendorInvoiceId_fkey" FOREIGN KEY ("vendorInvoiceId") REFERENCES "VendorInvoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorInvoiceLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNALLOCATED',
    "vendorId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "allocatedAmount" REAL NOT NULL DEFAULT 0,
    "unallocatedAmount" REAL NOT NULL DEFAULT 0,
    "paymentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" DATETIME,
    "bankName" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Party" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendorPaymentAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorPaymentId" TEXT NOT NULL,
    "vendorInvoiceId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendorPaymentAllocation_vendorPaymentId_fkey" FOREIGN KEY ("vendorPaymentId") REFERENCES "VendorPayment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendorPaymentAllocation_vendorInvoiceId_fkey" FOREIGN KEY ("vendorInvoiceId") REFERENCES "VendorInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_status_idx" ON "PurchaseOrder"("companyId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_companyId_vendorId_idx" ON "PurchaseOrder"("companyId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_companyId_poNumber_key" ON "PurchaseOrder"("companyId", "poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderLineItem_purchaseOrderId_idx" ON "PurchaseOrderLineItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_companyId_purchaseOrderId_idx" ON "PurchaseReceipt"("companyId", "purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_companyId_receiptNumber_key" ON "PurchaseReceipt"("companyId", "receiptNumber");

-- CreateIndex
CREATE INDEX "PurchaseReceiptLineItem_purchaseReceiptId_idx" ON "PurchaseReceiptLineItem"("purchaseReceiptId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptLineItem_purchaseOrderLineItemId_idx" ON "PurchaseReceiptLineItem"("purchaseOrderLineItemId");

-- CreateIndex
CREATE INDEX "VendorInvoice_companyId_status_idx" ON "VendorInvoice"("companyId", "status");

-- CreateIndex
CREATE INDEX "VendorInvoice_companyId_vendorId_idx" ON "VendorInvoice"("companyId", "vendorId");

-- CreateIndex
CREATE INDEX "VendorInvoice_companyId_dueDate_idx" ON "VendorInvoice"("companyId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "VendorInvoice_companyId_invoiceNumber_key" ON "VendorInvoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "VendorInvoiceLineItem_vendorInvoiceId_idx" ON "VendorInvoiceLineItem"("vendorInvoiceId");

-- CreateIndex
CREATE INDEX "VendorPayment_companyId_status_idx" ON "VendorPayment"("companyId", "status");

-- CreateIndex
CREATE INDEX "VendorPayment_companyId_vendorId_idx" ON "VendorPayment"("companyId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPayment_companyId_paymentNumber_key" ON "VendorPayment"("companyId", "paymentNumber");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_vendorPaymentId_idx" ON "VendorPaymentAllocation"("vendorPaymentId");

-- CreateIndex
CREATE INDEX "VendorPaymentAllocation_vendorInvoiceId_idx" ON "VendorPaymentAllocation"("vendorInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPaymentAllocation_vendorPaymentId_vendorInvoiceId_key" ON "VendorPaymentAllocation"("vendorPaymentId", "vendorInvoiceId");
