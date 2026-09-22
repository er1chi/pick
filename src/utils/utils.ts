export function firstLine(text: string): string {
  const line = text.split(/\r?\n/).find((candidate) => candidate.trim() !== "");
  return line?.trim() ?? text;
}
