-- CreateEnum
CREATE TYPE "InternalRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "VisibilityScope" AS ENUM ('ALL', 'SPECIFIED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'AWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InviteMailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_CONTRACT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PENDING_SUBMISSION', 'SUBMITTED', 'RETURNED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AcceptanceStatus" AS ENUM ('UPLOADED', 'SIGNED');

-- CreateEnum
CREATE TYPE "AttachmentScope" AS ENUM ('TEMP', 'PROJECT', 'INQUIRY', 'QUOTE', 'CONTRACT', 'ORDER', 'INVOICE', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('GENERAL', 'QUOTE_FILE', 'CONTRACT_FILE', 'ACCEPTANCE_FILE', 'SIGNED_ACCEPTANCE', 'INVOICE_FILE', 'PAYMENT_REQUEST');

-- CreateEnum
CREATE TYPE "UploaderType" AS ENUM ('INTERNAL', 'SUPPLIER');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('INTERNAL', 'SUPPLIER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "internal_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT NOT NULL,
    "displayUsername" TEXT,
    "role" "InternalRole" NOT NULL DEFAULT 'MEMBER',
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT NOT NULL,
    "displayUsername" TEXT,
    "supplierId" TEXT NOT NULL,
    "phone" TEXT,
    "title" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "category" TEXT,
    "address" TEXT,
    "website" TEXT,
    "taxId" TEXT,
    "remark" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibilityScope" "VisibilityScope" NOT NULL DEFAULT 'ALL',
    "ratingAvg" DECIMAL(3,1) NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_visibility_user" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_visibility_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_rating" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "ratedByUserId" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "quoteQuality" INTEGER NOT NULL,
    "responseSpeed" INTEGER NOT NULL,
    "serviceAttitude" INTEGER NOT NULL,
    "score" DECIMAL(3,1) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT,
    "description" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'DRAFT',
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "awardedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_supplier" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "mailStatus" "InviteMailStatus" NOT NULL DEFAULT 'PENDING',
    "mailError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "unitPrice" DECIMAL(16,2) NOT NULL,
    "totalPrice" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "deliveryDays" INTEGER,
    "validUntil" DATE,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_CONTRACT',
    "createdByUserId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PENDING_SUBMISSION',
    "supplierNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_file" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "note" TEXT,
    "uploadedByType" "UploaderType" NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acceptance_certificate" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "AcceptanceStatus" NOT NULL,
    "supplierFileId" TEXT NOT NULL,
    "signedFileId" TEXT,
    "uploadedBySupplierUserId" TEXT NOT NULL,
    "signedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acceptance_certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "note" TEXT,
    "submittedBySupplierUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL,
    "scope" "AttachmentScope" NOT NULL DEFAULT 'TEMP',
    "scopeId" TEXT,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'GENERAL',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedByType" "UploaderType" NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "summary" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_log" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "toEmails" TEXT NOT NULL,
    "ccEmails" TEXT,
    "subject" TEXT NOT NULL,
    "status" "MailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "mail_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_user_email_key" ON "internal_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "internal_user_username_key" ON "internal_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "internal_session_token_key" ON "internal_session"("token");

-- CreateIndex
CREATE INDEX "internal_session_userId_idx" ON "internal_session"("userId");

-- CreateIndex
CREATE INDEX "internal_account_userId_idx" ON "internal_account"("userId");

-- CreateIndex
CREATE INDEX "internal_verification_identifier_idx" ON "internal_verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_user_email_key" ON "supplier_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_user_username_key" ON "supplier_user"("username");

-- CreateIndex
CREATE INDEX "supplier_user_supplierId_idx" ON "supplier_user"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_session_token_key" ON "supplier_session"("token");

-- CreateIndex
CREATE INDEX "supplier_session_userId_idx" ON "supplier_session"("userId");

-- CreateIndex
CREATE INDEX "supplier_account_userId_idx" ON "supplier_account"("userId");

-- CreateIndex
CREATE INDEX "supplier_verification_identifier_idx" ON "supplier_verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_code_key" ON "supplier"("code");

-- CreateIndex
CREATE INDEX "supplier_name_idx" ON "supplier"("name");

-- CreateIndex
CREATE INDEX "supplier_status_visibilityScope_idx" ON "supplier"("status", "visibilityScope");

-- CreateIndex
CREATE INDEX "supplier_visibility_user_userId_idx" ON "supplier_visibility_user"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_visibility_user_supplierId_userId_key" ON "supplier_visibility_user"("supplierId", "userId");

-- CreateIndex
CREATE INDEX "supplier_rating_supplierId_idx" ON "supplier_rating"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_rating_supplierId_ratedByUserId_inquiryId_key" ON "supplier_rating"("supplierId", "ratedByUserId", "inquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "project_code_key" ON "project"("code");

-- CreateIndex
CREATE INDEX "project_status_createdAt_idx" ON "project"("status", "createdAt");

-- CreateIndex
CREATE INDEX "project_createdByUserId_idx" ON "project"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_code_key" ON "inquiry"("code");

-- CreateIndex
CREATE INDEX "inquiry_projectId_status_idx" ON "inquiry"("projectId", "status");

-- CreateIndex
CREATE INDEX "inquiry_status_deadline_idx" ON "inquiry"("status", "deadline");

-- CreateIndex
CREATE INDEX "inquiry_supplier_supplierId_idx" ON "inquiry_supplier"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_supplier_inquiryId_supplierId_key" ON "inquiry_supplier"("inquiryId", "supplierId");

-- CreateIndex
CREATE INDEX "quote_supplierId_idx" ON "quote"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "quote_inquiryId_supplierId_key" ON "quote"("inquiryId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "order_orderNo_key" ON "order"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "order_inquiryId_key" ON "order"("inquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "order_quoteId_key" ON "order"("quoteId");

-- CreateIndex
CREATE INDEX "order_supplierId_status_idx" ON "order"("supplierId", "status");

-- CreateIndex
CREATE INDEX "order_projectId_idx" ON "order"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_orderId_key" ON "contract"("orderId");

-- CreateIndex
CREATE INDEX "contract_file_contractId_createdAt_idx" ON "contract_file"("contractId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "acceptance_certificate_orderId_key" ON "acceptance_certificate"("orderId");

-- CreateIndex
CREATE INDEX "invoice_orderId_createdAt_idx" ON "invoice"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "invoice_supplierId_idx" ON "invoice"("supplierId");

-- CreateIndex
CREATE INDEX "attachment_scope_scopeId_idx" ON "attachment"("scope", "scopeId");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "audit_log_actorType_actorId_idx" ON "audit_log"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "mail_log_status_createdAt_idx" ON "mail_log"("status", "createdAt");

-- CreateIndex
CREATE INDEX "mail_log_relatedType_relatedId_idx" ON "mail_log"("relatedType", "relatedId");
