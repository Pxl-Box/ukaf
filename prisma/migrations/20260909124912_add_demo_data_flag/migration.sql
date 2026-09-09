-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "isDemoData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "testimonials" ADD COLUMN     "isDemoData" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "trucks" ADD COLUMN     "isDemoData" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "leads_isDemoData_idx" ON "leads"("isDemoData");

-- CreateIndex
CREATE INDEX "trucks_isDemoData_idx" ON "trucks"("isDemoData");
