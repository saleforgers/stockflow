import { z } from "zod";
import Decimal from "decimal.js";
import type { Prisma } from "@/generated/prisma/client";
import { assertOperationalWriter, type AuthorizedUser } from "@/lib/auth/authorization";
import { salesTransaction } from "@/modules/sales/transaction";
import { invoiceDraftSchema, type InvoiceDraftCommand } from "@/modules/sales/validation";
import { createInvoiceDraftInTransaction } from "@/modules/sales/services";
import { saleLine } from "@/modules/sales/calculations";
import { nextDocumentNumber } from "@/lib/db/document-number";
import { parseCommand } from "@/lib/validation/command";
import { parseBusinessDate } from "@/lib/validation/business-date";
import { parseIdentifier } from "@/lib/validation/identifier";
import { ApplicationError } from "@/lib/errors/application-error";
import { nonnegativeMoney } from "@/modules/purchases/calculations";
import { currentBusinessDate } from "@/lib/format";
export const estimateSchema = invoiceDraftSchema.extend({
  requestKey: z.string().uuid(),
  validUntil: z.string().optional(),
});
export type EstimateCommand = z.infer<typeof estimateSchema>;
export type EstimateItem = InvoiceDraftCommand["lines"][number] & {
  productNameSnapshot: string;
  skuSnapshot: string;
  uomCodeSnapshot: string;
  netAmount: string;
};
export function estimateItems(value: Prisma.JsonValue): EstimateItem[] {
  return z
    .array(
      invoiceDraftSchema.shape.lines.element.extend({
        productNameSnapshot: z.string(),
        skuSnapshot: z.string(),
        uomCodeSnapshot: z.string(),
        netAmount: z.string(),
      }),
    )
    .parse(value);
}
export async function saveEstimate(input: EstimateCommand, actor: AuthorizedUser, id?: string) {
  assertOperationalWriter(actor);
  const c = parseCommand(estimateSchema, input);
  if (id) id = parseIdentifier(id, "Estimate");
  return salesTransaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c.requestKey},0))::text`;
    if (id) {
      await tx.$queryRaw`SELECT id FROM "Estimate" WHERE id=${id}::uuid FOR UPDATE`;
      const old = await tx.estimate.findUnique({ where: { id } });
      if (!old || old.status === "CONVERTED" || old.status === "CANCELLED")
        throw new ApplicationError("CONFLICT", "This estimate cannot be edited");
    } else {
      const replay = await tx.estimate.findUnique({ where: { requestKey: c.requestKey } });
      if (replay) {
        if (replay.customerId !== c.customerId || replay.createdById !== actor.id)
          throw new ApplicationError("CONFLICT", "Estimate request already used");
        return replay;
      }
    }
    const [customer, products] = await Promise.all([
      tx.customer.findUnique({ where: { id: c.customerId } }),
      tx.product.findMany({
        where: { id: { in: c.lines.map((l) => l.productId) } },
        include: { inventoryUnit: true },
      }),
    ]);
    if (!customer?.isActive)
      throw new ApplicationError("VALIDATION_ERROR", "Select an active customer");
    const lines = c.lines.map((l) => {
      const p = products.find((p) => p.id === l.productId);
      if (!p?.isActive || !p.inventoryUnit.isActive)
        throw new ApplicationError("VALIDATION_ERROR", "Select an active product");
      return {
        ...l,
        ...saleLine(l.quantity, l.unitPrice, l.lineDiscountAmount, p.inventoryUnit.decimalScale),
        productNameSnapshot: p.name,
        skuSnapshot: p.sku,
        uomCodeSnapshot: p.inventoryUnit.code,
      };
    });
    const subtotal = lines.reduce((s, l) => s.plus(l.netAmount), new Decimal(0));
    const discount = nonnegativeMoney(c.invoiceDiscountAmount, "Estimate discount");
    if (discount.gt(subtotal))
      throw new ApplicationError("VALIDATION_ERROR", "Discount exceeds subtotal");
    const date = parseBusinessDate(c.invoiceDate, "Estimate date"),
      validUntil = c.validUntil ? parseBusinessDate(c.validUntil, "Valid until") : null;
    if (validUntil && validUntil < date)
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Valid until cannot be before the estimate date",
      );
    const data = {
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      customerPhoneSnapshot: customer.phone,
      customerAddressSnapshot: customer.address,
      estimateDate: date,
      validUntil,
      lines: lines as Prisma.InputJsonValue,
      subtotal: subtotal.toFixed(2),
      invoiceDiscountAmount: discount.toFixed(2),
      totalAmount: subtotal.minus(discount).toFixed(2),
      notes: c.notes?.trim() || null,
    };
    return id
      ? tx.estimate.update({ where: { id }, data })
      : tx.estimate.create({
          data: {
            ...data,
            requestKey: c.requestKey,
            estimateNumber: await nextDocumentNumber(tx, "estimate"),
            createdById: actor.id,
          },
        });
  });
}
export async function convertEstimate(id: string, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  id = parseIdentifier(id, "Estimate");
  return salesTransaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Estimate" WHERE id=${id}::uuid FOR UPDATE`;
    const estimate = await tx.estimate.findUnique({ where: { id } });
    if (!estimate) throw new ApplicationError("NOT_FOUND", "Estimate not found");
    if (estimate.convertedInvoiceId) return { id: estimate.convertedInvoiceId };
    if (estimate.status === "CANCELLED")
      throw new ApplicationError("CONFLICT", "Cancelled estimates cannot be converted");
    const invoice = await createInvoiceDraftInTransaction(
      tx,
      {
        requestKey: estimate.id,
        customerId: estimate.customerId,
        invoiceDate: currentBusinessDate(),
        invoiceDiscountAmount: estimate.invoiceDiscountAmount.toFixed(2),
        notes: estimate.notes,
        lines: estimateItems(estimate.lines),
      },
      actor,
    );
    await tx.estimate.update({
      where: { id },
      data: { status: "CONVERTED", convertedInvoiceId: invoice.id },
    });
    return invoice;
  });
}
export async function setEstimateStatus(
  id: string,
  status: "SENT" | "ACCEPTED" | "CANCELLED",
  actor: AuthorizedUser,
) {
  assertOperationalWriter(actor);
  id = parseIdentifier(id, "Estimate");
  if (!["SENT", "ACCEPTED", "CANCELLED"].includes(status))
    throw new ApplicationError("VALIDATION_ERROR", "Invalid estimate status");
  return salesTransaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Estimate" WHERE id=${id}::uuid FOR UPDATE`;
    const old = await tx.estimate.findUnique({ where: { id } });
    if (!old || old.status === "CONVERTED" || old.status === "CANCELLED")
      throw new ApplicationError("CONFLICT", "This estimate cannot be changed");
    return tx.estimate.update({ where: { id }, data: { status } });
  });
}
