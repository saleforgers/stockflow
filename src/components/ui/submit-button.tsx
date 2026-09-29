"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children = "Save" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending} type="submit">
      {pending ? "Saving…" : children}
    </button>
  );
}
