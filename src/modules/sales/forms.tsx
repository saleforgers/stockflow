"use client";
import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions/action-result";
import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { invoicePreview } from "./preview";
import type { InvoiceDraftCommand } from "./validation";

type Action = (state: ActionResult, data: FormData) => Promise<ActionResult>;
type Option = { id: string; name: string };
function Field({
  label,
  name,
  value,
  type = "text",
  onChange,
  required = true,
}: {
  label: string;
  name: string;
  value?: string;
  type?: string;
  onChange?: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm font-medium">
      {label}
      <input
        className="input"
        name={name}
        type={type}
        required={required}
        {...(onChange
          ? {
              value,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
            }
          : { defaultValue: value })}
      />
    </label>
  );
}
function Select({
  label,
  name,
  options,
  value,
  onChange,
  required = true,
}: {
  label: string;
  name: string;
  options: Option[];
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm font-medium">
      {label}
      <select
        className="input"
        name={name}
        required={required}
        {...(onChange
          ? {
              value,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value),
            }
          : { defaultValue: value })}
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function InvoiceForm({
  action,
  customers,
  products,
  date,
  initial,
  methods = [],
  requestKey,
  estimate = false,
  validUntil = "",
}: {
  action: Action;
  customers: Option[];
  products: (Option & {
    sku: string;
    defaultSellingPrice: string;
    available: string;
    inventoryUnit: { code: string; decimalScale: number };
  })[];
  date: string;
  initial?: InvoiceDraftCommand;
  methods?: Option[];
  requestKey?: string;
  estimate?: boolean;
  validUntil?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const [paid, setPaid] = useState("0");
  const [command, setCommand] = useState<InvoiceDraftCommand>(
    initial ?? {
      requestKey,
      customerId: "",
      invoiceDate: date,
      invoiceDiscountAmount: "0",
      notes: "",
      lines: [{ productId: "", quantity: "1", unitPrice: "", lineDiscountAmount: "0" }],
    },
  );
  const preview = invoicePreview(command, products, paid);
  const changeLine = (index: number, key: string, value: string) =>
    setCommand((c) => ({
      ...c,
      lines: c.lines.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    }));
  return (
    <form action={formAction} className="card space-y-5 p-6">
      <FormMessage result={state} />
      <input type="hidden" name="payload" value={JSON.stringify(command)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Customer"
          name="customer"
          options={customers}
          value={command.customerId}
          onChange={(v) => setCommand((c) => ({ ...c, customerId: v }))}
        />
        <Field
          label={estimate ? "Estimate Date" : "Invoice Date"}
          name="date"
          type="date"
          value={command.invoiceDate}
          onChange={(v) => setCommand((c) => ({ ...c, invoiceDate: v }))}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Available Stock</th>
              <th>Qty</th>
              <th>Rate (PKR)</th>
              <th>Discount (PKR)</th>
              <th>Amount (PKR)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {command.lines.map((line, i) => {
              const p = products.find((p) => p.id === line.productId);
              return (
                <tr key={i}>
                  <td className="min-w-64">
                    <Select
                      label="Product"
                      name={"product-" + i}
                      options={products.map((p) => ({ id: p.id, name: p.name + " · " + p.sku }))}
                      value={line.productId}
                      onChange={(v) => {
                        const product = products.find((p) => p.id === v);
                        setCommand((c) => ({
                          ...c,
                          lines: c.lines.map((l, index) =>
                            index === i
                              ? {
                                  ...l,
                                  productId: v,
                                  unitPrice: product?.defaultSellingPrice ?? "",
                                }
                              : l,
                          ),
                        }));
                      }}
                    />
                  </td>
                  <td>
                    {p ? p.available + " " + p.inventoryUnit.code : "—"}
                    {!estimate && preview.shortages[i] && (
                      <p className="mt-1 text-sm text-red-700">{preview.shortages[i]}</p>
                    )}
                  </td>
                  <td className="min-w-24">
                    <Field
                      label="Qty"
                      name={"qty-" + i}
                      value={line.quantity}
                      onChange={(v) => changeLine(i, "quantity", v)}
                    />
                  </td>
                  <td className="min-w-32">
                    <Field
                      label="Rate"
                      name={"rate-" + i}
                      value={line.unitPrice}
                      onChange={(v) => changeLine(i, "unitPrice", v)}
                    />
                  </td>
                  <td className="min-w-32">
                    <Field
                      label="Discount"
                      name={"discount-" + i}
                      value={line.lineDiscountAmount}
                      onChange={(v) => changeLine(i, "lineDiscountAmount", v)}
                    />
                  </td>
                  <td className="tabular-nums">{preview.amounts[i]}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={command.lines.length === 1}
                      onClick={() =>
                        setCommand((c) => ({
                          ...c,
                          lines: c.lines.filter((_, index) => index !== i),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn-secondary"
        onClick={() =>
          setCommand((c) => ({
            ...c,
            lines: [
              ...c.lines,
              { productId: "", quantity: "1", unitPrice: "", lineDiscountAmount: "0" },
            ],
          }))
        }
      >
        + Add Product
      </button>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-4">
          <Field
            label="Invoice Discount (PKR)"
            name="invoiceDiscount"
            value={command.invoiceDiscountAmount}
            onChange={(v) => setCommand((c) => ({ ...c, invoiceDiscountAmount: v }))}
          />
          <Field
            label="Notes"
            name="notes"
            value={command.notes ?? ""}
            onChange={(v) => setCommand((c) => ({ ...c, notes: v }))}
            required={false}
          />
          {!estimate && (
            <>
              <Select
                label="Payment Method (leave empty for Credit)"
                name="paymentMethodId"
                options={methods}
                required={false}
              />
              <Field label="Paid Now (PKR)" name="amount" value={paid} onChange={setPaid} />
            </>
          )}
          {estimate && (
            <Field
              label="Valid Until (optional)"
              name="validUntil"
              type="date"
              value={validUntil}
              required={false}
            />
          )}
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 space-y-4 tabular-nums">
          <p>
            Subtotal <strong className="float-right">PKR {preview.subtotal}</strong>
          </p>
          <p>
            Invoice Discount{" "}
            <strong className="float-right">PKR {command.invoiceDiscountAmount || "0"}</strong>
          </p>
          <p className="border-t border-indigo-200 pt-4 text-xl font-semibold text-indigo-900">
            Grand Total <strong className="float-right">PKR {preview.total}</strong>
          </p>
          {!estimate && (
            <>
              <p className="text-emerald-700">
                Paid Now <strong className="float-right">PKR {paid || "0"}</strong>
              </p>
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-900">
                Balance Due <strong className="float-right">PKR {preview.balance}</strong>
              </p>
            </>
          )}
        </div>
      </div>
      {preview.error && <p className="text-sm text-red-700">{preview.error}</p>}
      <div className="flex gap-3">
        <SubmitButton name="intent" value="draft">
          Save Draft
        </SubmitButton>
        {!estimate && (
          <SubmitButton
            name="intent"
            value="finalize"
            disabled={!!preview.error || preview.shortages.some(Boolean)}
          >
            Finalize Invoice
          </SubmitButton>
        )}
      </div>
      <p className="text-sm text-slate-500">
        {estimate
          ? "Estimates do not reserve or deduct stock."
          : "Drafts do not deduct stock. Finalizing updates stock and the customer account. Availability is checked again when you finalize."}
      </p>
    </form>
  );
}
export function PostInvoiceForm({
  action,
  methods,
  walkIn,
}: {
  action: Action;
  methods: Option[];
  walkIn: boolean;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  return (
    <form
      action={formAction}
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        if (!window.confirm("Finalize this invoice and update stock and the customer balance?"))
          e.preventDefault();
      }}
    >
      <FormMessage result={state} />
      <p>
        {walkIn
          ? "Full payment is required for this walk-in invoice."
          : "Enter Paid Now, or leave empty for a Credit invoice."}
      </p>
      <Select label="Payment Method" name="paymentMethodId" options={methods} required={walkIn} />
      <Field label="Paid Now (PKR)" name="amount" required={walkIn} />
      <SubmitButton>Finalize Invoice</SubmitButton>
    </form>
  );
}
export function ReceiptForm({
  action,
  customers,
  methods,
  invoices,
  date,
  requestKey,
  customerId = "",
}: {
  action: Action;
  customers: Option[];
  methods: Option[];
  invoices: { id: string; invoiceNumber: string; customerId: string; outstanding: string }[];
  date: string;
  requestKey: string;
  customerId?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const [customer, setCustomer] = useState(customerId);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  return (
    <form
      action={async (data) => {
        const payload = {
          requestKey,
          customerId: customer,
          paymentMethodId: data.get("method"),
          paymentDate: data.get("date"),
          amount: data.get("amount"),
          reference: data.get("reference"),
          notes: data.get("notes"),
          allocations: invoices
            .filter((i) => i.customerId === customer && allocations[i.id]?.trim())
            .map((i) => ({ salesInvoiceId: i.id, amount: allocations[i.id] })),
        };
        data.set("payload", JSON.stringify(payload));
        formAction(data);
      }}
      className="card space-y-4 p-6"
    >
      <FormMessage result={state} />
      <Select
        label="Customer"
        name="customer"
        options={customers}
        value={customer}
        onChange={(v) => {
          setCustomer(v);
          setAllocations({});
        }}
      />
      <Select label="Receipt method" name="method" options={methods} />
      <Field label="Receipt date" name="date" type="date" value={date} />
      <Field label="Receipt amount (PKR)" name="amount" />
      <p className="text-sm text-slate-500">
        Allocate all or part of this receipt below. Any remainder stays on account as an advance.
      </p>
      {invoices
        .filter((i) => i.customerId === customer)
        .map((i) => (
          <Field
            key={i.id}
            label={`${i.invoiceNumber} — outstanding PKR ${i.outstanding}`}
            name={i.id}
            value={allocations[i.id] ?? ""}
            onChange={(v) => setAllocations((a) => ({ ...a, [i.id]: v }))}
            required={false}
          />
        ))}
      <Field label="Reference" name="reference" required={false} />
      <Field label="Notes" name="notes" required={false} />
      <SubmitButton>Record receipt</SubmitButton>
    </form>
  );
}
export function ReturnForm({
  action,
  invoiceId,
  lines,
  date,
  requestKey,
}: {
  action: Action;
  invoiceId: string;
  lines: { id: string; name: string; original: string; returned: string; remaining: string }[];
  date: string;
  requestKey: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  return (
    <form
      action={async (data) => {
        data.set(
          "payload",
          JSON.stringify({
            requestKey,
            salesInvoiceId: invoiceId,
            returnDate: data.get("date"),
            reason: data.get("reason"),
            notes: data.get("notes"),
            lines: lines
              .filter((l) => String(data.get(l.id) ?? "").trim())
              .map((l) => ({ salesInvoiceLineId: l.id, quantity: data.get(l.id) })),
          }),
        );
        formAction(data);
      }}
      className="card space-y-4 p-6"
    >
      <FormMessage result={state} />
      <Field label="Return date" name="date" type="date" value={date} />
      <Select
        label="Reason"
        name="reason"
        options={["Damaged", "Wrong Item", "Customer Return", "Other"].map((name) => ({
          id: name,
          name,
        }))}
      />
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Original Qty</th>
              <th>Already Returned</th>
              <th>Returnable</th>
              <th>Return Qty</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{l.original}</td>
                <td>{l.returned}</td>
                <td>{l.remaining}</td>
                <td>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    min="0"
                    max={l.remaining}
                    name={l.id}
                    aria-label={`Return quantity for ${l.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Field label="Notes" name="notes" required={false} />
      <p className="text-sm text-slate-500">
        Returned products go back into inventory and credit the customer account. Inspect damaged
        goods before returning them to stock. Cash refunds are separate transactions.
      </p>
      <SubmitButton>Confirm Return</SubmitButton>
    </form>
  );
}
export function AdvanceForm({
  action,
  payments,
  invoices,
  requestKey,
}: {
  action: Action;
  payments: Option[];
  invoices: Option[];
  requestKey: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  return (
    <form action={formAction} className="card space-y-4 p-6">
      <h2 className="font-semibold">Use an existing advance</h2>
      <input type="hidden" name="requestKey" value={requestKey} />
      <FormMessage result={state} />
      <Select label="Receipt" name="paymentId" options={payments} />
      <Select label="Invoice" name="salesInvoiceId" options={invoices} />
      <Field label="Amount to apply (PKR)" name="amount" />
      <SubmitButton>Apply advance</SubmitButton>
    </form>
  );
}
