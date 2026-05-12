-- CreateEnum
CREATE TYPE "UserBranchRole" AS ENUM ('SUPER_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER');

-- CreateEnum
CREATE TYPE "PartCatalogQualityGrade" AS ENUM ('ORIGINAL', 'OEM', 'COPY');

-- CreateEnum
CREATE TYPE "PartCatalogCategoryBand" AS ENUM ('MAJOR_PARTS', 'CAMERA', 'SMALL_PARTS');

-- CreateEnum
CREATE TYPE "PartCatalogSuggestionSource" AS ENUM ('AI', 'IMPORT', 'USER');

-- CreateEnum
CREATE TYPE "PartCatalogSuggestionStatus" AS ENUM ('PENDING', 'REJECTED', 'APPLIED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "businessType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sourcingCountries" JSONB NOT NULL,
    "sourcingOther" TEXT,
    "requirements" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetupProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameZh" TEXT,
    "nameAr" TEXT,
    "nameUr" TEXT,

    CONSTRAINT "MasterCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterCategoryTranslation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "translatedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterCategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterSparePart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MasterSparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterScreenQuality" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MasterScreenQuality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterToolBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "MasterToolBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageSize" (
    "id" TEXT NOT NULL,
    "sizeGb" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "StorageSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceColor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DeviceColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceQuality" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DeviceQuality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceFault" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DeviceFault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "logo" TEXT,
    "spreadBps" INTEGER NOT NULL DEFAULT 0,
    "companyEquityUsd" DOUBLE PRECISION,
    "pricingMethod" TEXT NOT NULL DEFAULT 'FIFO',
    "pricingLocked" BOOLEAN NOT NULL DEFAULT false,
    "pricingLockedAt" TIMESTAMP(3),
    "hidePoweredByBranding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxBranches" INTEGER NOT NULL DEFAULT 3,
    "features" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pricingModel" TEXT NOT NULL DEFAULT 'flat',
    "pricePerBranchMonthly" DOUBLE PRECISION,
    "modulePrices" JSONB,
    "limitsUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyUsage" (
    "companyId" TEXT NOT NULL,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "activeBranches" INTEGER NOT NULL DEFAULT 0,
    "inventoryCount" INTEGER NOT NULL DEFAULT 0,
    "salesCountMonthly" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyUsage_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "roleId" TEXT NOT NULL,
    "branchRole" "UserBranchRole" NOT NULL DEFAULT 'BRANCH_USER',
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "otpChannel" TEXT NOT NULL DEFAULT 'EMAIL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastIp" TEXT,
    "lastLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "adminName" TEXT,
    "currency" TEXT DEFAULT 'USD',
    "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "logo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchContact" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT,
    "website" TEXT,
    "country" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceType" TEXT NOT NULL DEFAULT 'debit',
    "paymentMethod" TEXT,
    "moneyStatus" TEXT,
    "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockedBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contact" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierContact" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT,
    "website" TEXT,
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceType" TEXT NOT NULL DEFAULT 'debit',
    "paymentMethod" TEXT,
    "moneyStatus" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContact" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneBrand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneBrandTranslation" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "translatedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneBrandTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneModel" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "releaseYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneModelTranslation" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "translatedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneModelTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneVariant" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "storage" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceGrade" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "DeviceGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "barcode" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'phone',
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "storage" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "isLegacyCost" BOOLEAN NOT NULL DEFAULT false,
    "originalCost" DOUBLE PRECISION,
    "originalCurrency" TEXT,
    "costUsd" DOUBLE PRECISION,
    "purchaseCurrency" TEXT,
    "exchangeRateAtPurchase" DOUBLE PRECISION,
    "cargoCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "phoneVariantId" TEXT,
    "deviceGradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarcodeSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarcodeSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IMEIRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "inventoryId" TEXT,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IMEIRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT,
    "referenceId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "transferMarginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,

    CONSTRAINT "TransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT,
    "customerId" TEXT,
    "branchId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "cargoCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherCosts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "purchaseCurrency" TEXT,
    "totalAmountUsd" DOUBLE PRECISION,
    "cargoCostUsd" DOUBLE PRECISION,
    "exchangeRateAtTransaction" DOUBLE PRECISION,
    "exchangeRateAtPurchase" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "productType" TEXT NOT NULL DEFAULT 'phone',
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "storage" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalAmountUsd" DOUBLE PRECISION,
    "profitUsd" DOUBLE PRECISION,
    "exchangeRateAtTransaction" DOUBLE PRECISION,
    "pricingMethodUsed" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL,
    "costUsdUsed" DOUBLE PRECISION,
    "revenueUsd" DOUBLE PRECISION,
    "profitUsd" DOUBLE PRECISION,
    "pricingMethodUsed" TEXT,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "orderNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRateAtOrder" DOUBLE PRECISION,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmountUsd" DOUBLE PRECISION,
    "createdById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "inventoryId" TEXT,
    "imei" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "salesOrderId" TEXT,
    "saleId" TEXT,
    "invoiceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRateAtTransaction" DOUBLE PRECISION,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmountUsd" DOUBLE PRECISION,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaidUsd" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profitUsd" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "inventoryId" TEXT,
    "imei" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costUsdUsed" DOUBLE PRECISION,
    "revenueUsd" DOUBLE PRECISION,
    "profitUsd" DOUBLE PRECISION,
    "refurbCostUsdUsed" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repair" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "imei" TEXT NOT NULL,
    "faultDescription" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "customerId" TEXT,
    "repairCost" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefurbishJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "incomingDevice" TEXT NOT NULL,
    "partsUsed" TEXT,
    "laborCost" DOUBLE PRECISION NOT NULL,
    "finalCondition" TEXT NOT NULL,
    "deviceGradeId" TEXT,
    "technicianId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefurbishJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT,
    "displayFormat" TEXT,
    "type" TEXT NOT NULL DEFAULT 'forex',
    "sourceProvider" TEXT NOT NULL DEFAULT 'manual',
    "baseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "previousRate" DOUBLE PRECISION,
    "marketPrice" DOUBLE PRECISION,
    "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isAuto" BOOLEAN NOT NULL DEFAULT true,
    "manualRate" DOUBLE PRECISION,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierFxRate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierFxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRateHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'derived',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "branchId" TEXT,
    "metadata" JSONB,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'low_stock',
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "storage" TEXT,
    "message" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 3,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileUpload" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "errorCode" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'open',
    "aiSuggestion" TEXT,
    "source" TEXT NOT NULL DEFAULT 'system',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "saleId" TEXT,
    "warrantyStart" TIMESTAMP(3) NOT NULL,
    "warrantyEnd" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TACCache" (
    "id" TEXT NOT NULL,
    "tac" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "storage" TEXT,
    "color" TEXT,
    "releaseYear" INTEGER,
    "deviceCategory" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TACCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSpecification" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "chipset" TEXT,
    "ram" TEXT,
    "storage" TEXT,
    "battery" TEXT,
    "displaySize" TEXT,
    "releaseYear" INTEGER,
    "deviceCategory" TEXT,
    "phoneVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceFeature" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "featureValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IMEIHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "location" TEXT,
    "userId" TEXT,
    "referenceId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IMEIHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "storage" TEXT,
    "averagePrice" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAlert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "data" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "integrationType" TEXT NOT NULL,
    "requestPayload" TEXT,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceApp" (
    "id" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "developer" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceInstall" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "config" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceInstall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inventoryId" TEXT,
    "imei" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "fromGrade" TEXT,
    "toGrade" TEXT,
    "purchaseId" TEXT,
    "repairId" TEXT,
    "saleId" TEXT,
    "transferId" TEXT,
    "userId" TEXT,
    "notes" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL DEFAULT 'shelf',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT,
    "batchNumber" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPart" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "batchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPartMovement" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "branchId" TEXT NOT NULL,
    "userId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryPartMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepairPart" (
    "id" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "partId" TEXT,
    "partName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefurbishmentTest" (
    "id" TEXT NOT NULL,
    "refurbishJobId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "testedAt" TIMESTAMP(3),
    "testedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefurbishmentTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefurbishmentResult" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefurbishmentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierRating" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "deliveryTime" INTEGER,
    "qualityScore" DOUBLE PRECISION,
    "notes" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "storage" TEXT,
    "condition" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canTransfer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountUsd" DOUBLE PRECISION,
    "exchangeRateAtTransaction" DOUBLE PRECISION,
    "description" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'investor',
    "capitalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sharePercentage" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountUsd" DOUBLE PRECISION,
    "exchangeRateAtTransaction" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestorTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitDistribution" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "customerId" TEXT,
    "saleId" TEXT,
    "purchaseId" TEXT,
    "invoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountUsd" DOUBLE PRECISION,
    "exchangeRateAtTransaction" DOUBLE PRECISION,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "repairCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "partsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deviceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteStudent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "studentCode" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstituteStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteCourse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstituteCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteBatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstituteBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstituteEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteFeeCharge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "label" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstituteFeeCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstituteAttendance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstituteAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartCatalogSeries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "phoneModelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartCatalogSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartCatalogCategory" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "band" "PartCatalogCategoryBand",
    "allowsParts" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartCatalogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartCatalogItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "qualityGrade" "PartCatalogQualityGrade" NOT NULL DEFAULT 'OEM',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "oemPartNumber" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartCatalogItemCompatibility" (
    "id" TEXT NOT NULL,
    "partItemId" TEXT NOT NULL,
    "phoneVariantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartCatalogItemCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartCatalogSuggestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "source" "PartCatalogSuggestionSource" NOT NULL,
    "status" "PartCatalogSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "submittedByUserId" TEXT,
    "reviewerUserId" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartCatalogSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdByUserId" TEXT,
    "structured" JSONB NOT NULL DEFAULT '{}',
    "customNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SetupProfile_companyId_key" ON "SetupProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterCategory_name_key" ON "MasterCategory"("name");

-- CreateIndex
CREATE INDEX "MasterCategoryTranslation_language_idx" ON "MasterCategoryTranslation"("language");

-- CreateIndex
CREATE UNIQUE INDEX "MasterCategoryTranslation_categoryId_language_key" ON "MasterCategoryTranslation"("categoryId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "MasterSparePart_name_key" ON "MasterSparePart"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MasterScreenQuality_name_key" ON "MasterScreenQuality"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MasterToolBrand_name_key" ON "MasterToolBrand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StorageSize_sizeGb_key" ON "StorageSize"("sizeGb");

-- CreateIndex
CREATE UNIQUE INDEX "StorageSize_label_key" ON "StorageSize"("label");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceColor_name_key" ON "DeviceColor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceQuality_name_key" ON "DeviceQuality"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceFault_name_key" ON "DeviceFault"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_key" ON "CompanySettings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_companyId_key" ON "Subscription"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- CreateIndex
CREATE INDEX "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_userId_deviceId_key" ON "TrustedDevice"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");

-- CreateIndex
CREATE INDEX "PasswordReset_token_idx" ON "PasswordReset"("token");

-- CreateIndex
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE INDEX "BranchContact_branchId_idx" ON "BranchContact"("branchId");

-- CreateIndex
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");

-- CreateIndex
CREATE INDEX "SupplierContact_supplierId_idx" ON "SupplierContact"("supplierId");

-- CreateIndex
CREATE INDEX "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE INDEX "CustomerContact_customerId_idx" ON "CustomerContact"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneBrand_name_key" ON "PhoneBrand"("name");

-- CreateIndex
CREATE INDEX "PhoneBrandTranslation_language_idx" ON "PhoneBrandTranslation"("language");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneBrandTranslation_brandId_language_key" ON "PhoneBrandTranslation"("brandId", "language");

-- CreateIndex
CREATE INDEX "PhoneModel_brandId_idx" ON "PhoneModel"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneModel_brandId_name_key" ON "PhoneModel"("brandId", "name");

-- CreateIndex
CREATE INDEX "PhoneModelTranslation_language_idx" ON "PhoneModelTranslation"("language");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneModelTranslation_modelId_language_key" ON "PhoneModelTranslation"("modelId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneVariant_modelId_storage_color_key" ON "PhoneVariant"("modelId", "storage", "color");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceGrade_code_key" ON "DeviceGrade"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_imei_key" ON "Inventory"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_barcode_key" ON "Inventory"("barcode");

-- CreateIndex
CREATE INDEX "Inventory_imei_idx" ON "Inventory"("imei");

-- CreateIndex
CREATE INDEX "Inventory_barcode_idx" ON "Inventory"("barcode");

-- CreateIndex
CREATE INDEX "Inventory_companyId_idx" ON "Inventory"("companyId");

-- CreateIndex
CREATE INDEX "Inventory_branchId_idx" ON "Inventory"("branchId");

-- CreateIndex
CREATE INDEX "Inventory_createdAt_idx" ON "Inventory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeSequence_companyId_key" ON "BarcodeSequence"("companyId");

-- CreateIndex
CREATE INDEX "IMEIRecord_imei_idx" ON "IMEIRecord"("imei");

-- CreateIndex
CREATE INDEX "IMEIRecord_companyId_idx" ON "IMEIRecord"("companyId");

-- CreateIndex
CREATE INDEX "StockMovement_inventoryId_idx" ON "StockMovement"("inventoryId");

-- CreateIndex
CREATE INDEX "StockMovement_companyId_idx" ON "StockMovement"("companyId");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_idx" ON "StockMovement"("branchId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "Transfer_companyId_idx" ON "Transfer"("companyId");

-- CreateIndex
CREATE INDEX "Purchase_companyId_idx" ON "Purchase"("companyId");

-- CreateIndex
CREATE INDEX "Sale_companyId_idx" ON "Sale"("companyId");

-- CreateIndex
CREATE INDEX "SalesOrder_companyId_idx" ON "SalesOrder"("companyId");

-- CreateIndex
CREATE INDEX "SalesOrder_branchId_idx" ON "SalesOrder"("branchId");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_companyId_orderNumber_key" ON "SalesOrder"("companyId", "orderNumber");

-- CreateIndex
CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_inventoryId_idx" ON "SalesOrderItem"("inventoryId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_imei_idx" ON "SalesOrderItem"("imei");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_branchId_idx" ON "Invoice"("branchId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_inventoryId_idx" ON "InvoiceItem"("inventoryId");

-- CreateIndex
CREATE INDEX "InvoiceItem_imei_idx" ON "InvoiceItem"("imei");

-- CreateIndex
CREATE INDEX "Repair_companyId_idx" ON "Repair"("companyId");

-- CreateIndex
CREATE INDEX "Repair_branchId_idx" ON "Repair"("branchId");

-- CreateIndex
CREATE INDEX "RefurbishJob_companyId_idx" ON "RefurbishJob"("companyId");

-- CreateIndex
CREATE INDEX "RefurbishJob_branchId_idx" ON "RefurbishJob"("branchId");

-- CreateIndex
CREATE INDEX "Currency_companyId_idx" ON "Currency"("companyId");

-- CreateIndex
CREATE INDEX "Currency_code_idx" ON "Currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_companyId_code_key" ON "Currency"("companyId", "code");

-- CreateIndex
CREATE INDEX "SupplierFxRate_companyId_idx" ON "SupplierFxRate"("companyId");

-- CreateIndex
CREATE INDEX "SupplierFxRate_supplierId_idx" ON "SupplierFxRate"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierFxRate_companyId_currencyCode_idx" ON "SupplierFxRate"("companyId", "currencyCode");

-- CreateIndex
CREATE INDEX "SupplierFxRate_effectiveAt_idx" ON "SupplierFxRate"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierFxRate_supplierId_currencyCode_key" ON "SupplierFxRate"("supplierId", "currencyCode");

-- CreateIndex
CREATE INDEX "CurrencyHistory_companyId_idx" ON "CurrencyHistory"("companyId");

-- CreateIndex
CREATE INDEX "CurrencyHistory_companyId_currencyCode_idx" ON "CurrencyHistory"("companyId", "currencyCode");

-- CreateIndex
CREATE INDEX "CurrencyHistory_date_idx" ON "CurrencyHistory"("date");

-- CreateIndex
CREATE INDEX "ExchangeRateHistory_companyId_idx" ON "ExchangeRateHistory"("companyId");

-- CreateIndex
CREATE INDEX "ExchangeRateHistory_companyId_date_idx" ON "ExchangeRateHistory"("companyId", "date");

-- CreateIndex
CREATE INDEX "ExchangeRateHistory_companyId_fromCurrency_toCurrency_idx" ON "ExchangeRateHistory"("companyId", "fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "Translation_companyId_idx" ON "Translation"("companyId");

-- CreateIndex
CREATE INDEX "Translation_companyId_languageCode_idx" ON "Translation"("companyId", "languageCode");

-- CreateIndex
CREATE INDEX "Translation_companyId_key_idx" ON "Translation"("companyId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_companyId_key_languageCode_key" ON "Translation"("companyId", "key", "languageCode");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_idx" ON "AuditLog"("branchId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "StockAlert_companyId_idx" ON "StockAlert"("companyId");

-- CreateIndex
CREATE INDEX "FileUpload_companyId_idx" ON "FileUpload"("companyId");

-- CreateIndex
CREATE INDEX "Incident_companyId_idx" ON "Incident"("companyId");

-- CreateIndex
CREATE INDEX "Incident_errorCode_idx" ON "Incident"("errorCode");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");

-- CreateIndex
CREATE INDEX "Warranty_companyId_idx" ON "Warranty"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_companyId_imei_key" ON "Warranty"("companyId", "imei");

-- CreateIndex
CREATE UNIQUE INDEX "TACCache_tac_key" ON "TACCache"("tac");

-- CreateIndex
CREATE INDEX "TACCache_tac_idx" ON "TACCache"("tac");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSpecification_brand_model_key" ON "DeviceSpecification"("brand", "model");

-- CreateIndex
CREATE INDEX "DeviceFeature_specId_idx" ON "DeviceFeature"("specId");

-- CreateIndex
CREATE INDEX "IMEIHistory_imei_idx" ON "IMEIHistory"("imei");

-- CreateIndex
CREATE INDEX "IMEIHistory_timestamp_idx" ON "IMEIHistory"("timestamp");

-- CreateIndex
CREATE INDEX "IMEIHistory_companyId_idx" ON "IMEIHistory"("companyId");

-- CreateIndex
CREATE INDEX "IMEIHistory_imei_companyId_idx" ON "IMEIHistory"("imei", "companyId");

-- CreateIndex
CREATE INDEX "MarketPrice_brand_model_idx" ON "MarketPrice"("brand", "model");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "AIAlert_companyId_idx" ON "AIAlert"("companyId");

-- CreateIndex
CREATE INDEX "AIAlert_createdAt_idx" ON "AIAlert"("createdAt");

-- CreateIndex
CREATE INDEX "AIAlert_branchId_idx" ON "AIAlert"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_companyId_idx" ON "ApiKey"("companyId");

-- CreateIndex
CREATE INDEX "ApiKey_key_idx" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "Webhook_companyId_idx" ON "Webhook"("companyId");

-- CreateIndex
CREATE INDEX "Webhook_eventType_idx" ON "Webhook"("eventType");

-- CreateIndex
CREATE INDEX "IntegrationLog_companyId_idx" ON "IntegrationLog"("companyId");

-- CreateIndex
CREATE INDEX "IntegrationLog_timestamp_idx" ON "IntegrationLog"("timestamp");

-- CreateIndex
CREATE INDEX "MarketplaceInstall_companyId_idx" ON "MarketplaceInstall"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceInstall_companyId_appId_key" ON "MarketplaceInstall"("companyId", "appId");

-- CreateIndex
CREATE INDEX "DeviceHistory_imei_idx" ON "DeviceHistory"("imei");

-- CreateIndex
CREATE INDEX "DeviceHistory_companyId_idx" ON "DeviceHistory"("companyId");

-- CreateIndex
CREATE INDEX "DeviceHistory_inventoryId_idx" ON "DeviceHistory"("inventoryId");

-- CreateIndex
CREATE INDEX "DeviceHistory_createdAt_idx" ON "DeviceHistory"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryLocation_branchId_idx" ON "InventoryLocation"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_branchId_code_key" ON "InventoryLocation"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_batchNumber_key" ON "InventoryBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "InventoryBatch_purchaseId_idx" ON "InventoryBatch"("purchaseId");

-- CreateIndex
CREATE INDEX "InventoryPart_companyId_idx" ON "InventoryPart"("companyId");

-- CreateIndex
CREATE INDEX "InventoryPart_branchId_idx" ON "InventoryPart"("branchId");

-- CreateIndex
CREATE INDEX "InventoryPart_category_idx" ON "InventoryPart"("category");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPart_branchId_sku_key" ON "InventoryPart"("branchId", "sku");

-- CreateIndex
CREATE INDEX "InventoryPartMovement_partId_idx" ON "InventoryPartMovement"("partId");

-- CreateIndex
CREATE INDEX "InventoryPartMovement_createdAt_idx" ON "InventoryPartMovement"("createdAt");

-- CreateIndex
CREATE INDEX "RepairPart_repairId_idx" ON "RepairPart"("repairId");

-- CreateIndex
CREATE INDEX "RefurbishmentTest_refurbishJobId_idx" ON "RefurbishmentTest"("refurbishJobId");

-- CreateIndex
CREATE INDEX "RefurbishmentResult_testId_idx" ON "RefurbishmentResult"("testId");

-- CreateIndex
CREATE INDEX "SupplierRating_supplierId_idx" ON "SupplierRating"("supplierId");

-- CreateIndex
CREATE INDEX "PriceHistory_supplierId_idx" ON "PriceHistory"("supplierId");

-- CreateIndex
CREATE INDEX "PriceHistory_brand_model_idx" ON "PriceHistory"("brand", "model");

-- CreateIndex
CREATE INDEX "BranchPermission_userId_idx" ON "BranchPermission"("userId");

-- CreateIndex
CREATE INDEX "BranchPermission_branchId_idx" ON "BranchPermission"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchPermission_userId_branchId_key" ON "BranchPermission"("userId", "branchId");

-- CreateIndex
CREATE INDEX "Expense_companyId_idx" ON "Expense"("companyId");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_branchId_idx" ON "Expense"("branchId");

-- CreateIndex
CREATE INDEX "Investor_companyId_idx" ON "Investor"("companyId");

-- CreateIndex
CREATE INDEX "Investor_companyId_type_idx" ON "Investor"("companyId", "type");

-- CreateIndex
CREATE INDEX "Investor_companyId_active_idx" ON "Investor"("companyId", "active");

-- CreateIndex
CREATE INDEX "InvestorTransaction_companyId_idx" ON "InvestorTransaction"("companyId");

-- CreateIndex
CREATE INDEX "InvestorTransaction_investorId_idx" ON "InvestorTransaction"("investorId");

-- CreateIndex
CREATE INDEX "InvestorTransaction_date_idx" ON "InvestorTransaction"("date");

-- CreateIndex
CREATE INDEX "ProfitDistribution_companyId_idx" ON "ProfitDistribution"("companyId");

-- CreateIndex
CREATE INDEX "ProfitDistribution_investorId_idx" ON "ProfitDistribution"("investorId");

-- CreateIndex
CREATE INDEX "ProfitDistribution_period_idx" ON "ProfitDistribution"("period");

-- CreateIndex
CREATE INDEX "ProfitDistribution_date_idx" ON "ProfitDistribution"("date");

-- CreateIndex
CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- CreateIndex
CREATE INDEX "Payment_purchaseId_idx" ON "Payment"("purchaseId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "ProfitReport_companyId_idx" ON "ProfitReport"("companyId");

-- CreateIndex
CREATE INDEX "ProfitReport_periodStart_idx" ON "ProfitReport"("periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitReport_companyId_branchId_periodType_periodStart_key" ON "ProfitReport"("companyId", "branchId", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "InstituteStudent_companyId_idx" ON "InstituteStudent"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InstituteStudent_companyId_studentCode_key" ON "InstituteStudent"("companyId", "studentCode");

-- CreateIndex
CREATE INDEX "InstituteCourse_companyId_idx" ON "InstituteCourse"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InstituteCourse_companyId_code_key" ON "InstituteCourse"("companyId", "code");

-- CreateIndex
CREATE INDEX "InstituteBatch_companyId_idx" ON "InstituteBatch"("companyId");

-- CreateIndex
CREATE INDEX "InstituteBatch_courseId_idx" ON "InstituteBatch"("courseId");

-- CreateIndex
CREATE INDEX "InstituteEnrollment_batchId_idx" ON "InstituteEnrollment"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "InstituteEnrollment_studentId_batchId_key" ON "InstituteEnrollment"("studentId", "batchId");

-- CreateIndex
CREATE INDEX "InstituteFeeCharge_companyId_idx" ON "InstituteFeeCharge"("companyId");

-- CreateIndex
CREATE INDEX "InstituteFeeCharge_studentId_idx" ON "InstituteFeeCharge"("studentId");

-- CreateIndex
CREATE INDEX "InstituteAttendance_companyId_idx" ON "InstituteAttendance"("companyId");

-- CreateIndex
CREATE INDEX "InstituteAttendance_batchId_idx" ON "InstituteAttendance"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "InstituteAttendance_enrollmentId_date_key" ON "InstituteAttendance"("enrollmentId", "date");

-- CreateIndex
CREATE INDEX "PartCatalogSeries_companyId_idx" ON "PartCatalogSeries"("companyId");

-- CreateIndex
CREATE INDEX "PartCatalogSeries_phoneModelId_idx" ON "PartCatalogSeries"("phoneModelId");

-- CreateIndex
CREATE UNIQUE INDEX "PartCatalogSeries_companyId_name_key" ON "PartCatalogSeries"("companyId", "name");

-- CreateIndex
CREATE INDEX "PartCatalogCategory_seriesId_idx" ON "PartCatalogCategory"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "PartCatalogCategory_seriesId_parentId_name_key" ON "PartCatalogCategory"("seriesId", "parentId", "name");

-- CreateIndex
CREATE INDEX "PartCatalogItem_categoryId_idx" ON "PartCatalogItem"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PartCatalogItem_categoryId_sku_qualityGrade_key" ON "PartCatalogItem"("categoryId", "sku", "qualityGrade");

-- CreateIndex
CREATE INDEX "PartCatalogItemCompatibility_phoneVariantId_idx" ON "PartCatalogItemCompatibility"("phoneVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "PartCatalogItemCompatibility_partItemId_phoneVariantId_key" ON "PartCatalogItemCompatibility"("partItemId", "phoneVariantId");

-- CreateIndex
CREATE INDEX "PartCatalogSuggestion_companyId_status_idx" ON "PartCatalogSuggestion"("companyId", "status");

-- CreateIndex
CREATE INDEX "SourcingRequest_companyId_idx" ON "SourcingRequest"("companyId");

-- CreateIndex
CREATE INDEX "SourcingRequest_status_idx" ON "SourcingRequest"("status");

-- AddForeignKey
ALTER TABLE "SetupProfile" ADD CONSTRAINT "SetupProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterCategoryTranslation" ADD CONSTRAINT "MasterCategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyUsage" ADD CONSTRAINT "CompanyUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchContact" ADD CONSTRAINT "BranchContact_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierContact" ADD CONSTRAINT "SupplierContact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneBrandTranslation" ADD CONSTRAINT "PhoneBrandTranslation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "PhoneBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneModel" ADD CONSTRAINT "PhoneModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "PhoneBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneModelTranslation" ADD CONSTRAINT "PhoneModelTranslation_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "PhoneModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneVariant" ADD CONSTRAINT "PhoneVariant_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "PhoneModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_phoneVariantId_fkey" FOREIGN KEY ("phoneVariantId") REFERENCES "PhoneVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_deviceGradeId_fkey" FOREIGN KEY ("deviceGradeId") REFERENCES "DeviceGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarcodeSequence" ADD CONSTRAINT "BarcodeSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IMEIRecord" ADD CONSTRAINT "IMEIRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IMEIRecord" ADD CONSTRAINT "IMEIRecord_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefurbishJob" ADD CONSTRAINT "RefurbishJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefurbishJob" ADD CONSTRAINT "RefurbishJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefurbishJob" ADD CONSTRAINT "RefurbishJob_deviceGradeId_fkey" FOREIGN KEY ("deviceGradeId") REFERENCES "DeviceGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefurbishJob" ADD CONSTRAINT "RefurbishJob_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFxRate" ADD CONSTRAINT "SupplierFxRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierFxRate" ADD CONSTRAINT "SupplierFxRate_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyHistory" ADD CONSTRAINT "CurrencyHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyHistory" ADD CONSTRAINT "CurrencyHistory_companyId_currencyCode_fkey" FOREIGN KEY ("companyId", "currencyCode") REFERENCES "Currency"("companyId", "code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRateHistory" ADD CONSTRAINT "ExchangeRateHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSpecification" ADD CONSTRAINT "DeviceSpecification_phoneVariantId_fkey" FOREIGN KEY ("phoneVariantId") REFERENCES "PhoneVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceFeature" ADD CONSTRAINT "DeviceFeature_specId_fkey" FOREIGN KEY ("specId") REFERENCES "DeviceSpecification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IMEIHistory" ADD CONSTRAINT "IMEIHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAlert" ADD CONSTRAINT "AIAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAlert" ADD CONSTRAINT "AIAlert_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceInstall" ADD CONSTRAINT "MarketplaceInstall_appId_fkey" FOREIGN KEY ("appId") REFERENCES "MarketplaceApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceHistory" ADD CONSTRAINT "DeviceHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceHistory" ADD CONSTRAINT "DeviceHistory_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPart" ADD CONSTRAINT "InventoryPart_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPart" ADD CONSTRAINT "InventoryPart_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPart" ADD CONSTRAINT "InventoryPart_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPart" ADD CONSTRAINT "InventoryPart_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPartMovement" ADD CONSTRAINT "InventoryPartMovement_partId_fkey" FOREIGN KEY ("partId") REFERENCES "InventoryPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairPart" ADD CONSTRAINT "RepairPart_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepairPart" ADD CONSTRAINT "RepairPart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "InventoryPart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefurbishmentTest" ADD CONSTRAINT "RefurbishmentTest_refurbishJobId_fkey" FOREIGN KEY ("refurbishJobId") REFERENCES "RefurbishJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefurbishmentResult" ADD CONSTRAINT "RefurbishmentResult_testId_fkey" FOREIGN KEY ("testId") REFERENCES "RefurbishmentTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRating" ADD CONSTRAINT "SupplierRating_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchPermission" ADD CONSTRAINT "BranchPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchPermission" ADD CONSTRAINT "BranchPermission_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorTransaction" ADD CONSTRAINT "InvestorTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorTransaction" ADD CONSTRAINT "InvestorTransaction_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitDistribution" ADD CONSTRAINT "ProfitDistribution_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitDistribution" ADD CONSTRAINT "ProfitDistribution_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitReport" ADD CONSTRAINT "ProfitReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteStudent" ADD CONSTRAINT "InstituteStudent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteStudent" ADD CONSTRAINT "InstituteStudent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteCourse" ADD CONSTRAINT "InstituteCourse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteBatch" ADD CONSTRAINT "InstituteBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteBatch" ADD CONSTRAINT "InstituteBatch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "InstituteCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteEnrollment" ADD CONSTRAINT "InstituteEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "InstituteStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteEnrollment" ADD CONSTRAINT "InstituteEnrollment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InstituteBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteFeeCharge" ADD CONSTRAINT "InstituteFeeCharge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteFeeCharge" ADD CONSTRAINT "InstituteFeeCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "InstituteStudent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteAttendance" ADD CONSTRAINT "InstituteAttendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteAttendance" ADD CONSTRAINT "InstituteAttendance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InstituteBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstituteAttendance" ADD CONSTRAINT "InstituteAttendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "InstituteEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogSeries" ADD CONSTRAINT "PartCatalogSeries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogSeries" ADD CONSTRAINT "PartCatalogSeries_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "PhoneModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogCategory" ADD CONSTRAINT "PartCatalogCategory_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "PartCatalogSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogCategory" ADD CONSTRAINT "PartCatalogCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PartCatalogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogItem" ADD CONSTRAINT "PartCatalogItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PartCatalogCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogItemCompatibility" ADD CONSTRAINT "PartCatalogItemCompatibility_partItemId_fkey" FOREIGN KEY ("partItemId") REFERENCES "PartCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogItemCompatibility" ADD CONSTRAINT "PartCatalogItemCompatibility_phoneVariantId_fkey" FOREIGN KEY ("phoneVariantId") REFERENCES "PhoneVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogSuggestion" ADD CONSTRAINT "PartCatalogSuggestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogSuggestion" ADD CONSTRAINT "PartCatalogSuggestion_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartCatalogSuggestion" ADD CONSTRAINT "PartCatalogSuggestion_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcingRequest" ADD CONSTRAINT "SourcingRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
