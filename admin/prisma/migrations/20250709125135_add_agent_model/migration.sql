-- CreateTable
CREATE TABLE "Agent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "secondaryPhoneNumber" TEXT,
    "agentType" TEXT NOT NULL,
    "barAssociationId" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "specializations" TEXT NOT NULL,
    "photo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "superiorId" INTEGER,
    CONSTRAINT "Agent_superiorId_fkey" FOREIGN KEY ("superiorId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");
