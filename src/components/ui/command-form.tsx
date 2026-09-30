"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/actions/action-result";
import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function CommandForm({
  action,
  label,
  confirm,
}: {
  action: (state: ActionResult, data: FormData) => Promise<ActionResult>;
  label: string;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => confirm && !window.confirm(confirm) && event.preventDefault()}
    >
      <FormMessage result={state} />
      <SubmitButton>{label}</SubmitButton>
    </form>
  );
}
