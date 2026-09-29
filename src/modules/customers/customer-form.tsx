"use client";
import Link from "next/link";
import { useActionState } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";
type CustomerValue = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};
export function CustomerForm({
  action,
  customer,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  customer?: CustomerValue;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  return (
    <form action={formAction} className="card max-w-3xl space-y-5 p-6">
      <FormMessage result={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField htmlFor="name" label="Customer name" required>
          <input
            className="input"
            defaultValue={customer?.name}
            id="name"
            maxLength={160}
            name="name"
            required
          />
        </FormField>
        <FormField htmlFor="phone" label="Phone">
          <input
            className="input"
            defaultValue={customer?.phone ?? ""}
            id="phone"
            maxLength={40}
            name="phone"
          />
        </FormField>
        <FormField htmlFor="email" label="Email">
          <input
            className="input"
            defaultValue={customer?.email ?? ""}
            id="email"
            maxLength={254}
            name="email"
            type="email"
          />
        </FormField>
      </div>
      <FormField htmlFor="address" label="Address">
        <textarea
          className="input min-h-24"
          defaultValue={customer?.address ?? ""}
          id="address"
          maxLength={1000}
          name="address"
        />
      </FormField>
      <FormField htmlFor="notes" label="Notes">
        <textarea
          className="input min-h-24"
          defaultValue={customer?.notes ?? ""}
          id="notes"
          maxLength={2000}
          name="notes"
        />
      </FormField>
      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <SubmitButton />
        <Link className="btn-secondary" href="/customers">
          Cancel
        </Link>
      </div>
    </form>
  );
}
