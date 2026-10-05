import Decimal from "decimal.js";
import { assertOperationalWriter, type AuthorizedUser } from "@/lib/auth/authorization";
import type { BusinessTransaction } from "@/lib/db/transaction";
import { nextDocumentNumber } from "@/lib/db/document-number";
import { decimal, validateQuantity } from "@/lib/decimal/decimal";
import { allocateInvoiceDiscount } from "@/lib/decimal/discount-allocation";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseCommand } from "@/lib/validation/command";
import { parseIdentifier } from "@/lib/validation/identifier";
import { parseBusinessDate } from "@/lib/validation/business-date";
import { normalizeOptionalText } from "@/lib/validation/normalization";
import { nonnegativeMoney, positiveMoney, paymentStatus } from "@/modules/purchases/calculations";
import { fifoPlan, returnCredit, saleLine } from "./calculations";
import { salesTransaction } from "./transaction";
import {
  invoiceDraftSchema,
  receiptSchema,
  returnSchema,
  advanceAllocationSchema,
  type InvoiceDraftCommand,
  type ReceiptCommand,
  type SaleReturnCommand,
} from "./validation";

async function prepare(tx: BusinessTransaction, input: InvoiceDraftCommand) {
  const c = parseCommand(invoiceDraftSchema, input);
  const customer = await tx.customer.findUnique({ where: { id: c.customerId } });
  if (!customer?.isActive)
    throw new ApplicationError("VALIDATION_ERROR", "Select an active customer");
  const products = await tx.product.findMany({
    where: { id: { in: c.lines.map((l) => l.productId) } },
    include: { inventoryUnit: true },
  });
  const lines = c.lines.map((l) => {
    const p = products.find((p) => p.id === l.productId);
    if (!p?.isActive || !p.inventoryUnit.isActive)
      throw new ApplicationError("VALIDATION_ERROR", "Select active products and units");
    return {
      productId: p.id,
      productNameSnapshot: p.name,
      skuSnapshot: p.sku,
      uomCodeSnapshot: p.inventoryUnit.code,
      ...saleLine(l.quantity, l.unitPrice, l.lineDiscountAmount, p.inventoryUnit.decimalScale),
      notes: normalizeOptionalText(l.notes),
    };
  });
  const subtotal = lines.reduce((s, l) => s.plus(l.netAmount), new Decimal(0));
  const discount = nonnegativeMoney(c.invoiceDiscountAmount, "Invoice discount");
  if (discount.greaterThan(subtotal))
    throw new ApplicationError("VALIDATION_ERROR", "Invoice discount exceeds subtotal");
  return {
    customerId: customer.id,
    customerNameSnapshot: customer.name,
    customerPhoneSnapshot: customer.phone,
    customerAddressSnapshot: customer.address,
    invoiceDate: parseBusinessDate(c.invoiceDate, "Invoice date"),
    subtotal: subtotal.toFixed(2),
    invoiceDiscountAmount: discount.toFixed(2),
    totalAmount: subtotal.minus(discount).toFixed(2),
    notes: normalizeOptionalText(c.notes),
    lines,
  };
}
async function lockInvoice(tx: BusinessTransaction, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "SalesInvoice" WHERE "id" = ${id}::uuid FOR UPDATE`;
}
export async function createInvoiceDraft(input: InvoiceDraftCommand, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  return salesTransaction(async (tx) => {
    const { lines, ...data } = await prepare(tx, input);
    const location = await tx.inventoryLocation.findFirst({
      where: { isActive: true, isDefault: true },
    });
    if (!location)
      throw new ApplicationError("INVARIANT_VIOLATION", "Active default location missing");
    return tx.salesInvoice.create({
      data: {
        ...data,
        locationId: location.id,
        invoiceNumber: await nextDocumentNumber(tx, "salesInvoice"),
        createdById: actor.id,
        lines: { create: lines },
      },
    });
  });
}
export async function updateInvoiceDraft(
  id: string,
  input: InvoiceDraftCommand,
  actor: AuthorizedUser,
) {
  assertOperationalWriter(actor);
  id = parseIdentifier(id, "Invoice");
  return salesTransaction(async (tx) => {
    await lockInvoice(tx, id);
    const invoice = await tx.salesInvoice.findUnique({ where: { id } });
    if (!invoice) throw new ApplicationError("NOT_FOUND", "Invoice not found");
    if (invoice.status !== "DRAFT")
      throw new ApplicationError("CONFLICT", "Only drafts can be edited");
    const { lines, ...data } = await prepare(tx, input);
    await tx.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: id } });
    return tx.salesInvoice.update({ where: { id }, data: { ...data, lines: { create: lines } } });
  });
}
async function settled(tx: BusinessTransaction, id: string) {
  const [payments, returns] = await Promise.all([
    tx.customerPaymentAllocation.aggregate({
      where: { salesInvoiceId: id, payment: { status: "POSTED" } },
      _sum: { amount: true },
    }),
    tx.saleReturn.aggregate({
      where: { salesInvoiceId: id, status: "POSTED" },
      _sum: { totalAmount: true },
    }),
  ]);
  return decimal(payments._sum.amount ?? 0).plus(decimal(returns._sum.totalAmount ?? 0));
}
async function refresh(tx: BusinessTransaction, id: string) {
  const invoice = await tx.salesInvoice.findUniqueOrThrow({ where: { id } });
  const value = await settled(tx, id);
  await tx.salesInvoice.update({
    where: { id },
    data: {
      amountReceivedCached: Decimal.min(value, decimal(invoice.totalAmount)).toFixed(2),
      paymentStatus: decimal(invoice.totalAmount).isZero()
        ? "PAID"
        : paymentStatus(invoice.totalAmount.toString(), value),
    },
  });
}
async function receipt(tx: BusinessTransaction, input: ReceiptCommand, actor: AuthorizedUser) {
  const c = parseCommand(receiptSchema, input);
  // Advisory lock also serializes retries before a request-key row exists.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c.requestKey}, 0))::text`;
  const existing = await tx.payment.findUnique({ where: { requestKey: c.requestKey } });
  if (existing) {
    if (existing.customerId !== c.customerId || existing.kind !== "CUSTOMER_RECEIPT")
      throw new ApplicationError("CONFLICT", "Receipt request key already used");
    return existing;
  }
  const amount = positiveMoney(c.amount, "Receipt amount");
  const [customer, method] = await Promise.all([
    tx.customer.findUnique({ where: { id: c.customerId } }),
    tx.paymentMethod.findUnique({ where: { id: c.paymentMethodId } }),
  ]);
  if (!customer?.isActive || !method?.isActive)
    throw new ApplicationError("VALIDATION_ERROR", "Select an active customer and payment method");
  const allocations = new Map<string, Decimal>();
  for (const a of c.allocations)
    allocations.set(
      a.salesInvoiceId,
      (allocations.get(a.salesInvoiceId) ?? new Decimal(0)).plus(
        positiveMoney(a.amount, "Allocation"),
      ),
    );
  if ([...allocations.values()].reduce((s, a) => s.plus(a), new Decimal(0)).greaterThan(amount))
    throw new ApplicationError("VALIDATION_ERROR", "Allocations exceed receipt");
  for (const id of [...allocations.keys()].sort()) {
    await lockInvoice(tx, id);
    const invoice = await tx.salesInvoice.findUnique({ where: { id } });
    if (!invoice || invoice.status !== "POSTED" || invoice.customerId !== c.customerId)
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Allocate only to posted invoices for this customer",
      );
    if (
      allocations
        .get(id)!
        .greaterThan(Decimal.max(decimal(invoice.totalAmount).minus(await settled(tx, id)), 0))
    )
      throw new ApplicationError("VALIDATION_ERROR", "Allocation exceeds invoice outstanding");
  }
  const date = parseBusinessDate(c.paymentDate, "Receipt date");
  const payment = await tx.payment.create({
    data: {
      requestKey: c.requestKey,
      paymentNumber: await nextDocumentNumber(tx, "payment"),
      kind: "CUSTOMER_RECEIPT",
      customerId: c.customerId,
      paymentMethodId: c.paymentMethodId,
      paymentDate: date,
      amount: amount.toFixed(2),
      reference: normalizeOptionalText(c.reference),
      notes: normalizeOptionalText(c.notes),
      createdById: actor.id,
      customerAllocations: {
        create: [...allocations].map(([salesInvoiceId, amount]) => ({
          salesInvoiceId,
          amount: amount.toFixed(2),
        })),
      },
    },
  });
  await tx.customerLedgerEntry.create({
    data: {
      customerId: c.customerId,
      entryDate: date,
      entryType: "PAYMENT",
      effect: "DECREASE",
      amount: amount.toFixed(2),
      paymentId: payment.id,
      reference: payment.paymentNumber,
      createdById: actor.id,
    },
  });
  const result = await tx.payment.update({
    where: { id: payment.id },
    data: { status: "POSTED", postedAt: new Date() },
  });
  for (const id of allocations.keys()) await refresh(tx, id);
  return result;
}
export async function recordCustomerReceipt(input: ReceiptCommand, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  return salesTransaction((tx) => receipt(tx, input, actor));
}
export async function postInvoice(
  id: string,
  actor: AuthorizedUser,
  payment?: { paymentType: "PAID" | "PARTIAL"; paymentMethodId: string; amount: string },
) {
  assertOperationalWriter(actor);
  id = parseIdentifier(id, "Invoice");
  return salesTransaction(async (tx) => {
    await lockInvoice(tx, id);
    const invoice = await tx.salesInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
        location: true,
        lines: {
          orderBy: { id: "asc" },
          include: { product: { include: { inventoryUnit: true } } },
        },
      },
    });
    if (!invoice) throw new ApplicationError("NOT_FOUND", "Invoice not found");
    if (invoice.status === "POSTED") return invoice;
    if (invoice.status !== "DRAFT")
      throw new ApplicationError("CONFLICT", "Invoice cannot be posted");
    if (
      !invoice.customer.isActive ||
      !invoice.location.isActive ||
      !invoice.location.isDefault ||
      !invoice.lines.length
    )
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Invoice customer, location or lines are invalid",
      );
    if (payment) {
      const paidNow = positiveMoney(payment.amount, "Receipt");
      const total = decimal(invoice.totalAmount);
      if (paidNow.greaterThan(total))
        throw new ApplicationError("VALIDATION_ERROR", "Receipt cannot exceed the invoice total");
      if (payment.paymentType === "PAID" && !paidNow.equals(total))
        throw new ApplicationError("VALIDATION_ERROR", "Paid invoices require the full amount");
      if (payment.paymentType === "PARTIAL" && !paidNow.lessThan(total))
        throw new ApplicationError(
          "VALIDATION_ERROR",
          "Partial payment must be less than the invoice total",
        );
    }
    if (
      invoice.customer.isWalkIn &&
      decimal(invoice.totalAmount).greaterThan(0) &&
      (!payment || !positiveMoney(payment.amount, "Receipt").equals(invoice.totalAmount.toString()))
    )
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Walk-in invoices must be fully paid at posting",
      );
    // Lock ALL matching layers, including depleted rows, in a stable product/id order.
    // This coordinates with purchase returns and concurrent sale returns using the same rows.
    for (const productId of [...new Set(invoice.lines.map((l) => l.productId))].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "InventoryLot" WHERE "productId" = ${productId}::uuid AND "locationId" = ${invoice.locationId}::uuid ORDER BY "id" FOR UPDATE`;
    }
    let subtotal = new Decimal(0);
    const discounts = allocateInvoiceDiscount(
      invoice.lines.map((l) => ({ id: l.id, netAmount: l.netAmount })),
      invoice.invoiceDiscountAmount,
    );
    for (const line of invoice.lines) {
      if (!line.product.isActive || !line.product.inventoryUnit.isActive)
        throw new ApplicationError("VALIDATION_ERROR", "Inactive product or unit");
      const calculated = saleLine(
        line.quantity.toString(),
        line.unitPrice.toString(),
        line.lineDiscountAmount.toString(),
        line.product.inventoryUnit.decimalScale,
      );
      if (
        !decimal(calculated.grossAmount).equals(line.grossAmount.toString()) ||
        !decimal(calculated.netAmount).equals(line.netAmount.toString())
      )
        throw new ApplicationError("INVARIANT_VIOLATION", "Line amounts do not reconcile");
      subtotal = subtotal.plus(calculated.netAmount);
      await tx.salesInvoiceLine.update({
        where: { id: line.id },
        data: {
          invoiceDiscountAllocated: discounts.get(line.id)!.toFixed(2),
          productNameSnapshot: line.product.name,
          skuSnapshot: line.product.sku,
          uomCodeSnapshot: line.product.inventoryUnit.code,
        },
      });
      const lots = await tx.inventoryLot.findMany({
        where: {
          productId: line.productId,
          locationId: invoice.locationId,
          status: "OPEN",
          availableQuantity: { gt: 0 },
        },
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      });
      for (const item of fifoPlan(lots, line.quantity)) {
        const allocation = await tx.saleLotAllocation.create({
          data: {
            salesInvoiceLineId: line.id,
            inventoryLotId: item.lot.id,
            quantity: item.quantity.toFixed(),
            unitCostSnapshot: item.lot.unitCost,
          },
        });
        const remaining = decimal(item.lot.availableQuantity).minus(item.quantity);
        await tx.inventoryLot.update({
          where: { id: item.lot.id },
          data: {
            availableQuantity: remaining.toFixed(),
            status: remaining.isZero() ? "DEPLETED" : "OPEN",
            closedAt: remaining.isZero() ? new Date() : null,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            locationId: invoice.locationId,
            inventoryLotId: item.lot.id,
            direction: "OUT",
            movementType: "SALE",
            quantity: item.quantity.toFixed(),
            unitCostSnapshot: item.lot.unitCost,
            saleLotAllocationId: allocation.id,
            occurredAt: new Date(),
            createdById: actor.id,
          },
        });
      }
    }
    if (
      !subtotal.equals(invoice.subtotal.toString()) ||
      !subtotal
        .minus(invoice.invoiceDiscountAmount.toString())
        .equals(invoice.totalAmount.toString())
    )
      throw new ApplicationError("INVARIANT_VIOLATION", "Invoice totals do not reconcile");
    await tx.customerLedgerEntry.create({
      data: {
        customerId: invoice.customerId,
        entryDate: invoice.invoiceDate,
        entryType: "SALE",
        effect: "INCREASE",
        amount: invoice.totalAmount,
        salesInvoiceId: id,
        reference: invoice.invoiceNumber,
        createdById: actor.id,
      },
    });
    await tx.salesInvoice.update({
      where: { id },
      data: {
        status: "POSTED",
        paymentStatus: decimal(invoice.totalAmount).isZero() ? "PAID" : "UNPAID",
        postedAt: new Date(),
        customerNameSnapshot: invoice.customer.name,
        customerPhoneSnapshot: invoice.customer.phone,
        customerAddressSnapshot: invoice.customer.address,
      },
    });
    if (payment)
      await receipt(
        tx,
        {
          requestKey: id,
          customerId: invoice.customerId,
          paymentMethodId: payment.paymentMethodId,
          paymentDate: invoice.invoiceDate.toISOString().slice(0, 10),
          amount: payment.amount,
          allocations: decimal(invoice.totalAmount).isZero()
            ? []
            : [
                {
                  salesInvoiceId: id,
                  amount: Decimal.min(
                    positiveMoney(payment.amount, "Receipt"),
                    decimal(invoice.totalAmount),
                  ).toFixed(2),
                },
              ],
        },
        actor,
      );
    return tx.salesInvoice.findUniqueOrThrow({ where: { id } });
  });
}

export async function allocateCustomerAdvance(
  input: { requestKey: string; paymentId: string; salesInvoiceId: string; amount: string },
  actor: AuthorizedUser,
) {
  assertOperationalWriter(actor);
  const c = parseCommand(advanceAllocationSchema, input);
  return salesTransaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c.requestKey},0))::text`;
    const replay = await tx.customerPaymentAllocation.findUnique({
      where: { requestKey: c.requestKey },
    });
    if (replay) {
      if (
        replay.paymentId !== c.paymentId ||
        replay.salesInvoiceId !== c.salesInvoiceId ||
        !decimal(replay.amount).equals(c.amount)
      )
        throw new ApplicationError("CONFLICT", "Allocation request key already used");
      return replay;
    }
    // Invoice before payment is the common lock order used by posting/receipts.
    await lockInvoice(tx, c.salesInvoiceId);
    await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${c.paymentId}::uuid FOR UPDATE`;
    const payment = await tx.payment.findUnique({
      where: { id: c.paymentId },
      include: { customerAllocations: true },
    });
    const invoice = await tx.salesInvoice.findUnique({ where: { id: c.salesInvoiceId } });
    if (
      !payment ||
      payment.status !== "POSTED" ||
      payment.kind !== "CUSTOMER_RECEIPT" ||
      !invoice ||
      invoice.status !== "POSTED" ||
      invoice.customerId !== payment.customerId
    )
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Receipt and invoice must belong to the same customer",
      );
    const amount = positiveMoney(c.amount, "Allocation");
    const used = payment.customerAllocations.reduce(
      (s, a) => s.plus(a.amount.toString()),
      new Decimal(0),
    );
    if (
      amount.greaterThan(decimal(payment.amount).minus(used)) ||
      amount.greaterThan(
        Decimal.max(decimal(invoice.totalAmount).minus(await settled(tx, invoice.id)), 0),
      )
    )
      throw new ApplicationError(
        "VALIDATION_ERROR",
        "Allocation exceeds receipt availability or invoice outstanding",
      );
    const result = await tx.customerPaymentAllocation.create({
      data: {
        requestKey: c.requestKey,
        paymentId: payment.id,
        salesInvoiceId: invoice.id,
        amount: amount.toFixed(2),
      },
    });
    await refresh(tx, invoice.id);
    return result;
  });
}

export async function postSaleReturn(input: SaleReturnCommand, actor: AuthorizedUser) {
  assertOperationalWriter(actor);
  const c = parseCommand(returnSchema, input);
  return salesTransaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c.requestKey},0))::text`;
    const existing = await tx.saleReturn.findUnique({ where: { requestKey: c.requestKey } });
    if (existing) {
      if (existing.salesInvoiceId !== c.salesInvoiceId)
        throw new ApplicationError("CONFLICT", "Return request key already used");
      return existing;
    }
    await lockInvoice(tx, c.salesInvoiceId);
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: c.salesInvoiceId },
      include: {
        lines: {
          include: {
            product: { include: { inventoryUnit: true } },
            lotAllocations: {
              include: {
                inventoryLot: true,
                returnAllocations: {
                  where: { saleReturnLine: { saleReturn: { status: "POSTED" } } },
                },
              },
            },
            returnLines: { where: { saleReturn: { status: "POSTED" } } },
          },
        },
      },
    });
    if (!invoice || invoice.status !== "POSTED")
      throw new ApplicationError("VALIDATION_ERROR", "Select a posted invoice");
    if (new Set(c.lines.map((l) => l.salesInvoiceLineId)).size !== c.lines.length)
      throw new ApplicationError("VALIDATION_ERROR", "Return lines must be unique");
    const prepared = c.lines.map((l) => {
      const line = invoice.lines.find((i) => i.id === l.salesInvoiceLineId);
      if (!line)
        throw new ApplicationError("VALIDATION_ERROR", "Return line does not belong to invoice");
      const quantity = validateQuantity(l.quantity, line.product.inventoryUnit.decimalScale);
      const priorQuantity = line.returnLines.reduce(
        (s, r) => s.plus(r.quantity.toString()),
        new Decimal(0),
      );
      const priorCredit = line.returnLines.reduce(
        (s, r) => s.plus(r.lineTotal.toString()),
        new Decimal(0),
      );
      const total = returnCredit(
        decimal(line.netAmount).minus(line.invoiceDiscountAllocated.toString()),
        line.quantity,
        priorQuantity,
        quantity,
        priorCredit,
      );
      const allocations = [...line.lotAllocations].sort(
        (a, b) =>
          a.inventoryLot.receivedAt.getTime() - b.inventoryLot.receivedAt.getTime() ||
          a.inventoryLotId.localeCompare(b.inventoryLotId),
      );
      const plan = fifoPlan(
        allocations.map((a) => ({
          ...a,
          availableQuantity: decimal(a.quantity).minus(
            a.returnAllocations.reduce((s, r) => s.plus(r.quantity.toString()), new Decimal(0)),
          ),
          unitCost: a.unitCostSnapshot,
        })),
        quantity,
      );
      return { line, quantity, total, plan };
    });
    const lotIds = [
      ...new Set(prepared.flatMap((p) => p.plan.map((a) => a.lot.inventoryLotId))),
    ].sort();
    for (const id of lotIds)
      await tx.$queryRaw`SELECT "id" FROM "InventoryLot" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const total = prepared.reduce((s, p) => s.plus(p.total), new Decimal(0));
    const date = parseBusinessDate(c.returnDate, "Return date");
    const returned = await tx.saleReturn.create({
      data: {
        requestKey: c.requestKey,
        returnNumber: await nextDocumentNumber(tx, "saleReturn"),
        salesInvoiceId: invoice.id,
        locationId: invoice.locationId,
        customerNameSnapshot: invoice.customerNameSnapshot,
        returnDate: date,
        totalAmount: total.toFixed(2),
        reason: c.reason,
        notes: normalizeOptionalText(c.notes),
        createdById: actor.id,
      },
    });
    for (const p of prepared) {
      const line = await tx.saleReturnLine.create({
        data: {
          saleReturnId: returned.id,
          salesInvoiceLineId: p.line.id,
          productId: p.line.productId,
          quantity: p.quantity.toFixed(),
          unitPriceSnapshot: p.line.unitPrice,
          lineTotal: p.total.toFixed(2),
        },
      });
      for (const item of p.plan) {
        const allocation = await tx.saleReturnAllocation.create({
          data: {
            saleReturnLineId: line.id,
            saleLotAllocationId: item.lot.id,
            inventoryLotId: item.lot.inventoryLotId,
            quantity: item.quantity.toFixed(),
            unitCostSnapshot: item.lot.unitCostSnapshot,
          },
        });
        await tx.inventoryLot.update({
          where: { id: item.lot.inventoryLotId },
          data: {
            availableQuantity: { increment: item.quantity.toFixed() },
            status: "OPEN",
            closedAt: null,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: p.line.productId,
            locationId: invoice.locationId,
            inventoryLotId: item.lot.inventoryLotId,
            direction: "IN",
            movementType: "SALE_RETURN",
            quantity: item.quantity.toFixed(),
            unitCostSnapshot: item.lot.unitCostSnapshot,
            saleReturnAllocationId: allocation.id,
            occurredAt: new Date(),
            reason: c.reason,
            createdById: actor.id,
          },
        });
      }
    }
    await tx.customerLedgerEntry.create({
      data: {
        customerId: invoice.customerId,
        entryDate: date,
        entryType: "SALE_RETURN",
        effect: "DECREASE",
        amount: total.toFixed(2),
        saleReturnId: returned.id,
        reference: returned.returnNumber,
        reason: c.reason,
        createdById: actor.id,
      },
    });
    const result = await tx.saleReturn.update({
      where: { id: returned.id },
      data: { status: "POSTED", postedAt: new Date() },
    });
    await refresh(tx, invoice.id);
    return result;
  });
}
