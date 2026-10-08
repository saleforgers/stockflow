"use client";
import Link from "next/link";
import { useActionState } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";

type SupplierValue = {
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};
export function SupplierForm({
  action,
  supplier,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  supplier?: SupplierValue;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  const fieldErrors = state.ok ? {} : (state.fieldErrors ?? {});
  return (
    <form action={formAction} className="card max-w-3xl space-y-5 p-6">
      <FormMessage result={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField htmlFor="name" error={fieldErrors["name"]?.[0]} label="Supplier name" required>
          <input
            className="input"
            defaultValue={supplier?.name}
            id="name"
            maxLength={160}
            name="name"
            required
          />
        </FormField>
        <FormField
          htmlFor="contactPerson"
          error={fieldErrors["contactPerson"]?.[0]}
          label="Contact person"
        >
          <input
            className="input"
            defaultValue={supplier?.contactPerson ?? ""}
            id="contactPerson"
            maxLength={120}
            name="contactPerson"
          />
        </FormField>
        <FormField htmlFor="phone" error={fieldErrors["phone"]?.[0]} label="Phone">
          <input
            className="input"
            defaultValue={supplier?.phone ?? ""}
            id="phone"
            maxLength={40}
            name="phone"
          />
        </FormField>
        <FormField htmlFor="email" error={fieldErrors["email"]?.[0]} label="Email">
          <input
            className="input"
            defaultValue={supplier?.email ?? ""}
            id="email"
            maxLength={254}
            name="email"
            type="email"
          />
        </FormField>
      </div>
      <FormField htmlFor="address" error={fieldErrors["address"]?.[0]} label="Address">
        <textarea
          className="input min-h-24"
          defaultValue={supplier?.address ?? ""}
          id="address"
          maxLength={1000}
          name="address"
        />
      </FormField>
      <FormField htmlFor="notes" error={fieldErrors["notes"]?.[0]} label="Notes">
        <textarea
          className="input min-h-24"
          defaultValue={supplier?.notes ?? ""}
          id="notes"
          maxLength={2000}
          name="notes"
        />
      </FormField>
      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <SubmitButton />
        <Link className="btn-secondary" href="/suppliers">
          Cancel
        </Link>
      </div>
    </form>
  );
}
