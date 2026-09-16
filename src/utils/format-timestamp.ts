import { presentText } from "@/utils/present-text";

const localDateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatPresentTimestamp(
  value: string | null | undefined,
): string | undefined {
  const text = presentText(value);
  if (text === undefined) {
    return undefined;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return localDateTime.format(date);
}

export function formatTimestamp(value: string | null | undefined): string {
  return formatPresentTimestamp(value) ?? "—";
}
