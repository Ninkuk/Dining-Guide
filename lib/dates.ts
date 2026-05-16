// Date-only helpers (calendar dates with no time component, e.g. `visited_at`).
//
// Postgres `date` columns round-trip through Supabase as `YYYY-MM-DD` strings.
// The naïve `new Date("YYYY-MM-DD")` parses as UTC midnight and shifts the day
// for users west of UTC; `toISOString()` on a locally-constructed Date does the
// inverse. Use these helpers anywhere a date-only value is parsed, formatted,
// or serialized.

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = value.match(ISO_DATE_RE);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(d.getTime()) ? d : null;
}

export function serializeDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayDateOnly(): string {
  return serializeDateOnly(new Date());
}

export function formatDateOnly(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_FORMAT,
): string {
  const date = value instanceof Date ? value : parseDateOnly(value);
  if (!date) return "";
  return date.toLocaleDateString(undefined, options);
}
