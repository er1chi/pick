/**
 * Truncates a single line at the end: keeps whole characters and appends an
 * ellipsis when the text is wider than the available display columns.
 */
export function truncateEnd(text: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return "";
  }
  const characters = Array.from(text);
  if (characters.length <= maxWidth) {
    return text;
  }
  return `${characters.slice(0, maxWidth - 1).join("")}…`;
}
