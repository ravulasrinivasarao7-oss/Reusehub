-- Add requests without changing existing users, materials, or sessions.
CREATE TYPE "MaterialRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE "material_requests" (
    "id" SERIAL NOT NULL,
    "materialId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "material_requests_materialId_requesterId_key"
    ON "material_requests"("materialId", "requesterId");
CREATE INDEX "material_requests_requesterId_createdAt_idx"
    ON "material_requests"("requesterId", "createdAt");
CREATE INDEX "material_requests_materialId_status_idx"
    ON "material_requests"("materialId", "status");
CREATE INDEX "material_requests_materialId_createdAt_idx"
    ON "material_requests"("materialId", "createdAt");

ALTER TABLE "material_requests"
    ADD CONSTRAINT "material_requests_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "materials"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_requests"
    ADD CONSTRAINT "material_requests_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
