-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING_STOCK', 'PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'STOCK_ADJUSTMENT', 'DAMAGED', 'LOST', 'CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryLotOrigin" AS ENUM ('PURCHASE', 'OPENING', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InventoryLotStatus" AS ENUM ('OPEN', 'DEPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BalanceEffect" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "SupplierLedgerEntryType" AS ENUM ('PURCHASE', 'PAYMENT', 'PURCHASE_RETURN', 'REFUND', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "CustomerLedgerEntryType" AS ENUM ('SALE', 'PAYMENT', 'SALE_RETURN', 'REFUND', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('SUPPLIER_PAYMENT', 'SUPPLIER_REFUND', 'CUSTOMER_RECEIPT', 'CUSTOMER_REFUND');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decimalScale" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isWalkIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID NOT NULL,
    "inventoryUnitId" UUID NOT NULL,
    "preferredSupplierId" UUID,
    "defaultPurchasePrice" DECIMAL(18,4),
    "defaultSellingPrice" DECIMAL(18,4),
    "lowStockThreshold" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "specifications" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "purchaseNumber" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "supplierInvoiceRef" TEXT,
    "supplierNameSnapshot" TEXT NOT NULL,
    "supplierPhoneSnapshot" TEXT,
    "supplierAddressSnapshot" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'PKR',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "additionalCharges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "amountPaidCached" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "voidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLot" (
    "id" UUID NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "supplierLotReference" TEXT,
    "purchaseId" UUID NOT NULL,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PurchaseLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "purchaseLotId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "uomCodeSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" UUID NOT NULL,
    "origin" "InventoryLotOrigin" NOT NULL,
    "status" "InventoryLotStatus" NOT NULL DEFAULT 'OPEN',
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "purchaseLotId" UUID,
    "purchaseLineId" UUID,
    "originalQuantity" DECIMAL(18,4) NOT NULL,
    "availableQuantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL,
    "closedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoice" (
    "id" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "customerNameSnapshot" TEXT NOT NULL,
    "customerPhoneSnapshot" TEXT,
    "customerAddressSnapshot" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'PKR',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "invoiceDiscountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "amountReceivedCached" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "voidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SalesInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoiceLine" (
    "id" UUID NOT NULL,
    "salesInvoiceId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT NOT NULL,
    "uomCodeSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "lineDiscountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,2) NOT NULL,
    "invoiceDiscountAllocated" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SalesInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLotAllocation" (
    "id" UUID NOT NULL,
    "salesInvoiceLineId" UUID NOT NULL,
    "inventoryLotId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCostSnapshot" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleLotAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" UUID NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "purchaseId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "returnDate" DATE NOT NULL,
    "supplierNameSnapshot" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'PKR',
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "voidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnLine" (
    "id" UUID NOT NULL,
    "purchaseReturnId" UUID NOT NULL,
    "purchaseLineId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "inventoryLotId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" UUID NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "salesInvoiceId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "returnDate" DATE NOT NULL,
    "customerNameSnapshot" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'PKR',
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "voidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturnLine" (
    "id" UUID NOT NULL,
    "saleReturnId" UUID NOT NULL,
    "salesInvoiceLineId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPriceSnapshot" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturnAllocation" (
    "id" UUID NOT NULL,
    "saleReturnLineId" UUID NOT NULL,
    "saleLotAllocationId" UUID NOT NULL,
    "inventoryLotId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCostSnapshot" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleReturnAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" UUID NOT NULL,
    "adjustmentNumber" TEXT NOT NULL,
    "adjustmentDate" DATE NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "voidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustmentLine" (
    "id" UUID NOT NULL,
    "stockAdjustmentId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "inventoryLotId" UUID,
    "movementType" "StockMovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "inventoryLotId" UUID,
    "direction" "MovementDirection" NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCostSnapshot" DECIMAL(18,4),
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "purchaseLineId" UUID,
    "purchaseReturnLineId" UUID,
    "saleLotAllocationId" UUID,
    "saleReturnAllocationId" UUID,
    "adjustmentLineId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" UUID,
    "customerId" UUID,
    "paymentMethodId" UUID NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'PKR',
    "reference" TEXT,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "postedAt" TIMESTAMPTZ(6),
    "voidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPaymentAllocation" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPaymentAllocation" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "salesInvoiceId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierLedgerEntry" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "entryDate" DATE NOT NULL,
    "entryType" "SupplierLedgerEntryType" NOT NULL,
    "effect" "BalanceEffect" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'PKR',
    "purchaseId" UUID,
    "purchaseReturnId" UUID,
    "paymentId" UUID,
    "reference" TEXT,
    "reason" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLedgerEntry" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "entryDate" DATE NOT NULL,
    "entryType" "CustomerLedgerEntryType" NOT NULL,
    "effect" "BalanceEffect" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'PKR',
    "salesInvoiceId" UUID,
    "saleReturnId" UUID,
    "paymentId" UUID,
    "reference" TEXT,
    "reason" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "expenseCategoryId" UUID NOT NULL,
    "expenseDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currencyCode" CHAR(3) NOT NULL DEFAULT 'PKR',
    "description" TEXT NOT NULL,
    "supplierId" UUID,
    "purchaseLotId" UUID,
    "paymentMethodId" UUID NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_isActive_name_idx" ON "Category"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_code_key" ON "UnitOfMeasure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_name_key" ON "UnitOfMeasure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_code_key" ON "InventoryLocation"("code");

-- CreateIndex
CREATE INDEX "InventoryLocation_isActive_idx" ON "InventoryLocation"("isActive");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_phone_idx" ON "Supplier"("phone");

-- CreateIndex
CREATE INDEX "Supplier_isActive_name_idx" ON "Supplier"("isActive", "name");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_isActive_name_idx" ON "Customer"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Product_preferredSupplierId_idx" ON "Product"("preferredSupplierId");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_purchaseNumber_key" ON "Purchase"("purchaseNumber");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_purchaseDate_idx" ON "Purchase"("supplierId", "purchaseDate");

-- CreateIndex
CREATE INDEX "Purchase_status_purchaseDate_idx" ON "Purchase"("status", "purchaseDate");

-- CreateIndex
CREATE INDEX "Purchase_locationId_purchaseDate_idx" ON "Purchase"("locationId", "purchaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLot_lotNumber_key" ON "PurchaseLot"("lotNumber");

-- CreateIndex
CREATE INDEX "PurchaseLot_purchaseId_idx" ON "PurchaseLot"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseLine_purchaseId_idx" ON "PurchaseLine"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseLine_purchaseLotId_productId_idx" ON "PurchaseLine"("purchaseLotId", "productId");

-- CreateIndex
CREATE INDEX "PurchaseLine_productId_idx" ON "PurchaseLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_purchaseLineId_key" ON "InventoryLot"("purchaseLineId");

-- CreateIndex
CREATE INDEX "InventoryLot_productId_locationId_status_receivedAt_idx" ON "InventoryLot"("productId", "locationId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "InventoryLot_productId_locationId_availableQuantity_receive_idx" ON "InventoryLot"("productId", "locationId", "availableQuantity", "receivedAt");

-- CreateIndex
CREATE INDEX "InventoryLot_purchaseLotId_idx" ON "InventoryLot"("purchaseLotId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoice_invoiceNumber_key" ON "SalesInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SalesInvoice_customerId_invoiceDate_idx" ON "SalesInvoice"("customerId", "invoiceDate");

-- CreateIndex
CREATE INDEX "SalesInvoice_status_invoiceDate_idx" ON "SalesInvoice"("status", "invoiceDate");

-- CreateIndex
CREATE INDEX "SalesInvoice_locationId_invoiceDate_idx" ON "SalesInvoice"("locationId", "invoiceDate");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_salesInvoiceId_idx" ON "SalesInvoiceLine"("salesInvoiceId");

-- CreateIndex
CREATE INDEX "SalesInvoiceLine_productId_idx" ON "SalesInvoiceLine"("productId");

-- CreateIndex
CREATE INDEX "SaleLotAllocation_inventoryLotId_idx" ON "SaleLotAllocation"("inventoryLotId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleLotAllocation_salesInvoiceLineId_inventoryLotId_key" ON "SaleLotAllocation"("salesInvoiceLineId", "inventoryLotId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_returnNumber_key" ON "PurchaseReturn"("returnNumber");

-- CreateIndex
CREATE INDEX "PurchaseReturn_purchaseId_idx" ON "PurchaseReturn"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseReturn_supplierId_returnDate_idx" ON "PurchaseReturn"("supplierId", "returnDate");

-- CreateIndex
CREATE INDEX "PurchaseReturn_status_returnDate_idx" ON "PurchaseReturn"("status", "returnDate");

-- CreateIndex
CREATE INDEX "PurchaseReturnLine_purchaseReturnId_idx" ON "PurchaseReturnLine"("purchaseReturnId");

-- CreateIndex
CREATE INDEX "PurchaseReturnLine_purchaseLineId_idx" ON "PurchaseReturnLine"("purchaseLineId");

-- CreateIndex
CREATE INDEX "PurchaseReturnLine_inventoryLotId_idx" ON "PurchaseReturnLine"("inventoryLotId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_returnNumber_key" ON "SaleReturn"("returnNumber");

-- CreateIndex
CREATE INDEX "SaleReturn_salesInvoiceId_idx" ON "SaleReturn"("salesInvoiceId");

-- CreateIndex
CREATE INDEX "SaleReturn_status_returnDate_idx" ON "SaleReturn"("status", "returnDate");

-- CreateIndex
CREATE INDEX "SaleReturnLine_saleReturnId_idx" ON "SaleReturnLine"("saleReturnId");

-- CreateIndex
CREATE INDEX "SaleReturnLine_salesInvoiceLineId_idx" ON "SaleReturnLine"("salesInvoiceLineId");

-- CreateIndex
CREATE INDEX "SaleReturnLine_productId_idx" ON "SaleReturnLine"("productId");

-- CreateIndex
CREATE INDEX "SaleReturnAllocation_saleReturnLineId_idx" ON "SaleReturnAllocation"("saleReturnLineId");

-- CreateIndex
CREATE INDEX "SaleReturnAllocation_saleLotAllocationId_idx" ON "SaleReturnAllocation"("saleLotAllocationId");

-- CreateIndex
CREATE INDEX "SaleReturnAllocation_inventoryLotId_idx" ON "SaleReturnAllocation"("inventoryLotId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_adjustmentNumber_key" ON "StockAdjustment"("adjustmentNumber");

-- CreateIndex
CREATE INDEX "StockAdjustment_status_adjustmentDate_idx" ON "StockAdjustment"("status", "adjustmentDate");

-- CreateIndex
CREATE INDEX "StockAdjustmentLine_stockAdjustmentId_idx" ON "StockAdjustmentLine"("stockAdjustmentId");

-- CreateIndex
CREATE INDEX "StockAdjustmentLine_productId_locationId_idx" ON "StockAdjustmentLine"("productId", "locationId");

-- CreateIndex
CREATE INDEX "StockAdjustmentLine_inventoryLotId_idx" ON "StockAdjustmentLine"("inventoryLotId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_purchaseLineId_key" ON "StockMovement"("purchaseLineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_purchaseReturnLineId_key" ON "StockMovement"("purchaseReturnLineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_saleLotAllocationId_key" ON "StockMovement"("saleLotAllocationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_saleReturnAllocationId_key" ON "StockMovement"("saleReturnAllocationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_adjustmentLineId_key" ON "StockMovement"("adjustmentLineId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_locationId_occurredAt_idx" ON "StockMovement"("productId", "locationId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryLotId_occurredAt_idx" ON "StockMovement"("inventoryLotId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockMovement_movementType_occurredAt_idx" ON "StockMovement"("movementType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_code_key" ON "PaymentMethod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");

-- CreateIndex
CREATE INDEX "Payment_supplierId_paymentDate_idx" ON "Payment"("supplierId", "paymentDate");

-- CreateIndex
CREATE INDEX "Payment_customerId_paymentDate_idx" ON "Payment"("customerId", "paymentDate");

-- CreateIndex
CREATE INDEX "Payment_status_paymentDate_idx" ON "Payment"("status", "paymentDate");

-- CreateIndex
CREATE INDEX "Payment_paymentMethodId_idx" ON "Payment"("paymentMethodId");

-- CreateIndex
CREATE INDEX "SupplierPaymentAllocation_purchaseId_idx" ON "SupplierPaymentAllocation"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentAllocation_paymentId_purchaseId_key" ON "SupplierPaymentAllocation"("paymentId", "purchaseId");

-- CreateIndex
CREATE INDEX "CustomerPaymentAllocation_salesInvoiceId_idx" ON "CustomerPaymentAllocation"("salesInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPaymentAllocation_paymentId_salesInvoiceId_key" ON "CustomerPaymentAllocation"("paymentId", "salesInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLedgerEntry_purchaseId_key" ON "SupplierLedgerEntry"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLedgerEntry_purchaseReturnId_key" ON "SupplierLedgerEntry"("purchaseReturnId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLedgerEntry_paymentId_key" ON "SupplierLedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_supplierId_entryDate_id_idx" ON "SupplierLedgerEntry"("supplierId", "entryDate", "id");

-- CreateIndex
CREATE INDEX "SupplierLedgerEntry_entryType_entryDate_idx" ON "SupplierLedgerEntry"("entryType", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLedgerEntry_salesInvoiceId_key" ON "CustomerLedgerEntry"("salesInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLedgerEntry_saleReturnId_key" ON "CustomerLedgerEntry"("saleReturnId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLedgerEntry_paymentId_key" ON "CustomerLedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "CustomerLedgerEntry_customerId_entryDate_id_idx" ON "CustomerLedgerEntry"("customerId", "entryDate", "id");

-- CreateIndex
CREATE INDEX "CustomerLedgerEntry_entryType_entryDate_idx" ON "CustomerLedgerEntry"("entryType", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseNumber_key" ON "Expense"("expenseNumber");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_expenseCategoryId_idx" ON "Expense"("expenseDate", "expenseCategoryId");

-- CreateIndex
CREATE INDEX "Expense_supplierId_expenseDate_idx" ON "Expense"("supplierId", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_purchaseLotId_idx" ON "Expense"("purchaseLotId");

-- CreateIndex
CREATE INDEX "Expense_paymentMethodId_idx" ON "Expense"("paymentMethodId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLot" ADD CONSTRAINT "PurchaseLot_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLot" ADD CONSTRAINT "PurchaseLot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseLotId_fkey" FOREIGN KEY ("purchaseLotId") REFERENCES "PurchaseLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_purchaseLotId_fkey" FOREIGN KEY ("purchaseLotId") REFERENCES "PurchaseLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_purchaseLineId_fkey" FOREIGN KEY ("purchaseLineId") REFERENCES "PurchaseLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLotAllocation" ADD CONSTRAINT "SaleLotAllocation_salesInvoiceLineId_fkey" FOREIGN KEY ("salesInvoiceLineId") REFERENCES "SalesInvoiceLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLotAllocation" ADD CONSTRAINT "SaleLotAllocation_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_purchaseLineId_fkey" FOREIGN KEY ("purchaseLineId") REFERENCES "PurchaseLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnLine" ADD CONSTRAINT "SaleReturnLine_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnLine" ADD CONSTRAINT "SaleReturnLine_salesInvoiceLineId_fkey" FOREIGN KEY ("salesInvoiceLineId") REFERENCES "SalesInvoiceLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnLine" ADD CONSTRAINT "SaleReturnLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnAllocation" ADD CONSTRAINT "SaleReturnAllocation_saleReturnLineId_fkey" FOREIGN KEY ("saleReturnLineId") REFERENCES "SaleReturnLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnAllocation" ADD CONSTRAINT "SaleReturnAllocation_saleLotAllocationId_fkey" FOREIGN KEY ("saleLotAllocationId") REFERENCES "SaleLotAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturnAllocation" ADD CONSTRAINT "SaleReturnAllocation_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_stockAdjustmentId_fkey" FOREIGN KEY ("stockAdjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryLotId_fkey" FOREIGN KEY ("inventoryLotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseLineId_fkey" FOREIGN KEY ("purchaseLineId") REFERENCES "PurchaseLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseReturnLineId_fkey" FOREIGN KEY ("purchaseReturnLineId") REFERENCES "PurchaseReturnLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_saleLotAllocationId_fkey" FOREIGN KEY ("saleLotAllocationId") REFERENCES "SaleLotAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_saleReturnAllocationId_fkey" FOREIGN KEY ("saleReturnAllocationId") REFERENCES "SaleReturnAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_adjustmentLineId_fkey" FOREIGN KEY ("adjustmentLineId") REFERENCES "StockAdjustmentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPaymentAllocation" ADD CONSTRAINT "CustomerPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPaymentAllocation" ADD CONSTRAINT "CustomerPaymentAllocation_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "SaleReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_purchaseLotId_fkey" FOREIGN KEY ("purchaseLotId") REFERENCES "PurchaseLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 1A reviewed SQL supplement for StockFlow's first Prisma migration.
-- Append this SQL to the generated initial migration BEFORE that migration is first applied.
-- This file is not an independently applied migration and must not be run against an existing schema blindly.

-- Reference/master data
ALTER TABLE "UnitOfMeasure"
  ADD CONSTRAINT "UnitOfMeasure_decimalScale_range"
  CHECK ("decimalScale" BETWEEN 0 AND 4);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_prices_nonnegative"
  CHECK (
    ("defaultPurchasePrice" IS NULL OR "defaultPurchasePrice" >= 0)
    AND ("defaultSellingPrice" IS NULL OR "defaultSellingPrice" >= 0)
    AND "lowStockThreshold" >= 0
  );

CREATE UNIQUE INDEX "InventoryLocation_one_active_default"
  ON "InventoryLocation" ((1))
  WHERE "isDefault" = TRUE AND "isActive" = TRUE;

CREATE UNIQUE INDEX "Customer_one_walk_in"
  ON "Customer" ((1))
  WHERE "isWalkIn" = TRUE;

-- Independent, non-resetting document number sources. Gaps are expected and values are never reused.
CREATE SEQUENCE "Purchase_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "SalesInvoice_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "Payment_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "PurchaseReturn_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "SaleReturn_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "Expense_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "StockAdjustment_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE "PurchaseLot_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;

ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_internal_number_format"
  CHECK ("purchaseNumber" ~ '^PUR-[0-9]{6,}$');

ALTER TABLE "SalesInvoice"
  ADD CONSTRAINT "SalesInvoice_internal_number_format"
  CHECK ("invoiceNumber" ~ '^INV-[0-9]{6,}$');

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_internal_number_format"
  CHECK ("paymentNumber" ~ '^PAY-[0-9]{6,}$');

ALTER TABLE "PurchaseReturn"
  ADD CONSTRAINT "PurchaseReturn_internal_number_format"
  CHECK ("returnNumber" ~ '^PRT-[0-9]{6,}$');

ALTER TABLE "SaleReturn"
  ADD CONSTRAINT "SaleReturn_internal_number_format"
  CHECK ("returnNumber" ~ '^SRT-[0-9]{6,}$');

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_internal_number_format"
  CHECK ("expenseNumber" ~ '^EXP-[0-9]{6,}$');

ALTER TABLE "StockAdjustment"
  ADD CONSTRAINT "StockAdjustment_internal_number_format"
  CHECK ("adjustmentNumber" ~ '^ADJ-[0-9]{6,}$');

ALTER TABLE "PurchaseLot"
  ADD CONSTRAINT "PurchaseLot_internal_number_format"
  CHECK ("lotNumber" ~ '^LOT-[0-9]{6,}$');

-- Purchase and inventory quantities/costs

ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_amounts_valid"
  CHECK (
    "currencyCode" = 'PKR'
    AND "subtotal" >= 0
    AND "additionalCharges" >= 0
    AND "totalAmount" >= 0
    AND "amountPaidCached" >= 0
    AND "totalAmount" = "subtotal" + "additionalCharges"
  );

ALTER TABLE "PurchaseLine"
  ADD CONSTRAINT "PurchaseLine_quantity_cost_valid"
  CHECK (
    "quantity" > 0
    AND "unitCost" > 0
    AND "lineTotal" = round("quantity" * "unitCost", 2)
  );

ALTER TABLE "InventoryLot"
  ADD CONSTRAINT "InventoryLot_quantity_cost_valid"
  CHECK (
    "originalQuantity" > 0
    AND "availableQuantity" >= 0
    AND "availableQuantity" <= "originalQuantity"
    AND "unitCost" > 0
  ),
  ADD CONSTRAINT "InventoryLot_origin_source_valid"
  CHECK (
    ("origin" = 'PURCHASE' AND "purchaseLineId" IS NOT NULL AND "purchaseLotId" IS NOT NULL)
    OR ("origin" IN ('OPENING', 'ADJUSTMENT') AND "purchaseLineId" IS NULL AND "purchaseLotId" IS NULL)
  );

-- Sales and deterministic discounts
ALTER TABLE "SalesInvoice"
  ADD CONSTRAINT "SalesInvoice_amounts_valid"
  CHECK (
    "currencyCode" = 'PKR'
    AND "subtotal" >= 0
    AND "invoiceDiscountAmount" >= 0
    AND "invoiceDiscountAmount" <= "subtotal"
    AND "totalAmount" = "subtotal" - "invoiceDiscountAmount"
    AND "amountReceivedCached" >= 0
  );

ALTER TABLE "SalesInvoiceLine"
  ADD CONSTRAINT "SalesInvoiceLine_amounts_valid"
  CHECK (
    "quantity" > 0
    AND "unitPrice" > 0
    AND "grossAmount" = round("quantity" * "unitPrice", 2)
    AND "lineDiscountAmount" >= 0
    AND "lineDiscountAmount" <= "grossAmount"
    AND "netAmount" = "grossAmount" - "lineDiscountAmount"
    AND "invoiceDiscountAllocated" >= 0
    AND "invoiceDiscountAllocated" <= "netAmount"
  );

ALTER TABLE "SaleLotAllocation"
  ADD CONSTRAINT "SaleLotAllocation_quantity_cost_positive"
  CHECK ("quantity" > 0 AND "unitCostSnapshot" > 0);

ALTER TABLE "SaleReturnLine"
  ADD CONSTRAINT "SaleReturnLine_amounts_positive"
  CHECK ("quantity" > 0 AND "unitPriceSnapshot" > 0 AND "lineTotal" >= 0);

ALTER TABLE "SaleReturnAllocation"
  ADD CONSTRAINT "SaleReturnAllocation_quantity_cost_positive"
  CHECK ("quantity" > 0 AND "unitCostSnapshot" > 0);

ALTER TABLE "SaleReturn"
  ADD CONSTRAINT "SaleReturn_amount_currency_valid"
  CHECK ("currencyCode" = 'PKR' AND "totalAmount" >= 0);

-- Returns and adjustments
ALTER TABLE "PurchaseReturn"
  ADD CONSTRAINT "PurchaseReturn_amount_currency_valid"
  CHECK ("currencyCode" = 'PKR' AND "totalAmount" >= 0);

ALTER TABLE "PurchaseReturnLine"
  ADD CONSTRAINT "PurchaseReturnLine_amounts_positive"
  CHECK (
    "quantity" > 0
    AND "unitCost" > 0
    AND "lineTotal" = round("quantity" * "unitCost", 2)
  );

ALTER TABLE "StockAdjustmentLine"
  ADD CONSTRAINT "StockAdjustmentLine_quantity_cost_valid"
  CHECK ("quantity" > 0 AND ("unitCost" IS NULL OR "unitCost" > 0));

ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_quantity_cost_valid"
  CHECK ("quantity" > 0 AND ("unitCostSnapshot" IS NULL OR "unitCostSnapshot" > 0)),
  ADD CONSTRAINT "StockMovement_exactly_one_source"
  CHECK (
    num_nonnulls(
      "purchaseLineId",
      "purchaseReturnLineId",
      "saleLotAllocationId",
      "saleReturnAllocationId",
      "adjustmentLineId"
    ) = 1
  );

-- Payments, allocations, ledgers, and paid expenses
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_party_kind_valid"
  CHECK (
    "amount" > 0
    AND "currencyCode" = 'PKR'
    AND (
      ("kind" IN ('SUPPLIER_PAYMENT', 'SUPPLIER_REFUND') AND "supplierId" IS NOT NULL AND "customerId" IS NULL)
      OR ("kind" IN ('CUSTOMER_RECEIPT', 'CUSTOMER_REFUND') AND "customerId" IS NOT NULL AND "supplierId" IS NULL)
    )
  );

ALTER TABLE "SupplierPaymentAllocation"
  ADD CONSTRAINT "SupplierPaymentAllocation_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "CustomerPaymentAllocation"
  ADD CONSTRAINT "CustomerPaymentAllocation_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "SupplierLedgerEntry"
  ADD CONSTRAINT "SupplierLedgerEntry_amount_currency_valid"
  CHECK ("amount" > 0 AND "currencyCode" = 'PKR');

ALTER TABLE "CustomerLedgerEntry"
  ADD CONSTRAINT "CustomerLedgerEntry_amount_currency_valid"
  CHECK ("amount" > 0 AND "currencyCode" = 'PKR');

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_amount_currency_valid"
  CHECK ("amount" > 0 AND "currencyCode" = 'PKR');

-- Cross-row purchase-line ownership. Deferred so nested writes can complete first.
CREATE OR REPLACE FUNCTION stockflow_check_purchase_line_ownership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "PurchaseLot" lot
    WHERE lot."id" = NEW."purchaseLotId"
      AND lot."purchaseId" = NEW."purchaseId"
  ) THEN
    RAISE EXCEPTION 'PurchaseLine purchaseId must match its PurchaseLot purchaseId';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "PurchaseLine_purchase_ownership"
AFTER INSERT OR UPDATE OF "purchaseId", "purchaseLotId" ON "PurchaseLine"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_purchase_line_ownership();

-- Posted invoice line allocations must reproduce the authoritative header discount.
CREATE OR REPLACE FUNCTION stockflow_check_invoice_discount_allocation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_invoice_id uuid;
  expected numeric(18,2);
  allocated numeric(18,2);
  invoice_status "DocumentStatus";
BEGIN
  IF TG_TABLE_NAME = 'SalesInvoice' THEN
    target_invoice_id := COALESCE(NEW."id", OLD."id");
  ELSE
    target_invoice_id := COALESCE(NEW."salesInvoiceId", OLD."salesInvoiceId");
  END IF;

  SELECT "invoiceDiscountAmount", "status"
    INTO expected, invoice_status
  FROM "SalesInvoice"
  WHERE "id" = target_invoice_id;

  IF invoice_status = 'POSTED' THEN
    SELECT COALESCE(SUM("invoiceDiscountAllocated"), 0)
      INTO allocated
    FROM "SalesInvoiceLine"
    WHERE "salesInvoiceId" = target_invoice_id;

    IF allocated <> expected THEN
      RAISE EXCEPTION 'Posted invoice discount allocations (%) must equal header discount (%)', allocated, expected;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "SalesInvoice_discount_allocation_matches"
AFTER INSERT OR UPDATE OF "invoiceDiscountAmount", "status" ON "SalesInvoice"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_invoice_discount_allocation();

CREATE CONSTRAINT TRIGGER "SalesInvoiceLine_discount_allocation_matches"
AFTER INSERT OR UPDATE OR DELETE ON "SalesInvoiceLine"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION stockflow_check_invoice_discount_allocation();

-- Party ownership and aggregate allocation limits are cross-row/concurrent invariants.
-- Posting services must lock the Payment and target documents, confirm matching parties,
-- and enforce SUM(allocation.amount) <= Payment.amount within one serializable transaction.
-- Return eligibility, walk-in full payment, immutable posting, and typed movement-source
-- semantics are likewise service invariants backed by the basic checks and unique keys above.

