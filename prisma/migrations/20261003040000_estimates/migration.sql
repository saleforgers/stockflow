CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT','SENT','ACCEPTED','CONVERTED','CANCELLED');
CREATE SEQUENCE "Estimate_internal_number_seq" AS bigint START WITH 1 INCREMENT BY 1;
CREATE TABLE "Estimate" (
  "id" uuid PRIMARY KEY,
  "requestKey" uuid NOT NULL UNIQUE,
  "estimateNumber" text NOT NULL UNIQUE CHECK ("estimateNumber" ~ '^EST-[0-9]{6,}$'),
  "customerId" uuid NOT NULL REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "customerNameSnapshot" text NOT NULL,
  "customerPhoneSnapshot" text,
  "customerAddressSnapshot" text,
  "estimateDate" date NOT NULL,
  "validUntil" date,
  "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
  "lines" jsonb NOT NULL CHECK (jsonb_typeof("lines") = 'array' AND jsonb_array_length("lines") BETWEEN 1 AND 200),
  "subtotal" numeric(18,2) NOT NULL,
  "invoiceDiscountAmount" numeric(18,2) NOT NULL DEFAULT 0,
  "totalAmount" numeric(18,2) NOT NULL,
  "notes" text,
  "convertedInvoiceId" uuid UNIQUE REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdById" uuid NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL,
  CONSTRAINT "Estimate_amounts_valid" CHECK ("subtotal">=0 AND "invoiceDiscountAmount">=0 AND "invoiceDiscountAmount"<="subtotal" AND "totalAmount"="subtotal"-"invoiceDiscountAmount"),
  CONSTRAINT "Estimate_dates_valid" CHECK ("validUntil" IS NULL OR "validUntil">="estimateDate"),
  CONSTRAINT "Estimate_conversion_valid" CHECK (("status"='CONVERTED')=("convertedInvoiceId" IS NOT NULL))
);
CREATE INDEX "Estimate_status_estimateDate_idx" ON "Estimate"("status","estimateDate");
CREATE INDEX "Estimate_customerId_estimateDate_idx" ON "Estimate"("customerId","estimateDate");
ALTER TABLE "Estimate" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Estimate" FROM anon, authenticated;
CREATE FUNCTION stockflow_protect_converted_estimate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IN ('CONVERTED','CANCELLED') THEN RAISE EXCEPTION 'Converted or cancelled estimates are immutable'; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Cancel estimates instead of deleting history'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "Estimate_converted_immutable" BEFORE UPDATE OR DELETE ON "Estimate"
FOR EACH ROW EXECUTE FUNCTION stockflow_protect_converted_estimate();
REVOKE ALL ON FUNCTION stockflow_protect_converted_estimate() FROM PUBLIC;
