"use client";
import { useState, useActionState } from "react";
import Decimal from "decimal.js";
import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProductSelector } from "@/components/product-selector";
import { adjustmentAction } from "./actions";
export function AdjustmentForm({
  products,
  date,
  requestKey,
}: {
  products: { id: string; name: string; sku: string; quantity: string; unit: string }[];
  date: string;
  requestKey: string;
}) {
  const [state, action] = useActionState(adjustmentAction, INITIAL_ACTION_RESULT);
  const [productId, setProduct] = useState("");
  const [actual, setActual] = useState("");
  const productOptions = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    stock: p.quantity,
    inventoryUnit: { code: p.unit },
  }));
  const p = products.find((p) => p.id === productId);
  let difference = "—";
  try {
    difference = new Decimal(actual).minus(p?.quantity ?? "0").toFixed();
  } catch {}
  return (
    <form
      action={(data) => {
        data.set(
          "payload",
          JSON.stringify({
            requestKey,
            productId,
            currentQuantity: p?.quantity ?? "0",
            actualQuantity: actual,
            date: data.get("date"),
            reason: data.get("reason"),
            notes: data.get("notes"),
            ...(String(data.get("unitCost")).trim() ? { unitCost: data.get("unitCost") } : {}),
          }),
        );
        action(data);
      }}
      className="card space-y-5 p-6"
    >
      <FormMessage result={state} />
      <div className="space-y-1">
        <label className="block text-sm font-medium" htmlFor="product-select">
          Product
        </label>
        <ProductSelector
          id="product-select"
          products={productOptions}
          value={productId}
          onChange={(id) => {
            setProduct(id);
            setActual("");
          }}
        />
      </div>
      <p>
        Current quantity:{" "}
        <strong>
          {p?.quantity ?? "—"} {p?.unit}
        </strong>
      </p>
      <label className="block">
        Actual quantity after counting
        <input
          className="input"
          required
          inputMode="decimal"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
      </label>
      <p>
        Calculated difference:{" "}
        <strong>
          {difference} {p?.unit}
        </strong>
      </p>
      <label className="block">
        Date
        <input className="input" required type="date" name="date" defaultValue={date} />
      </label>
      <label className="block">
        Reason
        <select className="input" name="reason">
          {["Damage", "Loss", "Count Correction", "Opening Stock", "Other"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Approved unit cost (PKR) — required when adding stock
        <input className="input" name="unitCost" inputMode="decimal" />
      </label>
      <label className="block">
        Notes
        <textarea className="input" name="notes" maxLength={2000} />
      </label>
      <p className="text-sm text-slate-500">
        This records an auditable stock change. Stock reductions use the oldest available stock
        automatically.
      </p>
      <SubmitButton>Confirm Stock Adjustment</SubmitButton>
    </form>
  );
}
