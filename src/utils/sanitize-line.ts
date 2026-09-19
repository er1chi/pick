export function sanitizeLine(text: string): string {
  return text
    .replace(/\s*[\r\n]+\s*/g, " ")
    .replace(/\t/g, " ")
    .trimEnd();
}
