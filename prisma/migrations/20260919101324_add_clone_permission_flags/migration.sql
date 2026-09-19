-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN     "clonesMayRepublish" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isClonable" BOOLEAN NOT NULL DEFAULT false;
