"use client";

import { useFormStatus } from "react-dom";

function ConfirmButton({ label, question }: { label: string; question: string }) {
  const { pending } = useFormStatus();
  const isDanger = label.toLowerCase().includes("deactivate") || label.toLowerCase().includes("delete");
  return (
    <button
      className={isDanger ? "btn-danger text-xs" : "btn-secondary text-xs"}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(question)) event.preventDefault();
      }}
      type="submit"
    >
      {pending ? (
        <span className="flex items-center gap-1.5">
          <svg className="size-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Working…
        </span>
      ) : (
        label
      )}
    </button>
  );
}

export function ConfirmForm({
  action,
  label,
  question,
}: {
  action: () => void | Promise<void>;
  label: string;
  question: string;
}) {
  return (
    <form action={action}>
      <ConfirmButton label={label} question={question} />
    </form>
  );
}
