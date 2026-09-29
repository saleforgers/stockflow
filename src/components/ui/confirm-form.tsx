"use client";

import { useFormStatus } from "react-dom";

function ConfirmButton({ label, question }: { label: string; question: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn-secondary text-xs"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(question)) event.preventDefault();
      }}
      type="submit"
    >
      {pending ? "Working…" : label}
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
