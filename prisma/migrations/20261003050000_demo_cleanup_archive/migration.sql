-- A private, append-only backup for owner-authorized automated fixture cleanup.
-- Ordinary posted business records remain protected by their existing triggers.
CREATE TABLE "DemoCleanupArchive" (
  "id" uuid PRIMARY KEY,
  "createdById" uuid NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "recordCount" integer NOT NULL CHECK ("recordCount" > 0 AND "recordCount" <= 10000),
  "backup" jsonb NOT NULL CHECK (jsonb_typeof("backup")='object')
);
ALTER TABLE "DemoCleanupArchive" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "DemoCleanupArchive" FROM PUBLIC, anon, authenticated;
CREATE FUNCTION stockflow_protect_cleanup_archive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Demo cleanup backups are permanent audit records'; END;
$$;
CREATE TRIGGER "DemoCleanupArchive_immutable" BEFORE UPDATE OR DELETE ON "DemoCleanupArchive"
FOR EACH ROW EXECUTE FUNCTION stockflow_protect_cleanup_archive();
