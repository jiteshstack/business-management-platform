import "server-only";

// Shared shape for every create/edit Server Action used with useActionState.
//
// `values`/`attempt` exist purely so a failed submission can redisplay what
// the user typed: React resets uncontrolled form fields after any Server
// Action submission (success or failure), so without this the form would
// blank itself out every time a validation error is shown.
export type FormActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  attempt?: number;
};

export function firstFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): Record<string, string> {
  const { fieldErrors } = error.flatten();
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0]) out[key] = messages[0];
  }
  return out;
}

export function rawValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function nextAttempt(prevState: FormActionState): number {
  return (prevState.attempt ?? 0) + 1;
}

// FormData.get() returns null for a field that isn't in the form at all
// (e.g. a field only rendered in "create" mode is absent in "edit" mode) —
// zod's `.optional()` only accepts `undefined`, not `null`, so this
// normalizes "missing" to undefined before validation.
export function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}
