-- AlterTable
ALTER TABLE "Company" ADD COLUMN "proposalContentJson" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "billingAddressText" TEXT;
ALTER TABLE "Quotation" ADD COLUMN "proposalContentJson" TEXT;
