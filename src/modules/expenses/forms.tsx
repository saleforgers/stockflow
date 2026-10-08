"use client";

import Link from "next/link";
import { DocumentHeading } from "@/components/ui/document-layout";
import { useActionState, useState } from "react";

import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";

type Option = { id: string; name: string };

export function ExpenseForm({
  action,
  requestKey,
  date,
  categories,
  paymentMethods,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  requestKey: string;
  date: string;
  categories: Option[];
  paymentMethods: Option[];
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const fieldErrors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form
      action={formAction}
      onReset={(event) => event.preventDefault()}
      className="card invoice-document"
    >
      <DocumentHeading
        title="Expense voucher"
        description="Record a paid operating expense"
        aside={<span className="status-badge status-inactive">New entry</span>}
      />
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <FormMessage result={state} />
          <input name="requestKey" type="hidden" value={requestKey} />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              htmlFor="expenseDate"
              error={fieldErrors["expenseDate"]?.[0]}
              label="Expense Date"
              required
            >
              <input
                className="input"
                defaultValue={date}
                id="expenseDate"
                name="expenseDate"
                required
                type="date"
              />
            </FormField>
            <FormField
              htmlFor="expenseCategoryId"
              error={fieldErrors["expenseCategoryId"]?.[0]}
              label="Category"
              required
            >
              <select
                className="input"
                id="expenseCategoryId"
                name="expenseCategoryId"
                required
                defaultValue=""
              >
                <option disabled value="">
                  Select category
                </option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField
            htmlFor="description"
            error={fieldErrors["description"]?.[0]}
            label="Description"
            required
          >
            <input className="input" id="description" maxLength={500} name="description" required />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField htmlFor="payeeName" error={fieldErrors["payeeName"]?.[0]} label="Paid To">
              <input className="input" id="payeeName" maxLength={200} name="payeeName" />
            </FormField>
            <FormField htmlFor="reference" error={fieldErrors["reference"]?.[0]} label="Reference">
              <input className="input" id="reference" maxLength={200} name="reference" />
            </FormField>
          </div>
          <FormField htmlFor="notes" error={fieldErrors["notes"]?.[0]} label="Notes">
            <textarea className="input min-h-28" id="notes" maxLength={2000} name="notes" />
          </FormField>
        </div>
        <aside className="document-totals self-start space-y-5">
          <h2 className="document-eyebrow">Expense amount</h2>
          <FormField
            htmlFor="amount"
            error={fieldErrors["amount"]?.[0]}
            label="Amount (PKR)"
            required
          >
            <input
              className="input text-2xl font-semibold tabular-nums"
              id="amount"
              inputMode="decimal"
              min="0.01"
              name="amount"
              placeholder="0.00"
              required
              step="0.01"
            />
          </FormField>
          <FormField
            htmlFor="paymentMethodId"
            error={fieldErrors["paymentMethodId"]?.[0]}
            label="Payment Method"
            required
          >
            <select
              className="input"
              id="paymentMethodId"
              name="paymentMethodId"
              required
              defaultValue=""
            >
              <option disabled value="">
                Select payment method
              </option>
              {paymentMethods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </FormField>

          <p className="text-xs text-slate-500">Paid operating expense · PKR</p>
        </aside>
      </div>
      <div className="document-actions">
        <SubmitButton>Save expense</SubmitButton>
        <Link className="btn-secondary" href="/expenses">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function ExpenseCategoryForm({
  action,
  category,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  category?: { name: string; description: string | null };
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const fieldErrors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form action={formAction} className="card max-w-2xl space-y-5 p-6">
      <FormMessage result={state} />
      <FormField htmlFor="name" error={fieldErrors["name"]?.[0]} label="Category name" required>
        <input
          className="input"
          defaultValue={category?.name}
          id="name"
          maxLength={100}
          name="name"
          required
        />
      </FormField>
      <FormField htmlFor="description" error={fieldErrors["description"]?.[0]} label="Description">
        <textarea
          className="input min-h-28"
          defaultValue={category?.description ?? ""}
          id="description"
          maxLength={1000}
          name="description"
        />
      </FormField>
      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <SubmitButton />
        <Link className="btn-secondary" href="/expense-categories">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function VoidExpenseForm({
  action,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const fieldErrors = state.ok ? {} : (state.fieldErrors ?? {});
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="max-w-2xl">
      <button
        aria-controls="void-expense-panel"
        aria-expanded={expanded}
        className="btn-secondary"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        Void expense
        <svg
          aria-hidden="true"
          className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded ? (
        <form
          action={formAction}
          className="card mt-3 space-y-4 border-red-200 p-6"
          id="void-expense-panel"
        >
          <p className="text-sm text-slate-600">
            The original record remains in history and is excluded from expense totals.
          </p>
          <FormMessage result={state} />
          <FormField htmlFor="reason" error={fieldErrors["reason"]?.[0]} label="Reason" required>
            <textarea
              autoFocus
              className="input min-h-24"
              id="reason"
              maxLength={500}
              minLength={3}
              name="reason"
              required
            />
          </FormField>
          <SubmitButton>Confirm void</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
