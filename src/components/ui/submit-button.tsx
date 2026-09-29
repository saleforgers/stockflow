"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children = "Save" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending} type="submit">
      {pending ? (
        <span className="flex items-center gap-2">
          <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Saving…
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {children}
        </span>
      )}
    </button>
  );
}
