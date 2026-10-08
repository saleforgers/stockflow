"use client";

import Decimal from "decimal.js";
import Link from "next/link";
import { useActionState, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";

export function PurchaseReturnForm({
  action,
  purchaseId,
  purchaseNumber,
  defaultDate,
  lines,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  purchaseId: string;
  purchaseNumber: string;
  defaultDate: string;
  lines: Array<{
    id: string;
    sku: string;
    name: string;
    uom: string;
    available: string;
    unitCost: string;
  }>;
}) {
  const [result, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const fieldErrors = result.ok ? {} : (result.fieldErrors ?? {});
  const [returnDate, setReturnDate] = useState(defaultDate);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const selected = lines.flatMap((line) =>
    quantities[line.id] ? [{ purchaseLineId: line.id, quantity: quantities[line.id] }] : [],
  );
  const total = lines.reduce((sum, line) => {
    try {
      return sum.plus(
        new Decimal(quantities[line.id] || 0).times(line.unitCost).toDecimalPlaces(2),
      );
    } catch {
      return sum;
    }
  }, new Decimal(0));
  return (
    <form action={formAction} className="space-y-6">
      <input
        name="payload"
        type="hidden"
        value={JSON.stringify({ purchaseId, returnDate, reason, notes, lines: selected })}
      />
      <FormMessage result={result} />
      <section className="card grid gap-5 p-6 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Original purchase
          </div>
          <div className="mt-1 font-semibold">{purchaseNumber}</div>
        </div>
        <FormField
          htmlFor="returnDate"
          error={fieldErrors["returnDate"]?.[0]}
          label="Return date"
          required
        >
          <input
            className="input"
            id="returnDate"
            type="date"
            value={returnDate}
            onChange={(event) => setReturnDate(event.target.value)}
            required
          />
        </FormField>
        <FormField htmlFor="reason" error={fieldErrors["reason"]?.[0]} label="Reason" required>
          <input
            className="input"
            id="reason"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
        </FormField>
        <FormField htmlFor="notes" error={fieldErrors["notes"]?.[0]} label="Notes">
          <textarea
            className="input min-h-20"
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </section>
      <section className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Available</th>
              <th>Unit cost</th>
              <th>Return quantity</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <div className="font-medium">{line.sku}</div>
                  <div className="text-slate-500">{line.name}</div>
                </td>
                <td>
                  {line.available} {line.uom}
                </td>
                <td>PKR {line.unitCost}</td>
                <td>
                  <input
                    className="input max-w-40"
                    inputMode="decimal"
                    placeholder="0"
                    value={quantities[line.id] ?? ""}
                    onChange={(event) =>
                      setQuantities({ ...quantities, [line.id]: event.target.value })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="card ml-auto max-w-sm p-5 text-right">
        <span className="text-sm text-slate-500">Return credit </span>
        <strong>PKR {total.toFixed(2)}</strong>
      </div>
      <div className="flex gap-3">
        <SubmitButton>Confirm Return</SubmitButton>
        <Link className="btn-secondary" href={`/purchases/${purchaseId}`}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
