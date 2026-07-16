const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toWorkDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  if (!values.year || !values.month || !values.day) {
    throw new RangeError(
      "Unable to resolve a work date in the selected timezone.",
    );
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export function isWeekday(workDate: string): boolean {
  if (!DATE_PATTERN.test(workDate)) {
    throw new RangeError("Work dates must use YYYY-MM-DD format.");
  }

  const day = new Date(`${workDate}T12:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function compareWorkDates(left: string, right: string): number {
  if (!DATE_PATTERN.test(left) || !DATE_PATTERN.test(right)) {
    throw new RangeError("Work dates must use YYYY-MM-DD format.");
  }

  return left.localeCompare(right);
}
