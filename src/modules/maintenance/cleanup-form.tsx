"use client";
import { useActionState, useState } from "react";
import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";
import { FormMessage } from "@/components/ui/form-message";
import { cleanupDemoAction } from "./actions";
export function CleanupForm({ fingerprint }: { fingerprint: string }) {
  const [state, action, pending] = useActionState(cleanupDemoAction, INITIAL_ACTION_RESULT);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [confirmed, setConfirmed] = useState("");
  return (
    <form action={action} className="card space-y-4 border-rose-200 p-6">
      <h2 className="font-semibold">Remove Recognized Test Data</h2>
      <p className="text-sm text-slate-600">
        Only the records listed above will be removed. A permanent backup is saved automatically.
        Document numbers will not be reused.
      </p>
      <input type="hidden" name="fingerprint" value={fingerprint} />
      <input type="hidden" name="requestKey" value={requestKey} />
      <label className="block text-sm font-medium">
        Type REMOVE DEMO to confirm
        <input
          className="input mt-2 max-w-sm"
          name="confirmation"
          value={confirmed}
          onChange={(e) => setConfirmed(e.target.value)}
          autoComplete="off"
        />
      </label>
      <FormMessage result={state} />
      <button className="btn-danger" disabled={pending || confirmed !== "REMOVE DEMO"}>
        {pending ? "Saving backup and removing…" : "Remove Demo Test Data"}
      </button>
    </form>
  );
}
