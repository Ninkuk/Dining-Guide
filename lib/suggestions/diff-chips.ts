// Render a `FieldChange` from `diffCorrection` as a label/detail pair the
// queue can show as a chip. The hard problem the helper solves: cuisine
// arrays and locations arrays don't read well as "old → new" raw — cuisine
// reads better as "+X, −Y" and locations are too verbose to inline, so we
// collapse them to a count.

import type { FieldChange } from "./merge";

export type DiffChip = { label: string; detail: string };

export function formatDiffChip(change: FieldChange): DiffChip {
  const label = change.field;
  switch (change.field) {
    case "cuisine":
      return { label, detail: formatStringArray(change.from, change.to) };
    case "locations":
      return { label, detail: formatLocationsCount(change.from, change.to) };
    case "photo_url":
      return { label, detail: formatPhoto(change.from, change.to) };
    default:
      return { label, detail: `${formatScalar(change.from)} → ${formatScalar(change.to)}` };
  }
}

function formatScalar(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function formatStringArray(from: unknown, to: unknown): string {
  const a = Array.isArray(from) ? (from as string[]) : [];
  const b = Array.isArray(to) ? (to as string[]) : [];
  const added = b.filter((x) => !a.includes(x));
  const removed = a.filter((x) => !b.includes(x));
  const parts: string[] = [];
  if (added.length) parts.push(added.map((x) => `+${x}`).join(", "));
  if (removed.length) parts.push(removed.map((x) => `−${x}`).join(", "));
  return parts.join(" · ");
}

function formatLocationsCount(from: unknown, to: unknown): string {
  const a = Array.isArray(from) ? from.length : 0;
  const b = Array.isArray(to) ? to.length : 0;
  const unit = b === 1 ? "location" : "locations";
  return `${a} → ${b} ${unit}`;
}

function formatPhoto(from: unknown, to: unknown): string {
  if (from == null && to != null) return "added";
  if (from != null && to == null) return "removed";
  return "replaced";
}
