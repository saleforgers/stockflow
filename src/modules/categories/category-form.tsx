"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { INITIAL_ACTION_RESULT, type ActionResult } from "@/lib/actions/action-result";

export function CategoryForm({
  action,
  category,
  parents,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  category?: { name: string; slug: string; description: string | null; parentId: string | null };
  parents: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(action, INITIAL_ACTION_RESULT);
  return (
    <form action={formAction} className="card max-w-2xl space-y-5 p-6">
      <FormMessage result={state} />
      <FormField htmlFor="name" label="Category name" required>
        <input
          className="input"
          defaultValue={category?.name}
          id="name"
          maxLength={100}
          name="name"
          required
        />
      </FormField>
      <FormField htmlFor="slug" label="Slug" hint="Leave blank to generate it from the name.">
        <input
          className="input"
          defaultValue={category?.slug}
          id="slug"
          maxLength={120}
          name="slug"
        />
      </FormField>
      <FormField htmlFor="parentId" label="Parent category">
        <select
          className="input"
          defaultValue={category?.parentId ?? ""}
          id="parentId"
          name="parentId"
        >
          <option value="">No parent</option>
          {parents.map((parent) => (
            <option key={parent.id} value={parent.id}>
              {parent.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField htmlFor="description" label="Description">
        <textarea
          className="input min-h-28"
          defaultValue={category?.description ?? ""}
          id="description"
          maxLength={1000}
          name="description"
        />
      </FormField>
      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <SubmitButton />
        <Link className="btn-secondary" href="/categories">
          Cancel
        </Link>
      </div>
    </form>
  );
}
