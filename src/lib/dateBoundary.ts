/** Convert a local date filter to an inclusive UTC boundary without loading role policies. */
export function movementDateBoundary(input: string, end = false): string | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(
      input,
    );
  if (!match) return null;
  const [, yy, mm, dd, hh, min, ss, zone] = match;
  const year = Number(yy),
    month = Number(mm),
    day = Number(dd);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1000 ||
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    Number(hh ?? 0) > 23 ||
    Number(min ?? 0) > 59 ||
    Number(ss ?? 0) > 59
  )
    return null;
  const date = zone
    ? new Date(input)
    : new Date(
        year,
        month - 1,
        day,
        hh ? Number(hh) : end ? 23 : 0,
        min ? Number(min) : end ? 59 : 0,
        ss ? Number(ss) : !hh && end ? 59 : 0,
        !hh && end ? 999 : 0,
      );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
