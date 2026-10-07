"use client";

import Decimal from "decimal.js";
import {
  DocumentHeading,
  DocumentTotals,
  InvoiceGridHeading,
} from "@/components/ui/document-layout";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { PartySelector } from "@/components/party-selector";
import { ProductSelector } from "@/components/product-selector";
import { QuickPartyDialog } from "@/components/quick-party-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";
import type { PartyOption, QuickPartyAction } from "@/lib/parties/quick-create";
import { appendParty, withSelectedParty } from "@/lib/parties/selection";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  defaultPurchasePrice: string;
  defaultSellingPrice: string;
  currentStock: string;
  inventoryUnit: { code: string; decimalScale: number };
};
type LotState = {
  key: string;
  id?: string;
  supplierLotReference: string;
  receivedAt: string;
  notes: string;
  lines: Array<{
    key: string;
    productId: string;
    quantity: string;
    unitCost: string;
    lineDiscountAmount: string;
    notes: string;
  }>;
};
export type PurchaseFormValue = {
  supplierId: string;
  purchaseDate: string;
  supplierInvoiceRef: string;
  additionalCharges: string;
  notes: string;
  lots: LotState[];
};

const key = () => crypto.randomUUID();
const blankLine = (stableKey = key()) => ({
  key: stableKey,
  productId: "",
  quantity: "",
  unitCost: "",
  lineDiscountAmount: "0",
  notes: "",
});
const blankLot = (receivedAt: string, stableKey = key()): LotState => ({
  key: stableKey,
  supplierLotReference: "",
  receivedAt,
  notes: "",
  lines: [blankLine(`${stableKey}-line-0`)],
});

function safeAmount(quantity: string, unitCost: string) {
  try {
    return new Decimal(quantity || 0)
      .times(unitCost || 0)
      .toDecimalPlaces(2)
      .toFixed(2);
  } catch {
    return "0.00";
  }
}
function safeNetAmount(quantity: string, unitCost: string, discount: string) {
  try {
    return Decimal.max(new Decimal(safeAmount(quantity, unitCost)).minus(discount || 0), 0)
      .toDecimalPlaces(2)
      .toFixed(2);
  } catch {
    return "0.00";
  }
}

export function PurchaseForm({
  action,
  suppliers,
  products,
  initial,
  defaultDate,
  defaultReceivedAt,
  quickCreateAction,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  suppliers: PartyOption[];
  products: ProductOption[];
  initial?: PurchaseFormValue;
  defaultDate: string;
  defaultReceivedAt: string;
  quickCreateAction?: QuickPartyAction;
}) {
  const [result, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const [value, setValue] = useState<PurchaseFormValue>(
    initial ?? {
      supplierId: "",
      purchaseDate: defaultDate,
      supplierInvoiceRef: "",
      additionalCharges: "0",
      notes: "",
      lots: [blankLot(defaultReceivedAt, "initial-lot-0")],
    },
  );
  const [supplierOptions, setSupplierOptions] = useState(suppliers);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.currentStock,
        inventoryUnit: product.inventoryUnit,
      })),
    [products],
  );
  const supplier = supplierOptions.find((item) => item.id === value.supplierId);
  const grossSubtotal = value.lots
    .flatMap((lot) => lot.lines)
    .reduce((sum, line) => sum.plus(safeAmount(line.quantity, line.unitCost)), new Decimal(0));
  const discountTotal = value.lots
    .flatMap((lot) => lot.lines)
    .reduce((sum, line) => {
      try {
        return sum.plus(line.lineDiscountAmount || 0);
      } catch {
        return sum;
      }
    }, new Decimal(0));
  const subtotal = value.lots
    .flatMap((lot) => lot.lines)
    .reduce(
      (sum, line) => sum.plus(safeNetAmount(line.quantity, line.unitCost, line.lineDiscountAmount)),
      new Decimal(0),
    );
  let total = subtotal;
  try {
    total = subtotal.plus(value.additionalCharges || 0);
  } catch {
    /* server validates */
  }
  const payload = {
    ...value,
    lots: value.lots.map((lot) => ({
      ...(lot.id ? { id: lot.id } : {}),
      supplierLotReference: lot.supplierLotReference,
      receivedAt: `${lot.receivedAt}:00+05:00`,
      notes: lot.notes,
      lines: lot.lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        lineDiscountAmount: line.lineDiscountAmount,
        notes: line.notes,
      })),
    })),
  };

  const updateLot = (lotIndex: number, change: Partial<LotState>) =>
    setValue((current) => ({
      ...current,
      lots: current.lots.map((lot, index) => (index === lotIndex ? { ...lot, ...change } : lot)),
    }));
  const updateLine = (
    lotIndex: number,
    lineIndex: number,
    change: Partial<LotState["lines"][number]>,
  ) =>
    setValue((current) => ({
      ...current,
      lots: current.lots.map((lot, index) =>
        index === lotIndex
          ? {
              ...lot,
              lines: lot.lines.map((line, index2) =>
                index2 === lineIndex ? { ...line, ...change } : line,
              ),
            }
          : lot,
      ),
    }));

  return (
    <>
      <form
        action={formAction}
        onReset={(event) => event.preventDefault()}
        className="invoice-document space-y-5"
      >
        <input name="payload" type="hidden" value={JSON.stringify(payload)} />
        <FormMessage result={result} />
        <section className="card">
          <DocumentHeading
            title="Purchase invoice"
            description="Supplier details and receiving lots"
            aside={<span className="status-badge status-inactive">Draft entry</span>}
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <FormField htmlFor="supplier" label="Supplier" required>
              <PartySelector
                addLabel="Add New Supplier"
                allLabel="All Suppliers"
                id="supplier"
                parties={supplierOptions}
                placeholder="Select Supplier"
                recentLabel="Recent Suppliers"
                value={value.supplierId}
                onAddNew={quickCreateAction ? () => setShowSupplierDialog(true) : undefined}
                onChange={(id) =>
                  setValue((current) => withSelectedParty(current, "supplierId", id))
                }
              />
            </FormField>
            <FormField htmlFor="purchaseDate" label="Purchase / bill date" required>
              <input
                className="input"
                id="purchaseDate"
                type="date"
                value={value.purchaseDate}
                onChange={(event) => setValue({ ...value, purchaseDate: event.target.value })}
                required
              />
            </FormField>
            <FormField htmlFor="supplierInvoiceRef" label="Supplier reference">
              <input
                className="input"
                id="supplierInvoiceRef"
                maxLength={160}
                value={value.supplierInvoiceRef}
                onChange={(event) => setValue({ ...value, supplierInvoiceRef: event.target.value })}
              />
            </FormField>
            <FormField
              htmlFor="additionalCharges"
              label="Additional charges (PKR)"
              hint="Recorded on the bill; not allocated into inventory cost."
            >
              <input
                className="input"
                id="additionalCharges"
                inputMode="decimal"
                value={value.additionalCharges}
                onChange={(event) => setValue({ ...value, additionalCharges: event.target.value })}
              />
            </FormField>
            <FormField htmlFor="notes" label="Notes">
              <textarea
                className="input min-h-20"
                id="notes"
                value={value.notes}
                onChange={(event) => setValue({ ...value, notes: event.target.value })}
              />
            </FormField>
          </div>
        </section>
        {supplier ? (
          <section className="card grid gap-4 p-5 text-sm sm:grid-cols-3">
            <div>
              <span className="text-slate-500">Phone</span>
              <div className="font-medium">{supplier.phone || "—"}</div>
            </div>
            <div>
              <span className="text-slate-500">Current supplier payable</span>
              <div className="font-medium">PKR {supplier.accountBalance}</div>
            </div>
            <div className="self-end">
              <Link
                className="btn-secondary"
                href={`/suppliers/${supplier.id}/account`}
                target="_blank"
              >
                View supplier ledger
              </Link>
            </div>
          </section>
        ) : null}

        {value.lots.map((lot, lotIndex) => (
          <section className="card overflow-visible" key={lot.key}>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 bg-slate-50 p-4">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <FormField
                  htmlFor={`lot-ref-${lot.key}`}
                  label={`Lot ${lotIndex + 1} supplier reference`}
                >
                  <input
                    className="input"
                    id={`lot-ref-${lot.key}`}
                    value={lot.supplierLotReference}
                    onChange={(event) =>
                      updateLot(lotIndex, { supplierLotReference: event.target.value })
                    }
                  />
                </FormField>
                <FormField htmlFor={`lot-date-${lot.key}`} label="Received date and time" required>
                  <input
                    className="input"
                    id={`lot-date-${lot.key}`}
                    type="datetime-local"
                    value={lot.receivedAt}
                    onChange={(event) => updateLot(lotIndex, { receivedAt: event.target.value })}
                    required
                  />
                </FormField>
              </div>
              <button
                className="btn-danger"
                disabled={value.lots.length === 1}
                type="button"
                onClick={() =>
                  setValue({ ...value, lots: value.lots.filter((_, index) => index !== lotIndex) })
                }
              >
                Remove lot
              </button>
            </div>
            <details className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
              <summary className="cursor-pointer text-indigo-700">
                Lot notes{lot.notes ? " · added" : ""}
              </summary>
              <div className="mt-2">
                <FormField htmlFor={`lot-notes-${lot.key}`} label="Lot notes">
                  <input
                    className="input"
                    id={`lot-notes-${lot.key}`}
                    value={lot.notes}
                    onChange={(event) => updateLot(lotIndex, { notes: event.target.value })}
                  />
                </FormField>
              </div>
            </details>
            <div>
              <InvoiceGridHeading priceLabel="Purchase price (PKR)" />
              {lot.lines.map((line, lineIndex) => {
                const product = productById.get(line.productId);
                return (
                  <div className="invoice-entry-row" key={line.key}>
                    <div className="text-xs font-semibold text-slate-600">
                      <label htmlFor={`product-${line.key}`}>Product</label>
                      <div className="mt-1">
                        <ProductSelector
                          id={`product-${line.key}`}
                          products={productOptions}
                          value={line.productId}
                          onChange={(id) => {
                            const selected = productById.get(id);
                            updateLine(lotIndex, lineIndex, {
                              productId: id,
                              unitCost: line.unitCost || selected?.defaultPurchasePrice || "",
                            });
                          }}
                        />
                      </div>
                    </div>
                    <label className="text-xs font-semibold text-slate-600">
                      <span>Quantity {product ? `(${product.inventoryUnit.code})` : ""}</span>
                      <input
                        className="input mt-1"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(lotIndex, lineIndex, { quantity: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      <span>Unit purchase price (PKR)</span>
                      <input
                        className="input mt-1"
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(event) =>
                          updateLine(lotIndex, lineIndex, { unitCost: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      <span>Discount (PKR)</span>
                      <input
                        className="input mt-1"
                        inputMode="decimal"
                        value={line.lineDiscountAmount}
                        onChange={(event) =>
                          updateLine(lotIndex, lineIndex, {
                            lineDiscountAmount: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <div className="text-xs font-semibold text-slate-600">
                      <span className="xl:sr-only">Amount (PKR)</span>
                      <div className="mt-1 py-2 text-sm text-slate-900">
                        {safeNetAmount(line.quantity, line.unitCost, line.lineDiscountAmount)}
                      </div>
                    </div>
                    <button
                      className="btn-danger self-end"
                      disabled={lot.lines.length === 1}
                      type="button"
                      onClick={() =>
                        updateLot(lotIndex, {
                          lines: lot.lines.filter((_, index) => index !== lineIndex),
                        })
                      }
                    >
                      Remove
                    </button>
                    <details className="invoice-row-extra text-xs text-slate-500">
                      <summary className="cursor-pointer text-indigo-700">
                        Line notes{line.notes ? " · added" : ""}
                      </summary>
                      <div className="mt-2">
                        <FormField htmlFor={`line-notes-${line.key}`} label="Line notes">
                          <input
                            className="input"
                            id={`line-notes-${line.key}`}
                            value={line.notes}
                            onChange={(event) =>
                              updateLine(lotIndex, lineIndex, { notes: event.target.value })
                            }
                          />
                        </FormField>
                      </div>
                    </details>
                    {product ? (
                      <div className="invoice-row-extra flex flex-wrap gap-4 text-xs text-slate-600">
                        <span>
                          Current stock: {product.currentStock} {product.inventoryUnit.code}
                        </span>
                        <span>
                          Current selling price:{" "}
                          {product.defaultSellingPrice ? `PKR ${product.defaultSellingPrice}` : "—"}
                        </span>
                        <Link
                          className="text-blue-700 underline"
                          href={`/products/${product.id}/history`}
                          target="_blank"
                        >
                          View item history
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <button
                className="btn-secondary m-4"
                type="button"
                onClick={() => updateLot(lotIndex, { lines: [...lot.lines, blankLine()] })}
              >
                Add product line
              </button>
            </div>
          </section>
        ))}
        <button
          className="btn-secondary"
          type="button"
          onClick={() => setValue({ ...value, lots: [...value.lots, blankLot(defaultReceivedAt)] })}
        >
          Add purchase lot
        </button>
        <div className="ml-auto w-full sm:max-w-md">
          <DocumentTotals title="Purchase summary">
            <div className="flex justify-between">
              <span>Gross subtotal</span>
              <strong>PKR {grossSubtotal.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Discount total</span>
              <strong>PKR {discountTotal.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Purchase subtotal</span>
              <strong>PKR {subtotal.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Additional charges</span>
              <strong>PKR {value.additionalCharges || "0"}</strong>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
              <span>Net payable</span>
              <strong>PKR {total.toFixed(2)}</strong>
            </div>
          </DocumentTotals>
        </div>
        <div className="document-actions card">
          <SubmitButton disabled={!supplier}>Save draft</SubmitButton>
          <Link className="btn-secondary" href="/purchases">
            Cancel
          </Link>
        </div>
      </form>
      {quickCreateAction ? (
        <QuickPartyDialog
          action={quickCreateAction}
          kind="supplier"
          open={showSupplierDialog}
          onClose={() => setShowSupplierDialog(false)}
          onCreated={(party) => {
            setSupplierOptions((current) => appendParty(current, party));
            setValue((current) => withSelectedParty(current, "supplierId", party.id));
          }}
        />
      ) : null}
    </>
  );
}

export function PostPurchaseForm({
  action,
  methods,
  total,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  methods: Array<{ id: string; name: string }>;
  total: string;
}) {
  const [result, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const [paymentType, setPaymentType] = useState<"PAID" | "CREDIT" | "PARTIAL">("CREDIT");
  const [amount, setAmount] = useState("0");
  let remaining = total;
  try {
    remaining = Decimal.max(
      new Decimal(total).minus(paymentType === "CREDIT" ? 0 : amount || 0),
      0,
    ).toFixed(2);
  } catch {
    /* server validates */
  }
  return (
    <form
      action={formAction}
      className="card max-w-xl space-y-4 p-6"
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Post this purchase? Posted commercial and inventory facts cannot be edited.",
          )
        )
          event.preventDefault();
      }}
    >
      <h2 className="font-semibold">Review and post</h2>
      <p className="text-sm text-slate-600">
        Posting creates immutable net-cost inventory layers and the supplier payable. Any immediate
        payment is recorded atomically.
      </p>
      <FormMessage result={result} />
      <FormField htmlFor="purchase-payment-type" label="Purchase payment status" required>
        <select
          id="purchase-payment-type"
          name="paymentType"
          className="input"
          value={paymentType}
          onChange={(event) => {
            const next = event.target.value as "PAID" | "CREDIT" | "PARTIAL";
            setPaymentType(next);
            setAmount(
              next === "PAID" ? total : next === "CREDIT" ? "0" : amount === "0" ? "" : amount,
            );
          }}
        >
          <option value="PAID">Paid / Cash</option>
          <option value="CREDIT">Credit</option>
          <option value="PARTIAL">Partial payment</option>
        </select>
      </FormField>
      {paymentType !== "CREDIT" ? (
        <>
          <FormField htmlFor="purchase-payment-method" label="Payment method" required>
            <select id="purchase-payment-method" name="paymentMethodId" className="input" required>
              <option value="">Select payment method</option>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField htmlFor="purchase-paid-now" label="Amount paid (PKR)" required>
            <input
              id="purchase-paid-now"
              name="amount"
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </FormField>
        </>
      ) : null}
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex justify-between">
          <span>Net payable</span>
          <strong>PKR {total}</strong>
        </div>
        <div className="flex justify-between">
          <span>Amount paid</span>
          <strong>PKR {paymentType === "CREDIT" ? "0.00" : amount || "0.00"}</strong>
        </div>
        <div className="flex justify-between">
          <span>Remaining payable</span>
          <strong>PKR {remaining}</strong>
        </div>
      </div>
      <SubmitButton>Post purchase</SubmitButton>
    </form>
  );
}
