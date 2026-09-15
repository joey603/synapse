-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "accessInstructions" TEXT;
ALTER TABLE "Patient" ADD COLUMN "weeklyInPersonVisits" INTEGER;
ALTER TABLE "Patient" ADD COLUMN "weeklyVirtualVisits" INTEGER;
ALTER TABLE "Patient" ADD COLUMN "plannedDischargeDate" DATE;
ALTER TABLE "Patient" ADD COLUMN "operationalNote" TEXT;
