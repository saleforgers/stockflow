"use client";

import { useEffect, useRef, useState } from "react";

import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT } from "@/lib/actions/action-result";
import type {
  PartyOption,
  QuickPartyAction,
  QuickPartyActionResult,
} from "@/lib/parties/quick-create";

export function QuickPartyDialog({
  kind,
  open,
  action,
  onClose,
  onCreated,
}: {
  kind: "customer" | "supplier";
  open: boolean;
  action: QuickPartyAction;
  onClose: () => void;
  onCreated: (party: PartyOption) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<QuickPartyActionResult>(INITIAL_ACTION_RESULT);
  const title = kind === "customer" ? "Add New Customer" : "Add New Supplier";

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  return (
    <dialog className="form-dialog" ref={dialog} onCancel={onClose} onClose={onClose}>
      <form
        action={async (data) => {
          const next = await action(data);
          setResult(next);
          if (next.ok && "party" in next) {
            onCreated(next.party);
            form.current?.reset();
            setResult(INITIAL_ACTION_RESULT);
            onClose();
          }
        }}
        className="space-y-5 p-6"
        ref={form}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button aria-label="Close" className="btn-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <FormMessage result={result} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor={`quick-${kind}-name`}
            label={`${kind === "customer" ? "Customer" : "Supplier"} name`}
            required
          >
            <input
              className="input"
              id={`quick-${kind}-name`}
              maxLength={160}
              name="name"
              required
            />
          </FormField>
          {kind === "supplier" ? (
            <FormField htmlFor="quick-supplier-contact" label="Contact person">
              <input
                className="input"
                id="quick-supplier-contact"
                maxLength={120}
                name="contactPerson"
              />
            </FormField>
          ) : null}
          <FormField htmlFor={`quick-${kind}-phone`} label="Phone">
            <input className="input" id={`quick-${kind}-phone`} maxLength={40} name="phone" />
          </FormField>
          <FormField htmlFor={`quick-${kind}-email`} label="Email">
            <input
              className="input"
              id={`quick-${kind}-email`}
              maxLength={254}
              name="email"
              type="email"
            />
          </FormField>
        </div>
        <FormField htmlFor={`quick-${kind}-address`} label="Address">
          <textarea
            className="input min-h-20"
            id={`quick-${kind}-address`}
            maxLength={1000}
            name="address"
          />
        </FormField>
        <FormField htmlFor={`quick-${kind}-notes`} label="Notes">
          <textarea
            className="input min-h-20"
            id={`quick-${kind}-notes`}
            maxLength={2000}
            name="notes"
          />
        </FormField>
        <div className="flex gap-3 border-t border-slate-200 pt-4">
          <SubmitButton>{kind === "customer" ? "Add Customer" : "Add Supplier"}</SubmitButton>
          <button className="btn-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
