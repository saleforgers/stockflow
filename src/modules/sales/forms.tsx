"use client";
import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions/action-result";
import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
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
}: {
  action: Action;
  customers: Option[];
  products: (Option & {
    sku: string;
    defaultSellingPrice: string;
    inventoryUnit: { code: string; decimalScale: number };
  })[];
  date: string;
  initial?: InvoiceDraftCommand;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const [command, setCommand] = useState<InvoiceDraftCommand>(
    initial ?? {
      customerId: "",
      invoiceDate: date,
      invoiceDiscountAmount: "0",
      notes: "",
      lines: [{ productId: "", quantity: "1", unitPrice: "", lineDiscountAmount: "0" }],
    },
  );
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
          label="Invoice date"
          name="date"
          type="date"
          value={command.invoiceDate}
          onChange={(v) => setCommand((c) => ({ ...c, invoiceDate: v }))}
        />
      </div>
      {command.lines.map((line, i) => (
        <fieldset key={i} className="space-y-3 rounded-lg border p-4">
          <legend>Line {i + 1}</legend>
          <Select
            label="Product / SKU / unit"
            name={`product-${i}`}
            options={products.map((p) => ({
              id: p.id,
              name: `${p.sku} — ${p.name} (${p.inventoryUnit.code})`,
            }))}
            value={line.productId}
            onChange={(v) => {
              const product = products.find((p) => p.id === v);
              setCommand((c) => ({
                ...c,
                lines: c.lines.map((l, index) =>
                  index === i
                    ? { ...l, productId: v, unitPrice: product?.defaultSellingPrice ?? "" }
                    : l,
                ),
              }));
            }}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Quantity"
              name={`qty-${i}`}
              value={line.quantity}
              onChange={(v) => changeLine(i, "quantity", v)}
            />
            <Field
              label="Unit selling price (PKR)"
              name={`price-${i}`}
              value={line.unitPrice}
              onChange={(v) => changeLine(i, "unitPrice", v)}
            />
            <Field
              label="Line discount (PKR)"
              name={`discount-${i}`}
              value={line.lineDiscountAmount}
              onChange={(v) => changeLine(i, "lineDiscountAmount", v)}
            />
          </div>
          <Field
            label="Line notes"
            name={`notes-${i}`}
            value={line.notes ?? ""}
            onChange={(v) => changeLine(i, "notes", v)}
            required={false}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={command.lines.length === 1}
            onClick={() =>
              setCommand((c) => ({ ...c, lines: c.lines.filter((_, index) => index !== i) }))
            }
          >
            Remove line
          </button>
        </fieldset>
      ))}
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
        Add product line
      </button>
      <Field
        label="Invoice discount (PKR)"
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
      <p className="text-sm text-slate-500">
        Save to review validated totals before posting. Discounts are fixed PKR amounts.
      </p>
      <SubmitButton>Save draft</SubmitButton>
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
        if (!window.confirm("Post invoice and consume stock?")) e.preventDefault();
      }}
    >
      <FormMessage result={state} />
      <p>
        {walkIn
          ? "Full payment is required for this walk-in invoice."
          : "Optional receipt at posting. Leave amount empty for a credit invoice."}
      </p>
      <Select label="Receipt method" name="paymentMethodId" options={methods} required={walkIn} />
      <Field label="Receipt amount (PKR)" name="amount" required={walkIn} />
      <SubmitButton>Post invoice</SubmitButton>
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
  lines: { id: string; name: string; remaining: string }[];
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
      <Field label="Reason" name="reason" />
      {lines.map((l) => (
        <Field
          key={l.id}
          label={`${l.name} — returnable ${l.remaining}`}
          name={l.id}
          required={false}
        />
      ))}
      <Field label="Notes" name="notes" required={false} />
      <p className="text-sm text-slate-500">
        Returns restore original cost layers and credit the customer. Cash refunds are separate
        transactions.
      </p>
      <SubmitButton>Post sale return</SubmitButton>
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
      <h2 className="font-semibold">Allocate an existing advance</h2>
      <input type="hidden" name="requestKey" value={requestKey} />
      <FormMessage result={state} />
      <Select label="Receipt" name="paymentId" options={payments} />
      <Select label="Invoice" name="salesInvoiceId" options={invoices} />
      <Field label="Allocation amount (PKR)" name="amount" />
      <SubmitButton>Allocate advance</SubmitButton>
    </form>
  );
}
