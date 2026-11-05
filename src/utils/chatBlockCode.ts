/**
 * The chat block code a refused send carries, or undefined for any other
 * failure. The backend's lean error contract puts it in the top-level `code`;
 * a backend from before it sent it as the first text under
 * validationErrors.text. Read the new place first, then the old one, and
 * tolerate a body with neither (a 429, a gateway page, no network).
 */
export const chatBlockCodeOf = (error: unknown): string | undefined => {
  const data = (error as { data?: unknown } | null | undefined)?.data as
    { code?: unknown; validationErrors?: { text?: unknown } } | null | undefined
  const isBlock = (value: unknown): value is string =>
    typeof value === "string" && value.startsWith("CHAT_BLOCK_")

  if (isBlock(data?.code)) return data.code
  const text = data?.validationErrors?.text
  const first = Array.isArray(text) ? text[0] : undefined
  return isBlock(first) ? first : undefined
}
