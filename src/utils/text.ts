export function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((candidate) => candidate.trim() !== "");
  return line?.trim() ?? text;
}

export function sanitizeLine(text: string): string {
  return text
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/\t/g, " ")
    .trimEnd();
}

export function presentText(
  value: string | null | undefined,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }
  return trimmed;
}

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
