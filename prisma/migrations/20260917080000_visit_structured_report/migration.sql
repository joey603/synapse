-- AlterEnum
CREATE TYPE "DrivingRiskStatus" AS ENUM (
  'NOT_ASSESSED',
  'NO_RISK_IDENTIFIED',
  'POSSIBLE_RISK',
  'RISK_IDENTIFIED',
  'UNCLEAR'
);

-- AlterTable Visit
ALTER TABLE "Visit" ADD COLUMN "durationMinutes" INTEGER;

-- AlterTable ClinicalReport
ALTER TABLE "ClinicalReport" ADD COLUMN "patientStatusNote" TEXT;
ALTER TABLE "ClinicalReport" ADD COLUMN "drivingRisk" "DrivingRiskStatus" NOT NULL DEFAULT 'NOT_ASSESSED';
ALTER TABLE "ClinicalReport" ADD COLUMN "diagnosisNote" TEXT;
ALTER TABLE "ClinicalReport" ADD COLUMN "mainProblems" TEXT;
ALTER TABLE "ClinicalReport" ADD COLUMN "currentMedication" TEXT;
ALTER TABLE "ClinicalReport" ADD COLUMN "interventionsProvided" TEXT;
ALTER TABLE "ClinicalReport" ADD COLUMN "carePlan" TEXT;
