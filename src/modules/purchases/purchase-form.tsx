"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  defaultPurchasePrice: string;
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

export function PurchaseForm({
  action,
  suppliers,
  products,
  initial,
  defaultDate,
  defaultReceivedAt,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  suppliers: Array<{ id: string; name: string }>;
  products: ProductOption[];
  initial?: PurchaseFormValue;
  defaultDate: string;
  defaultReceivedAt: string;
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
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const subtotal = value.lots
    .flatMap((lot) => lot.lines)
    .reduce((sum, line) => sum.plus(safeAmount(line.quantity, line.unitCost)), new Decimal(0));
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
    <form action={formAction} className="space-y-6">
      <input name="payload" type="hidden" value={JSON.stringify(payload)} />
      <FormMessage result={result} />
      <section className="card grid gap-5 p-6 sm:grid-cols-2">
        <FormField htmlFor="supplier" label="Supplier" required>
          <select
            className="input"
            id="supplier"
            value={value.supplierId}
            onChange={(event) => setValue({ ...value, supplierId: event.target.value })}
            required
          >
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
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
      </section>

      {value.lots.map((lot, lotIndex) => (
        <section className="card overflow-hidden" key={lot.key}>
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
          <div className="space-y-3 p-4">
            {lot.lines.map((line, lineIndex) => {
              const product = productById.get(line.productId);
              return (
                <div
                  className="grid gap-3 rounded-lg border border-slate-200 p-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]"
                  key={line.key}
                >
                  <label className="text-xs font-semibold text-slate-600">
                    Product
                    <select
                      className="input mt-1"
                      value={line.productId}
                      onChange={(event) => {
                        const selected = productById.get(event.target.value);
                        updateLine(lotIndex, lineIndex, {
                          productId: event.target.value,
                          unitCost: line.unitCost || selected?.defaultPurchasePrice || "",
                        });
                      }}
                      required
                    >
                      <option value="">Select product</option>
                      {products.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} — {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Quantity {product ? `(${product.inventoryUnit.code})` : ""}
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
                    Unit cost
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
                  <div className="text-xs font-semibold text-slate-600">
                    Line total
                    <div className="mt-1 py-2 text-sm text-slate-900">
                      PKR {safeAmount(line.quantity, line.unitCost)}
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
                </div>
              );
            })}
            <button
              className="btn-secondary"
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
      <section className="card ml-auto max-w-md space-y-2 p-5 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <strong>PKR {subtotal.toFixed(2)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Additional charges</span>
          <strong>PKR {value.additionalCharges || "0"}</strong>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
          <span>Total</span>
          <strong>PKR {total.toFixed(2)}</strong>
        </div>
      </section>
      <div className="flex gap-3">
        <SubmitButton>Save draft</SubmitButton>
        <Link className="btn-secondary" href="/purchases">
          Cancel
        </Link>
      </div>
    </form>
  );
}
