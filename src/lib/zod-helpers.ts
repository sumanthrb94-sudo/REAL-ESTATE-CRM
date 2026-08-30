// Shared Zod preprocessors for HTML form input.
//
// FormData.get() returns null for a field that was never rendered (a
// conditionally shown input, say) and "" for one rendered but left blank.
// Both mean "the user gave us nothing", so both must become undefined before
// an .optional() schema sees them — otherwise null reaches z.string() and the
// whole form fails with "Expected string, received null". That is exactly what
// made the activity form reject every non-TASK activity: dueAt is only
// rendered for tasks, so every call, email and WhatsApp log arrived as null.

/** Treat null, undefined and whitespace-only strings as "not provided". */
export function blankToUndefined(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}
