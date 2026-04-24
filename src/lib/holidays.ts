/**
 * Brazilian + Pernambuco + Recife (municipal) holidays.
 * Used by the Dashboard's "Meta Diária Dinâmica" formula to count remaining
 * business days for the current month, excluding weekends and holidays.
 */

import {
  startOfMonth, endOfMonth, eachDayOfInterval, addDays, isAfter, isBefore, format,
} from 'date-fns';

/** Computus — returns the date of Easter Sunday for a given year (Gregorian). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

/** Returns the set of holiday ISO dates for Recife/PE/Brazil for the given year. */
export function holidaysForYear(year: number): Set<string> {
  const set = new Set<string>();
  // Fixed national
  set.add(`${year}-01-01`); // Confraternização Universal
  set.add(`${year}-04-21`); // Tiradentes
  set.add(`${year}-05-01`); // Dia do Trabalho
  set.add(`${year}-09-07`); // Independência
  set.add(`${year}-10-12`); // Nossa Senhora Aparecida
  set.add(`${year}-11-02`); // Finados
  set.add(`${year}-11-15`); // Proclamação da República
  set.add(`${year}-11-20`); // Consciência Negra (federal a partir de 2024)
  set.add(`${year}-12-25`); // Natal
  // Pernambuco
  set.add(`${year}-06-24`); // São João — feriado estadual
  // Recife (municipal)
  set.add(`${year}-12-08`); // Nossa Senhora da Conceição

  // Movable based on Easter
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);     // Sexta-feira Santa
  const carnivalTue = addDays(easter, -47);   // Carnaval (terça)
  const carnivalMon = addDays(easter, -48);   // Carnaval (segunda)
  const corpusChristi = addDays(easter, 60);  // Corpus Christi

  set.add(iso(goodFriday));
  set.add(iso(carnivalMon));
  set.add(iso(carnivalTue));
  set.add(iso(corpusChristi));

  return set;
}

/** True if a given date is a business day in Recife (Mon-Fri and not a holiday). */
export function isBusinessDay(d: Date): boolean {
  const w = d.getDay();
  if (w === 0 || w === 6) return false;
  const set = holidaysForYear(d.getFullYear());
  return !set.has(iso(d));
}

/** Counts business days remaining in the month from today (inclusive if today is a business day). */
export function remainingBusinessDaysInMonth(year: number, month: number): number {
  const today = new Date();
  const isCurMonth = today.getFullYear() === year && today.getMonth() === month;
  const monthEnd = endOfMonth(new Date(year, month, 1));
  if (isCurMonth) {
    if (isAfter(today, monthEnd)) return 0;
    return eachDayOfInterval({ start: today, end: monthEnd }).filter(isBusinessDay).length;
  }
  // Future month: full month. Past month: zero remaining.
  if (isAfter(monthEnd, today)) {
    return eachDayOfInterval({
      start: startOfMonth(new Date(year, month, 1)), end: monthEnd,
    }).filter(isBusinessDay).length;
  }
  return 0;
}

/** Business days elapsed in the month up to today (inclusive). */
export function elapsedBusinessDaysInMonth(year: number, month: number): number {
  const today = new Date();
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(new Date(year, month, 1));
  const end = today.getFullYear() === year && today.getMonth() === month ? today : monthEnd;
  if (isBefore(end, monthStart)) return 0;
  return eachDayOfInterval({ start: monthStart, end }).filter(isBusinessDay).length;
}
