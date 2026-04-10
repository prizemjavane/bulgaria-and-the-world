import { describe, expect, it } from 'vitest';
import { formatDate, formatDateDiff, formatRangeDate, formatSourceDate, formatTimelineDate, getCoarsestPrecision, getDatePrecision } from './date';
import { SourceDate, TimelineAreaDate } from '../models/timeline';

describe('formatDate', () => {
  it('formats a modern date string', () => {
    expect(formatDate('2007-01-01')).toBe('1 януари 2007 г.');
  });

  it('formats a date with day and month', () => {
    expect(formatDate('1908-09-22')).toBe('22 септември 1908 г.');
  });

  it('formats a timestamp', () => {
    // 2007-01-01T00:00:00Z
    expect(formatDate(1167609600000)).toBe('1 януари 2007 г.');
  });

  it('formats mid-year date', () => {
    expect(formatDate('2023-06-15')).toBe('15 юни 2023 г.');
  });

  it('formats December date', () => {
    expect(formatDate('1989-12-25')).toBe('25 декември 1989 г.');
  });
});

describe('formatDateDiff', () => {
  it('formats years only', () => {
    expect(formatDateDiff('2000-01-01', '2005-01-01')).toBe('5 години');
  });

  it('formats single year', () => {
    expect(formatDateDiff('2000-01-01', '2001-01-01')).toBe('1 година');
  });

  it('formats months only', () => {
    expect(formatDateDiff('2000-01-01', '2000-04-01')).toBe('3 месеца');
  });

  it('formats single month', () => {
    expect(formatDateDiff('2000-01-01', '2000-02-01')).toBe('1 месец');
  });

  it('formats days only', () => {
    expect(formatDateDiff('2000-01-01', '2000-01-15')).toBe('14 дни');
  });

  it('formats single day', () => {
    expect(formatDateDiff('2000-01-01', '2000-01-02')).toBe('1 ден');
  });

  it('formats years and months', () => {
    expect(formatDateDiff('2000-01-01', '2002-06-01')).toBe('2 години, 5 месеца');
  });

  it('formats years, months, and days', () => {
    expect(formatDateDiff('2000-01-01', '2002-06-15')).toBe('2 години, 5 месеца, 14 дни');
  });

  it('returns empty string for same date', () => {
    expect(formatDateDiff('2000-01-01', '2000-01-01')).toBe('');
  });

  it('formats with year precision only', () => {
    expect(formatDateDiff('2000-01-01', '2002-06-15', 'year')).toBe('2 години');
  });

  it('formats with month precision', () => {
    expect(formatDateDiff('2000-01-01', '2002-06-15', 'month')).toBe('2 години, 5 месеца');
  });

  it('formats with day precision (default)', () => {
    expect(formatDateDiff('2000-01-01', '2002-06-15', 'day')).toBe('2 години, 5 месеца, 14 дни');
  });
});

describe('getDatePrecision', () => {
  it('returns year for dateYear only', () => {
    expect(getDatePrecision({ dateYear: 1850 })).toBe('year');
  });

  it('returns month for dateYear + dateMonth', () => {
    expect(getDatePrecision({ dateYear: 1850, dateMonth: 3 })).toBe('month');
  });

  it('returns day for full date', () => {
    expect(getDatePrecision({ date: '1850-03-15' })).toBe('day');
  });

  it('returns day for undefined', () => {
    expect(getDatePrecision(undefined)).toBe('day');
  });
});

describe('getCoarsestPrecision', () => {
  it('returns year when one side is year-only', () => {
    expect(getCoarsestPrecision({ dateYear: 1850 }, { date: '1900-01-01' })).toBe('year');
  });

  it('returns month when coarsest is month', () => {
    expect(getCoarsestPrecision({ dateYear: 1850, dateMonth: 3 }, { date: '1900-01-01' })).toBe('month');
  });

  it('returns day when both are full dates', () => {
    expect(getCoarsestPrecision({ date: '1850-03-15' }, { date: '1900-01-01' })).toBe('day');
  });
});

describe('formatRangeDate', () => {
  it('formats a modern date string', () => {
    expect(formatRangeDate('2007-01-01')).toBe('1 януари 2007 г.');
  });

  it('formats a BCE date string', () => {
    expect(formatRangeDate('-000551-01-01')).toBe('1 януари 551 г. пр.н.е.');
  });

  it('formats a CE date with zero-padded year', () => {
    expect(formatRangeDate('0632-06-08')).toBe('8 юни 632 г.');
  });

  it('returns input for non-matching string', () => {
    expect(formatRangeDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatSourceDate', () => {
  it('formats year-only (CE)', () => {
    expect(formatSourceDate({ dateYear: 1908 })).toBe('1908 г.');
  });

  it('formats year-only (BCE)', () => {
    expect(formatSourceDate({ dateYear: -551 })).toBe('551 г. пр.н.е.');
  });

  it('formats year+month (CE)', () => {
    expect(formatSourceDate({ dateYear: 570, dateMonth: 4 })).toBe('април 570 г.');
  });

  it('formats year+month (BCE)', () => {
    expect(formatSourceDate({ dateYear: -69, dateMonth: 1 })).toBe('януари 69 г. пр.н.е.');
  });

  it('formats full date (CE)', () => {
    expect(formatSourceDate({ date: '0632-06-08' })).toBe('8 юни 632 г.');
  });

  it('formats full date (BCE)', () => {
    expect(formatSourceDate({ date: '-000551-01-01' })).toBe('1 януари 551 г. пр.н.е.');
  });

  it('formats modern full date', () => {
    expect(formatSourceDate({ date: '2007-01-01' })).toBe('1 януари 2007 г.');
  });

  it('returns empty string for empty object', () => {
    expect(formatSourceDate({} as SourceDate)).toBe('');
  });

  it('prefers date field over dateYear/dateMonth when dateMonth is present', () => {
    expect(formatSourceDate({ date: '1908-09-22', dateYear: 1908, dateMonth: 9 } as any)).toBe('22 септември 1908 г.');
  });

  it('uses year-only precision when dateYear is set without dateMonth, even if date is also set', () => {
    expect(formatSourceDate({ date: '0988-01-01', dateYear: 988 } as any)).toBe('988 г.');
  });
});

describe('formatTimelineDate', () => {
  it('formats year-only range (BCE)', () => {
    const date: TimelineAreaDate = {
      range: ['-000551-01-01', '-000479-12-31'],
      from: { dateYear: -551 },
      to: { dateYear: -479 },
    };
    expect(formatTimelineDate(date)).toBe('551 — 479 г. пр.н.е.');
  });

  it('formats mixed precision (year from, full date to)', () => {
    const date: TimelineAreaDate = {
      range: ['0570-04-01', '0632-06-08'],
      from: { dateYear: 570 },
      to: { date: '0632-06-08' },
    };
    expect(formatTimelineDate(date)).toBe('570 г. — 8 юни 632 г.');
  });

  it('formats year+month from, year+month to', () => {
    const date: TimelineAreaDate = {
      range: ['-000069-01-01', '-000030-08-31'],
      from: { dateYear: -69, dateMonth: 1 },
      to: { dateYear: -30, dateMonth: 8 },
    };
    expect(formatTimelineDate(date)).toBe('януари 69 — август 30 г. пр.н.е.');
  });

  it('formats ongoing (null end date)', () => {
    const date: TimelineAreaDate = {
      range: ['1989-11-10', null],
      from: { date: '1989-11-10' },
    };
    expect(formatTimelineDate(date)).toBe('10 ноември 1989 г. — до днес');
  });

  it('falls back to range when from/to are missing', () => {
    const date: TimelineAreaDate = {
      range: ['2007-01-01', '2023-12-31'],
    };
    expect(formatTimelineDate(date)).toBe('1 януари 2007 г. — 31 декември 2023 г.');
  });

  it('uses from precision but falls back to range for to', () => {
    const date: TimelineAreaDate = {
      range: ['-001500-01-01', '-000480-01-01'],
      from: { dateYear: -1500 },
    };
    expect(formatTimelineDate(date)).toBe('1500 — 1 януари 480 г. пр.н.е.');
  });

  it('formats full date range (both sides)', () => {
    const date: TimelineAreaDate = {
      range: ['1878-03-03', '1908-09-22'],
      from: { date: '1878-03-03' },
      to: { date: '1908-09-22' },
    };
    expect(formatTimelineDate(date)).toBe('3 март 1878 г. — 22 септември 1908 г.');
  });

  it('handles BCE to CE range', () => {
    const date: TimelineAreaDate = {
      range: ['-000480-01-01', '0046-01-01'],
      from: { dateYear: -480 },
      to: { dateYear: 46 },
    };
    expect(formatTimelineDate(date)).toBe('480 г. пр.н.е. — 46 г.');
  });

  it('uses range dates, not from/to values, for display', () => {
    const date: TimelineAreaDate = {
      range: ['-001813-01-01', '-001638-12-31'],
      from: { dateYear: -2000 },
      to: { dateYear: -1638 },
    };
    expect(formatTimelineDate(date)).toBe('1813 — 1638 г. пр.н.е.');
  });

  it('formats ongoing with year-only from', () => {
    const date: TimelineAreaDate = {
      range: ['1989-01-01', null],
      from: { dateYear: 1989 },
    };
    expect(formatTimelineDate(date)).toBe('1989 г. — до днес');
  });
});
