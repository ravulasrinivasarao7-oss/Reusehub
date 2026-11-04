-- Keep request history while preventing more than one active request per user/material.
DROP INDEX IF EXISTS "material_requests_materialId_requesterId_key";

CREATE UNIQUE INDEX "material_requests_one_pending_per_requester_key"
    ON "material_requests"("materialId", "requesterId")
    WHERE "status" = 'PENDING';
