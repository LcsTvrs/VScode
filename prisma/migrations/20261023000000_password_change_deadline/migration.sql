ALTER TABLE "User" ADD COLUMN "passwordChangeDeadline" TIMESTAMP(3);

-- Existing pending accounts receive the grace period when this migration runs.
UPDATE "User"
SET "passwordChangeDeadline" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '48 hours'
WHERE "mustChangePassword" = true;
