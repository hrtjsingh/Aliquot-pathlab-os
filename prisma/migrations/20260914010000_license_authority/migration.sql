-- Publish HQ license public key for Vercel / remote LIMS (no .license-public.pem on deploy).
CREATE TABLE "LicenseAuthority" (
    "id" TEXT NOT NULL DEFAULT 'hq',
    "publicKeyPem" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenseAuthority_pkey" PRIMARY KEY ("id")
);
