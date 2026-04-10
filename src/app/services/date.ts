import moment from 'moment/moment';
import { SourceDate, TimelineAreaDate } from '../models/timeline';

export const BG_MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември'];

export type DatePrecision = 'year' | 'month' | 'day';

export function getDatePrecision(sd?: SourceDate): DatePrecision {
  if (!sd) return 'day';
  if (sd.dateYear != null && sd.dateMonth == null) return 'year';
  if (sd.dateYear != null && sd.dateMonth != null && !sd.date) return 'month';
  return 'day';
}

export function getCoarsestPrecision(a?: SourceDate, b?: SourceDate): DatePrecision {
  const order: DatePrecision[] = ['year', 'month', 'day'];
  return order[Math.min(order.indexOf(getDatePrecision(a)), order.indexOf(getDatePrecision(b)))];
}

function formatYear(year: number): string {
  const absYear = Math.abs(year);
  const bce = year < 0 ? ' пр.н.е.' : '';
  return `${absYear} г.${bce}`;
}

/** Formats a raw date string or timestamp to full Bulgarian date (d M Y г.) via moment.js. Modern dates only. */
export function formatDate(date?: string | number): string {
  const d = moment(date);
  return `${d.date()} ${BG_MONTHS[d.month()]} ${d.year()} г.`;
}

/** Calculates and formats duration between two dates in Bulgarian (години, месеца, дни). Respects precision level. */
export function formatDateDiff(from: string | number, to: string | number, precision: DatePrecision = 'day'): string {
  let endTimestamp = to;

  if (endTimestamp === null) {
    endTimestamp = new Date().getTime();
  }

  const startDate = moment(from);
  const endDate = moment(endTimestamp);

  const years = endDate.diff(startDate, 'years');
  startDate.add(years, 'years');

  const parts = [];

  if (years > 0) {
    parts.push(`${years} ${years !== 1 ? 'години' : 'година'}`);
  }

  if (precision === 'year') return parts.join(', ');

  const months = endDate.diff(startDate, 'months');
  startDate.add(months, 'months');

  if (months > 0) {
    parts.push(`${months} ${months !== 1 ? 'месеца' : 'месец'}`);
  }

  if (precision === 'month') return parts.join(', ');

  const days = endDate.diff(startDate, 'days');

  if (days > 0) {
    parts.push(`${days} ${days !== 1 ? 'дни' : 'ден'}`);
  }

  return parts.join(', ');
}

/** Resolves a SourceDate to an ISO-like date string for chart positioning. */
export function resolveSourceDate(sd: SourceDate): string {
  if (sd.date) return sd.date;
  const year = sd.dateYear!;
  const yearStr = year < 0
    ? `-${String(Math.abs(year)).padStart(6, '0')}`
    : String(year).padStart(4, '0');
  if (sd.dateMonth) {
    return `${yearStr}-${String(sd.dateMonth).padStart(2, '0')}-01`;
  }
  return `${yearStr}-01-01`;
}

/** Formats a SourceDate at its native precision (year-only, month+year, or full date). Handles BCE. */
export function formatSourceDate(sd: SourceDate): string {
  // dateYear without dateMonth signals year-only precision even when date is also set
  if (sd.dateYear != null && sd.dateMonth == null) {
    return formatYear(sd.dateYear);
  }
  if (sd.date) {
    const match = sd.date.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
    if (!match) return sd.date;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    return `${day} ${BG_MONTHS[month - 1]} ${formatYear(year)}`;
  }
  if (sd.dateYear != null && sd.dateMonth != null) {
    return `${BG_MONTHS[sd.dateMonth - 1]} ${formatYear(sd.dateYear)}`;
  }
  return '';
}

/** Parses an extended-year date string (including BCE) to full Bulgarian date. */
export function formatRangeDate(dateStr: string): string {
  const match = dateStr.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  return `${day} ${BG_MONTHS[month - 1]} ${formatYear(year)}`;
}

/** Formats a range date string at the precision level indicated by a SourceDate. */
function formatAtPrecision(rangeDate: string, precision: SourceDate): string {
  const match = rangeDate.match(/^(-?\d+)-(\d{2})-(\d{2})$/);
  if (!match) return rangeDate;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // dateYear without dateMonth signals year-only precision even when date is also set
  if (precision.dateYear != null && precision.dateMonth == null) {
    return formatYear(year);
  }
  if (precision.date) {
    return `${day} ${BG_MONTHS[month - 1]} ${formatYear(year)}`;
  }
  if (precision.dateMonth != null) {
    return `${BG_MONTHS[month - 1]} ${formatYear(year)}`;
  }
  return formatYear(year);
}

/** Formats a TimelineAreaDate range. Dates come from range[]; from/to only control precision. */
export function formatTimelineDate(date: TimelineAreaDate): string {
  const fromStr = date.from ? formatAtPrecision(date.range[0], date.from) : formatRangeDate(date.range[0]);

  if (date.range[1] == null) {
    return `${fromStr} — до днес`;
  }

  const toStr = date.to ? formatAtPrecision(date.range[1], date.to) : formatRangeDate(date.range[1]);
  if (fromStr === toStr) {
    return fromStr;
  }

  if (fromStr.endsWith(' пр.н.е.') && toStr.endsWith(' пр.н.е.')) {
    return `${fromStr.replace(/ г\. пр\.н\.е\.$/, '')} — ${toStr}`;
  }

  return `${fromStr} — ${toStr}`;
}
