/**
 * Filters a string to allow only digits, a single decimal point, and optional commas.
 * Returns the sanitized value.
 */
export function filterNumericValue(value: string): string {
  // Remove everything except digits, decimal point, and comma
  let filtered = value.replace(/[^0-9.,]/g, "");
  // Ensure only one decimal point
  const parts = filtered.split(".");
  if (parts.length > 2) {
    filtered = parts[0] + "." + parts.slice(1).join("");
  }
  return filtered;
}

/**
 * onInput handler for raw <input> elements to restrict to numeric entry.
 * Usage: <input onInput={handleNumericInput} ... />
 */
export function handleNumericInput(e: React.FormEvent<HTMLInputElement>) {
  const input = e.currentTarget;
  input.value = filterNumericValue(input.value);
}
