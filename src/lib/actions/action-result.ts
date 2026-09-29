import { ApplicationError } from "@/lib/errors/application-error";

export type ActionResult =
  | { readonly ok: true; readonly message: string }
  | {
      readonly ok: false;
      readonly message: string;
      readonly fieldErrors?: Record<string, string[]>;
    };

export const INITIAL_ACTION_RESULT: ActionResult = { ok: true, message: "" };

export function toActionFailure(error: unknown): ActionResult {
  if (error instanceof ApplicationError) {
    const issues = error.details?.["issues"];
    const fieldErrors: Record<string, string[]> = {};

    if (Array.isArray(issues)) {
      for (const issue of issues) {
        if (typeof issue !== "object" || issue === null) continue;
        const path =
          "path" in issue && Array.isArray(issue.path) ? String(issue.path[0] ?? "form") : "form";
        const message = "message" in issue ? String(issue.message) : error.message;
        fieldErrors[path] ??= [];
        fieldErrors[path].push(message);
      }
    }

    return {
      ok: false,
      message: error.message,
      ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    };
  }

  console.error("Unexpected server action failure", error);
  return { ok: false, message: "The operation could not be completed. Please try again." };
}
