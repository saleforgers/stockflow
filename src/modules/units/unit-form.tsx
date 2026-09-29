"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";

export function UnitForm({
  action,
  unit,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  unit?: { code: string; name: string; decimalScale: number };
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  return (
    <form action={formAction} className="card max-w-2xl space-y-5 p-6">
      <FormMessage result={state} />
      <FormField htmlFor="code" label="Code" hint="Codes are normalized to uppercase." required>
        <input
          className="input"
          defaultValue={unit?.code}
          id="code"
          maxLength={12}
          name="code"
          required
        />
      </FormField>
      <FormField htmlFor="name" label="Name" required>
        <input
          className="input"
          defaultValue={unit?.name}
          id="name"
          maxLength={80}
          name="name"
          required
        />
      </FormField>
      <FormField
        htmlFor="decimalScale"
        label="Allowed decimal places"
        hint="0 for indivisible units; up to 4 for measured quantities."
        required
      >
        <input
          className="input"
          defaultValue={unit?.decimalScale ?? 0}
          id="decimalScale"
          max={4}
          min={0}
          name="decimalScale"
          required
          type="number"
        />
      </FormField>
      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <SubmitButton />
        <Link className="btn-secondary" href="/units">
          Cancel
        </Link>
      </div>
    </form>
  );
}
