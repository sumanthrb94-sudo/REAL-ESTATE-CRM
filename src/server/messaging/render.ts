// Merge-tag rendering for message templates.
//
// The template editor inserts {{name}} and {{project}} but nothing ever
// replaced them, so a recipient would have received the literal braces. This
// is that missing step.

/** Matches {{ token }} with any surrounding whitespace. */
const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export interface RenderResult {
  text: string;
  /** Tokens present in the template that had no value. */
  missing: string[];
}

export function renderTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>,
): RenderResult {
  const missing: string[] = [];
  const text = template.replace(TOKEN, (_match, key: string) => {
    const value = variables[key];
    if (value === undefined || value === null || value === "") {
      missing.push(key);
      return "";
    }
    return String(value);
  });
  return { text, missing };
}

/**
 * Renders, or refuses.
 *
 * Sending "Hi , thanks for your interest in " to a buyer is worse than sending
 * nothing, so a missing variable is an error rather than a silent blank. The
 * caller decides whether to fix the data or drop the recipient.
 */
export function renderStrict(
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  const { text, missing } = renderTemplate(template, variables);
  if (missing.length) {
    const unique = [...new Set(missing)];
    throw new Error(
      `Template is missing ${unique.length === 1 ? "a value" : "values"} for ${unique
        .map((m) => `{{${m}}}`)
        .join(", ")}.`,
    );
  }
  return text;
}

/** Tokens a template expects, so the editor can show what it needs. */
export function templateVariables(template: string): string[] {
  return [...new Set([...template.matchAll(TOKEN)].map((m) => m[1] ?? "").filter(Boolean))];
}
