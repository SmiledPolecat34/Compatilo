ALTER TABLE "Admin" ALTER COLUMN "twoFactorMethod" SET DEFAULT 'TOTP';

UPDATE "Admin"
SET "twoFactorMethod" = 'TOTP',
    "otpCodeHash" = NULL,
    "otpExpiresAt" = NULL,
    "otpAttempts" = 0,
    "otpLockedUntil" = NULL;

DELETE FROM "TrustedDevice";
