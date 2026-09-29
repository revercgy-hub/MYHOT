/** Parses a source date, applying its wall-clock offset only to dates with no explicit zone. */
export function parseLooseDate(value: string | null | undefined, utcOffset = "+08:00"): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  // Date.parse treats YYYY-MM-DD as UTC and zone-less timestamps in the process zone. A source's
  // calendar date instead belongs to its configured wall-clock offset, independent of the host.
  const calendar = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?(Z|[+-]\d{2}:?\d{2})?$/i.exec(v)
    ?? /^(\d{4})年(\d{1,2})月(\d{1,2})日?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?(Z|[+-]\d{2}:?\d{2})?$/i.exec(v);
  if (calendar) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText, explicitZone] = calendar;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText ?? 0);
    const minute = Number(minuteText ?? 0);
    const second = Number(secondText ?? 0);
    const daysInMonth = month >= 1 && month <= 12
      ? [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!
      : 0;
    if (day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) return null;
    if (explicitZone) {
      // Let Date.parse handle the instant after rejecting invalid calendar/time components.
      if (explicitZone.toUpperCase() !== "Z") {
        const offset = /^([+-])(\d{2}):?(\d{2})$/.exec(explicitZone);
        if (!offset) return null;
        const offsetHours = Number(offset[2]);
        const offsetMinutes = Number(offset[3]);
        if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return null;
      }
      const direct = Date.parse(v);
      return Number.isFinite(direct) ? new Date(direct) : null;
    }
    const sourceOffset = /^(?:Z|[+-](?:0\d|1[0-4]):?[0-5]\d)$/i.test(utcOffset) ? utcOffset : null;
    if (!sourceOffset) return null;
    if (/^[+-]14:?([0-5]\d)$/.test(sourceOffset) && !/^[+-]14:?00$/.test(sourceOffset)) return null;
    const zone = sourceOffset.toUpperCase() === "Z" ? "+00:00"
      : sourceOffset.includes(":") ? sourceOffset : `${sourceOffset.slice(0, 3)}:${sourceOffset.slice(3)}`;
    const dateTime = `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` +
      `T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}` +
      `${millisecondText ? `.${millisecondText.padEnd(3, "0")}` : ""}${zone}`;
    const parsed = Date.parse(dateTime);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }

  const direct = Date.parse(v);
  if (Number.isFinite(direct) && /\d{4}/.test(v)) return new Date(direct);
  // "Sep 26, 2026"
  const en = Date.parse(v.replace(/(\d)(st|nd|rd|th)/, "$1"));
  return Number.isFinite(en) ? new Date(en) : null;
}
