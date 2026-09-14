ALTER TYPE "PatientStatus" ADD VALUE IF NOT EXISTS 'DISCHARGED';

CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'WAITING', 'DONE');
CREATE TYPE "TaskPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');
CREATE TYPE "ClinicalEventKind" AS ENUM ('TREATMENT', 'CLINICAL', 'HOSPITALIZATION', 'EXAM', 'CONTACT', 'OTHER');

CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "visitId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
  "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "dueDate" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalEvent" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "visitId" TEXT,
  "kind" "ClinicalEventKind" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicalEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_patientId_status_dueDate_idx" ON "Task"("patientId", "status", "dueDate");
CREATE INDEX "ClinicalEvent_patientId_occurredAt_idx" ON "ClinicalEvent"("patientId", "occurredAt");

ALTER TABLE "Task" ADD CONSTRAINT "Task_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalEvent" ADD CONSTRAINT "ClinicalEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicalEvent" ADD CONSTRAINT "ClinicalEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
