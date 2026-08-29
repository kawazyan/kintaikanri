-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'CHANGES_PENDING', 'CANCELLED', 'TERMINATED');
CREATE TYPE "ContractType" AS ENUM ('MONTHLY', 'DAILY');
CREATE TYPE "AbsenceDeductionRule" AS ENUM ('YES', 'NO', 'CONSULT');
CREATE TYPE "TravelExpenseRule" AS ENUM ('INCLUDED', 'SEPARATE', 'CONSULT');
CREATE TYPE "OverrideApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ExpenseCategory" AS ENUM ('TRAVEL', 'LODGING', 'OTHER');
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINALIZED', 'REISSUED');

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN "workOrderStaffId" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancelledBy" TEXT;

-- CreateTable
CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "clientCode" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Client_clientCode_key" ON "Client"("clientCode");

CREATE TABLE "ClientAccessToken" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ClientAccessToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientAccessToken_token_key" ON "ClientAccessToken"("token");
CREATE INDEX "ClientAccessToken_clientId_active_idx" ON "ClientAccessToken"("clientId", "active");

CREATE TABLE "WorkOrder" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "plannedDays" INTEGER NOT NULL,
  "defaultStoreName" TEXT NOT NULL,
  "notes" TEXT,
  "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "clientContactName" TEXT NOT NULL,
  "clientContactPhone" TEXT,
  "clientContactEmail" TEXT,
  "clientConfirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "approverName" TEXT,
  "approverPhone" TEXT,
  "approverEmail" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "terminatedAt" TIMESTAMP(3),
  "terminationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkOrder_clientId_yearMonth_idx" ON "WorkOrder"("clientId", "yearMonth");
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

CREATE TABLE "WorkOrderAccessToken" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "WorkOrderAccessToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkOrderAccessToken_token_key" ON "WorkOrderAccessToken"("token");
CREATE INDEX "WorkOrderAccessToken_workOrderId_active_idx" ON "WorkOrderAccessToken"("workOrderId", "active");

CREATE TABLE "WorkOrderStaff" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "staffId" TEXT,
  "requestedName" TEXT NOT NULL,
  "contractType" "ContractType" NOT NULL,
  "rateAmountExTax" INTEGER NOT NULL,
  "absenceDeduction" "AbsenceDeductionRule" NOT NULL,
  "travelExpense" "TravelExpenseRule" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrderStaff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkOrderStaff_workOrderId_requestedName_idx" ON "WorkOrderStaff"("workOrderId", "requestedName");
CREATE INDEX "WorkOrderStaff_staffId_idx" ON "WorkOrderStaff"("staffId");
CREATE INDEX "Shift_workOrderStaffId_idx" ON "Shift"("workOrderStaffId");

CREATE TABLE "WorkOrderSite" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "storeName" TEXT NOT NULL,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "rateOverrideExTax" INTEGER,
  "travelExpense" "TravelExpenseRule",
  "notes" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrderSite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkOrderSite_workOrderId_idx" ON "WorkOrderSite"("workOrderId");

CREATE TABLE "DailyWorkOverride" (
  "id" TEXT NOT NULL,
  "workOrderStaffId" TEXT NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "originalStoreName" TEXT,
  "changedStoreName" TEXT,
  "originalRateExTax" INTEGER,
  "changedRateExTax" INTEGER,
  "originalTravelExpense" "TravelExpenseRule",
  "changedTravelExpense" "TravelExpenseRule",
  "lodgingOccurred" BOOLEAN NOT NULL DEFAULT false,
  "otherExpenseNote" TEXT,
  "reason" TEXT NOT NULL,
  "approvalStatus" "OverrideApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "changedByRole" TEXT NOT NULL,
  "changedByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "approvedByName" TEXT,
  CONSTRAINT "DailyWorkOverride_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DailyWorkOverride_workOrderStaffId_workDate_idx" ON "DailyWorkOverride"("workOrderStaffId", "workDate");

CREATE TABLE "WorkOrderChangeHistory" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "changeType" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "actorRole" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "reason" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrderChangeHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkOrderChangeHistory_workOrderId_changedAt_idx" ON "WorkOrderChangeHistory"("workOrderId", "changedAt");

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "workOrderStaffId" TEXT,
  "yearMonth" TEXT NOT NULL,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "category" "ExpenseCategory" NOT NULL,
  "description" TEXT,
  "amountTaxInclusive" INTEGER NOT NULL,
  "amountExTax" INTEGER NOT NULL,
  "taxAmount" INTEGER NOT NULL,
  "taxRate" INTEGER NOT NULL DEFAULT 10,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewerName" TEXT,
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Expense_staffId_yearMonth_idx" ON "Expense"("staffId", "yearMonth");
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotalExTax" INTEGER NOT NULL DEFAULT 0,
  "taxAmount" INTEGER NOT NULL DEFAULT 0,
  "totalInclTax" INTEGER NOT NULL DEFAULT 0,
  "finalizedAt" TIMESTAMP(3),
  "finalizedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_clientId_yearMonth_idx" ON "Invoice"("clientId", "yearMonth");

CREATE TABLE "InvoiceWorkOrder" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  CONSTRAINT "InvoiceWorkOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceWorkOrder_invoiceId_workOrderId_key" ON "InvoiceWorkOrder"("invoiceId", "workOrderId");

CREATE TABLE "InvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "itemType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "unitPriceExTax" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "subtotalExTax" INTEGER NOT NULL,
  "taxAmount" INTEGER NOT NULL,
  "totalInclTax" INTEGER NOT NULL,
  CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoiceLine_invoiceId_sortOrder_idx" ON "InvoiceLine"("invoiceId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ClientAccessToken" ADD CONSTRAINT "ClientAccessToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrderAccessToken" ADD CONSTRAINT "WorkOrderAccessToken_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderStaff" ADD CONSTRAINT "WorkOrderStaff_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderStaff" ADD CONSTRAINT "WorkOrderStaff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_workOrderStaffId_fkey" FOREIGN KEY ("workOrderStaffId") REFERENCES "WorkOrderStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrderSite" ADD CONSTRAINT "WorkOrderSite_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyWorkOverride" ADD CONSTRAINT "DailyWorkOverride_workOrderStaffId_fkey" FOREIGN KEY ("workOrderStaffId") REFERENCES "WorkOrderStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderChangeHistory" ADD CONSTRAINT "WorkOrderChangeHistory_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_workOrderStaffId_fkey" FOREIGN KEY ("workOrderStaffId") REFERENCES "WorkOrderStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceWorkOrder" ADD CONSTRAINT "InvoiceWorkOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceWorkOrder" ADD CONSTRAINT "InvoiceWorkOrder_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
