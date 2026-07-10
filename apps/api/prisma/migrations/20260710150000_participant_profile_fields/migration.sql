ALTER TABLE "Participant"
ADD COLUMN "snapchat" TEXT,
ADD COLUMN "instagram" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "birthDate" TIMESTAMP(3),
ADD COLUMN "origins" JSONB;
