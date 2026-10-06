"use client";
import { useState, useActionState } from "react";
import Decimal from "decimal.js";
import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { adjustmentAction } from "./actions";
export function AdjustmentForm({
  products,
  date,
  requestKey,
}: {
  products: { id: string; name: string; quantity: string; unit: string }[];
  date: string;
  requestKey: string;
}) {
  const [state, action] = useActionState(adjustmentAction, INITIAL_ACTION_RESULT);
  const [productId, setProduct] = useState("");
  const [actual, setActual] = useState("");
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
      <label className="block">
        Product
        <select
          className="input"
          required
          value={productId}
          onChange={(e) => {
            setProduct(e.target.value);
            setActual("");
          }}
        >
          <option value="">Select a product</option>
          {products.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
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
