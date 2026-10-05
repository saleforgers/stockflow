"use client";
import Decimal from "decimal.js";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/actions/action-result";
import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import type { InvoiceDraftCommand } from "./validation";

type Action = (state: ActionResult, data: FormData) => Promise<ActionResult>;
type Option = { id: string; name: string };
function safeMoney(value: Decimal.Value) {
  try {
    return new Decimal(value || 0).toDecimalPlaces(2).toFixed(2);
  } catch {
    return "0.00";
  }
}
function safeLineAmount(quantity: string, price: string, discount: string) {
  try {
    return safeMoney(new Decimal(quantity || 0).times(price || 0).minus(discount || 0));
  } catch {
    return "0.00";
  }
}
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
  customers: (Option & { phone: string | null; accountBalance: string; isWalkIn: boolean })[];
  products: (Option & {
    sku: string;
    defaultSellingPrice: string;
    currentStock: string;
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
  const customer = customers.find((item) => item.id === command.customerId);
  const subtotal = command.lines.reduce((sum, line) => {
    try {
      return sum.plus(
        Decimal.max(
          new Decimal(line.quantity || 0)
            .times(line.unitPrice || 0)
            .toDecimalPlaces(2)
            .minus(line.lineDiscountAmount || 0),
          0,
        ),
      );
    } catch {
      return sum;
    }
  }, new Decimal(0));
  let invoiceTotal = subtotal;
  try {
    invoiceTotal = Decimal.max(subtotal.minus(command.invoiceDiscountAmount || 0), 0);
  } catch {
    /* server validates */
  }
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
      {customer ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className="text-slate-500">Phone</span>
              <div className="font-medium">{customer.phone || "—"}</div>
            </div>
            <div>
              <span className="text-slate-500">Previous account balance</span>
              <div className="font-medium">PKR {customer.accountBalance}</div>
            </div>
            <div className="self-end">
              <Link
                className="btn-secondary"
                href={`/customers/${customer.id}/account`}
                target="_blank"
              >
                View customer ledger
              </Link>
            </div>
          </div>
        </div>
      ) : null}
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
          {line.productId
            ? (() => {
                const selected = products.find((product) => product.id === line.productId);
                if (!selected) return null;
                let shortage = false;
                try {
                  shortage = new Decimal(line.quantity || 0).greaterThan(selected.currentStock);
                } catch {
                  /* server validates */
                }
                return (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className={shortage ? "font-medium text-red-700" : "text-slate-600"}>
                      Available: {selected.currentStock} {selected.inventoryUnit.code}
                      {shortage ? " — insufficient stock" : ""}
                    </span>
                    <span>
                      Line amount: PKR{" "}
                      {safeLineAmount(line.quantity, line.unitPrice, line.lineDiscountAmount)}
                    </span>
                    <Link
                      className="text-blue-700 underline"
                      href={`/products/${selected.id}/history`}
                      target="_blank"
                    >
                      View item history
                    </Link>
                  </div>
                );
              })()
            : null}
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
      <section className="ml-auto max-w-md space-y-2 rounded-lg border border-slate-200 p-4 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <strong>PKR {subtotal.toFixed(2)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Invoice discount</span>
          <strong>PKR {safeMoney(command.invoiceDiscountAmount)}</strong>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
          <span>Current invoice total</span>
          <strong>PKR {invoiceTotal.toFixed(2)}</strong>
        </div>
        {customer ? (
          <div className="flex justify-between">
            <span>Total customer outstanding after invoice</span>
            <strong>
              PKR {new Decimal(customer.accountBalance).plus(invoiceTotal).toFixed(2)}
            </strong>
          </div>
        ) : null}
      </section>
      <SubmitButton>Save draft</SubmitButton>
    </form>
  );
}
export function PostInvoiceForm({
  action,
  methods,
  walkIn,
  total,
}: {
  action: Action;
  methods: Option[];
  walkIn: boolean;
  total: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const [paymentType, setPaymentType] = useState<"PAID" | "CREDIT" | "PARTIAL">(
    walkIn ? "PAID" : "CREDIT",
  );
  const [amount, setAmount] = useState(walkIn ? total : "0");
  return (
    <form
      action={formAction}
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        if (!window.confirm("Post invoice and consume stock?")) e.preventDefault();
      }}
    >
      <FormMessage result={state} />
      <Select
        label="Sale type / payment status"
        name="paymentType"
        options={
          walkIn
            ? [{ id: "PAID", name: "Cash / Paid" }]
            : [
                { id: "PAID", name: "Cash / Paid" },
                { id: "CREDIT", name: "Credit" },
                { id: "PARTIAL", name: "Partial payment" },
              ]
        }
        value={paymentType}
        onChange={(value) => {
          const next = value as "PAID" | "CREDIT" | "PARTIAL";
          setPaymentType(next);
          setAmount(
            next === "PAID" ? total : next === "CREDIT" ? "0" : amount === "0" ? "" : amount,
          );
        }}
      />
      {paymentType !== "CREDIT" ? (
        <>
          <Select label="Receipt method" name="paymentMethodId" options={methods} />
          <Field label="Paid now (PKR)" name="amount" value={amount} onChange={setAmount} />
        </>
      ) : null}
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex justify-between">
          <span>Invoice total</span>
          <strong>PKR {total}</strong>
        </div>
        <div className="flex justify-between">
          <span>Paid now</span>
          <strong>PKR {paymentType === "CREDIT" ? "0.00" : safeMoney(amount)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Invoice balance</span>
          <strong>
            PKR{" "}
            {paymentType === "CREDIT"
              ? total
              : Decimal.max(new Decimal(total).minus(amount || 0), 0).toFixed(2)}
          </strong>
        </div>
      </div>
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
