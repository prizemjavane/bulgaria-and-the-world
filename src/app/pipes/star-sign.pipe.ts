import { Pipe, PipeTransform } from '@angular/core';
import { SourceDate } from '../models/timeline';

interface ZodiacSign {
  symbol: string;
  name: string;
}

const SIGNS: ZodiacSign[] = [
  { symbol: '♑', name: 'Козирог' },
  { symbol: '♒', name: 'Водолей' },
  { symbol: '♓', name: 'Риби' },
  { symbol: '♈', name: 'Овен' },
  { symbol: '♉', name: 'Телец' },
  { symbol: '♊', name: 'Близнаци' },
  { symbol: '♋', name: 'Рак' },
  { symbol: '♌', name: 'Лъв' },
  { symbol: '♍', name: 'Дева' },
  { symbol: '♎', name: 'Везни' },
  { symbol: '♏', name: 'Скорпион' },
  { symbol: '♐', name: 'Стрелец' },
];

/** Returns the zodiac sign for a given month (1–12) and day (1–31). */
function signFor(month: number, day: number): ZodiacSign {
  const d = month * 100 + day;
  if (d >= 1222 || d <= 119) return SIGNS[0]; // Козирог
  if (d <= 218) return SIGNS[1]; // Водолей
  if (d <= 320) return SIGNS[2]; // Риби
  if (d <= 419) return SIGNS[3]; // Овен
  if (d <= 520) return SIGNS[4]; // Телец
  if (d <= 620) return SIGNS[5]; // Близнаци
  if (d <= 722) return SIGNS[6]; // Рак
  if (d <= 822) return SIGNS[7]; // Лъв
  if (d <= 922) return SIGNS[8]; // Дева
  if (d <= 1022) return SIGNS[9]; // Везни
  if (d <= 1121) return SIGNS[10]; // Скорпион
  return SIGNS[11]; // Стрелец
}

function formatSign(s: ZodiacSign): string {
  return `${s.symbol} ${s.name}`;
}

/**
 * Returns a zodiac sign string (Bulgarian) for a SourceDate.
 * - Full date (date string with day): exact sign, e.g. "♋ Рак"
 * - Month-only (dateMonth set, no day): both possibilities, e.g. "♋ Рак / ♌ Лъв"
 * - Year-only or null: empty string
 */
export function getStarSign(birthDate: SourceDate | null | undefined): string {
  if (!birthDate) return '';

  // Full date string (includes day) — e.g. "1900-07-12" or "-0044-03-15"
  if (birthDate.date) {
    const match = birthDate.date.match(/^-?\d+-(\d{2})-(\d{2})$/);
    if (match) {
      const month = parseInt(match[1], 10);
      const day = parseInt(match[2], 10);
      return formatSign(signFor(month, day));
    }
  }

  // Month-level precision: two possible signs
  if (birthDate.dateMonth != null) {
    const m = birthDate.dateMonth;
    const early = signFor(m, 1);
    const late = signFor(m, 28);
    if (early.name === late.name) return formatSign(early);
    return `${formatSign(early)} / ${formatSign(late)}`;
  }

  return '';
}

@Pipe({ name: 'starSign', standalone: true })
export class StarSignPipe implements PipeTransform {
  transform(birthDate: SourceDate | null | undefined): string {
    return getStarSign(birthDate);
  }
}
