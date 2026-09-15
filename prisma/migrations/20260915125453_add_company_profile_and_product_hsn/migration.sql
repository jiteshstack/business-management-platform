-- AlterTable
ALTER TABLE "Company" ADD COLUMN "addressLine1" TEXT;
ALTER TABLE "Company" ADD COLUMN "addressLine2" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankIfsc" TEXT;
ALTER TABLE "Company" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Company" ADD COLUMN "city" TEXT;
ALTER TABLE "Company" ADD COLUMN "email" TEXT;
ALTER TABLE "Company" ADD COLUMN "gstin" TEXT;
ALTER TABLE "Company" ADD COLUMN "pan" TEXT;
ALTER TABLE "Company" ADD COLUMN "phone" TEXT;
ALTER TABLE "Company" ADD COLUMN "pincode" TEXT;
ALTER TABLE "Company" ADD COLUMN "state" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "hsnCode" TEXT;
