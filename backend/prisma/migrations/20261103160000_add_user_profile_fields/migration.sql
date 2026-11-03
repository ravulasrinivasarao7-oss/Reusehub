-- Add optional profile details without changing existing user records.
ALTER TABLE "users"
    ADD COLUMN "phone" VARCHAR(30),
    ADD COLUMN "location" VARCHAR(120),
    ADD COLUMN "avatarUrl" VARCHAR(500);
