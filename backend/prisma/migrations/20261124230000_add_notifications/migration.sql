CREATE TYPE "NotificationType" AS ENUM (
    'NEW_MATERIAL_REQUEST',
    'REQUEST_ACCEPTED',
    'REQUEST_REJECTED',
    'REQUEST_CANCELLED',
    'MATERIAL_UNAVAILABLE'
);

CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "materialId" INTEGER,
    "requestId" INTEGER,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_recipientId_requestId_type_key"
    ON "notifications"("recipientId", "requestId", "type");
CREATE INDEX "notifications_recipientId_isRead_createdAt_idx"
    ON "notifications"("recipientId", "isRead", "createdAt");
CREATE INDEX "notifications_materialId_idx"
    ON "notifications"("materialId");
CREATE INDEX "notifications_requestId_idx"
    ON "notifications"("requestId");

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "materials"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "material_requests"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
