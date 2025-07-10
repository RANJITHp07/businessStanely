-- CreateTable
CREATE TABLE "Client" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientType" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "secondaryPhoneNumber" TEXT,
    "address" TEXT,
    "preferredCommunication" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "gender" TEXT,
    "dateOfBirth" DATETIME,
    "idProofType" TEXT,
    "idProofNumber" TEXT,
    "organizationName" TEXT,
    "registrationNumber" TEXT,
    "entityType" TEXT,
    "incorporationDate" DATETIME,
    "gstNumber" TEXT,
    "authorizedPersonName" TEXT,
    "designation" TEXT,
    "contactEmail" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");
