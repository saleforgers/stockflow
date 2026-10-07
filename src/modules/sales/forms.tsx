"use client";
import Decimal from "decimal.js";
import { useActionState, useMemo, useState } from "react";
import type { ActionResult } from "@/lib/actions/action-result";
import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { PartySelector } from "@/components/party-selector";
import { ProductSelector } from "@/components/product-selector";
import { QuickPartyDialog } from "@/components/quick-party-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { invoicePreview } from "./preview";
import { newInvoiceCommand } from "./defaults";
import { SalesPaymentControls } from "./payment-controls";
import type { InvoicePaymentType } from "./posting-payment";
import type { InvoiceDraftCommand } from "./validation";
import type { PartyOption, QuickPartyAction } from "@/lib/parties/quick-create";
import { appendParty, withSelectedParty } from "@/lib/parties/selection";

type Action = (state: ActionResult, data: FormData) => Promise<ActionResult>;
type Option = { id: string; name: string };
export function invoicePaymentType(total: Decimal, paid: string) {
  try {
    const amount = new Decimal(paid || 0);
    if (total.isZero()) return "PAID";
    if (amount.isZero()) return "CREDIT";
    return amount.lt(total) ? "PARTIAL" : "PAID";
  } catch {
    return "PAID";
  }
}
function hasBalanceDue(total: Decimal.Value, paid: string) {
  try {
    return new Decimal(total).minus(paid || 0).gt(0);
  } catch {
    return false;
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
  methods = [],
  requestKey,
  estimate = false,
  validUntil = "",
  quickCreateAction,
}: {
  action: Action;
  customers: (PartyOption & { isWalkIn: boolean })[];
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
  quickCreateAction?: QuickPartyAction;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const [selectedPaymentType, setSelectedPaymentType] = useState<InvoicePaymentType>("CREDIT");
  const [partialAmount, setPartialAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [customerOptions, setCustomerOptions] = useState(customers);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [command, setCommand] = useState<InvoiceDraftCommand>(
    initial ?? newInvoiceCommand(date, requestKey),
  );
  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.available,
        inventoryUnit: product.inventoryUnit,
      })),
    [products],
  );
  const updateCommand = (update: (current: InvoiceDraftCommand) => InvoiceDraftCommand) => {
    const next = update(command);
    setCommand(next);
  };
  const totals = invoicePreview(command, products, "0");
  const changeLine = (index: number, key: string, value: string) =>
    updateCommand((c) => ({
      ...c,
      lines: c.lines.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    }));
  const customer = customerOptions.find((item) => item.id === command.customerId);
  const invoiceTotal = new Decimal(totals.total);
  const isWalkIn = customer?.isWalkIn ?? false;
  const paymentType = isWalkIn || invoiceTotal.isZero() ? "PAID" : selectedPaymentType;
  const paid =
    paymentType === "PAID" ? totals.total : paymentType === "CREDIT" ? "0.00" : partialAmount;
  const preview = invoicePreview(command, products, paid);
  return (
    <>
      <form action={formAction} className="card space-y-5 p-6">
        <FormMessage result={state} />
        <input type="hidden" name="payload" value={JSON.stringify(command)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium">
            Customer
            <PartySelector
              addLabel="Add New Customer"
              allLabel="All Customers"
              id="customer"
              parties={customerOptions}
              placeholder="Select Customer"
              recentLabel="Recent Customers"
              value={command.customerId}
              onAddNew={quickCreateAction ? () => setShowCustomerDialog(true) : undefined}
              onChange={(id) =>
                updateCommand((current) => withSelectedParty(current, "customerId", id))
              }
            />
          </label>
          <Field
            label={estimate ? "Estimate Date" : "Invoice Date"}
            name="date"
            type="date"
            value={command.invoiceDate}
            onChange={(v) => updateCommand((c) => ({ ...c, invoiceDate: v }))}
          />
        </div>
        {command.lines.map((line, i) => (
          <fieldset key={i} className="space-y-3 rounded-lg border p-4">
            <legend>Line {i + 1}</legend>
            <div className="space-y-1 text-sm font-medium">
              <label htmlFor={`product-${i}`}>Product / SKU / unit</label>
              <ProductSelector
                id={`product-${i}`}
                products={productOptions}
                value={line.productId}
                onChange={(id) => {
                  const product = products.find((item) => item.id === id);
                  updateCommand((current) => ({
                    ...current,
                    lines: current.lines.map((currentLine, index) =>
                      index === i
                        ? {
                            ...currentLine,
                            productId: id,
                            unitPrice: product?.defaultSellingPrice ?? "",
                          }
                        : currentLine,
                    ),
                  }));
                }}
              />
            </div>
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
                updateCommand((c) => ({
                  ...c,
                  lines: c.lines.filter((_, index) => index !== i),
                }))
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
            updateCommand((c) => ({
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
              onChange={(v) => updateCommand((c) => ({ ...c, invoiceDiscountAmount: v }))}
            />
            <Field
              label="Notes"
              name="notes"
              value={command.notes ?? ""}
              onChange={(v) => updateCommand((c) => ({ ...c, notes: v }))}
              required={false}
            />
            {!estimate && (
              <>
                <SalesPaymentControls
                  paymentType={paymentType}
                  onPaymentTypeChange={setSelectedPaymentType}
                  amount={paid}
                  onAmountChange={setPartialAmount}
                  methodId={paymentMethodId}
                  onMethodChange={setPaymentMethodId}
                  methods={methods}
                  total={totals.total}
                  walkIn={isWalkIn}
                />
                {isWalkIn && hasBalanceDue(invoiceTotal, paid) && (
                  <p className="alert-error" role="alert">
                    Walk-in sales must be fully paid. Select or create a named customer for
                    credit/partial sales.
                  </p>
                )}
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
          <SubmitButton disabled={!customer} name="intent" value="draft" formNoValidate>
            Save Draft
          </SubmitButton>
          {!estimate && (
            <SubmitButton
              name="intent"
              value="finalize"
              disabled={!customer || !!preview.error || preview.shortages.some(Boolean)}
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
      {quickCreateAction ? (
        <QuickPartyDialog
          action={quickCreateAction}
          kind="customer"
          open={showCustomerDialog}
          onClose={() => setShowCustomerDialog(false)}
          onCreated={(party) => {
            setCustomerOptions((current) => appendParty(current, { ...party, isWalkIn: false }));
            updateCommand((current) => withSelectedParty(current, "customerId", party.id));
          }}
        />
      ) : null}
    </>
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
  const [selectedPaymentType, setSelectedPaymentType] = useState<InvoicePaymentType>("CREDIT");
  const [partialAmount, setPartialAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const totalAmount = new Decimal(total);
  const paymentType = walkIn || totalAmount.isZero() ? "PAID" : selectedPaymentType;
  const amount = paymentType === "PAID" ? total : paymentType === "CREDIT" ? "0.00" : partialAmount;
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
      <SalesPaymentControls
        paymentType={paymentType}
        onPaymentTypeChange={setSelectedPaymentType}
        amount={amount}
        onAmountChange={setPartialAmount}
        methodId={paymentMethodId}
        onMethodChange={setPaymentMethodId}
        methods={methods}
        total={total}
        walkIn={walkIn}
      />
      {walkIn && hasBalanceDue(total, amount) && (
        <p className="alert-error" role="alert">
          Walk-in sales must be fully paid. Select or create a named customer for credit/partial
          sales.
        </p>
      )}
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
