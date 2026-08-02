/**
 * 美国联邦假日，按固定规则本地计算，不依赖外部日历 API —— 自托管场景不引入网络依赖，
 * 也不需要每年维护一份静态列表。规则来自 5 U.S.C. § 6103，只覆盖联邦假日，不含各州自定假日。
 */

export interface UsHoliday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** 某月第 n 个星期几（weekday: 0=周日..6=周六，month: 1-12） */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + offset + (n - 1) * 7);
}

/** 某月最后一个星期几 */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return addDays(last, -offset);
}

/** 联邦假日固定日期若落在周六顺延到周五、落在周日顺延到周一 */
function observed(d: Date): Date {
  if (d.getDay() === 6) return addDays(d, -1);
  if (d.getDay() === 0) return addDays(d, 1);
  return d;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getUsFederalHolidays(year: number): UsHoliday[] {
  const raw: Array<{ date: Date; name: string }> = [
    { date: observed(new Date(year, 0, 1)), name: "New Year's Day" },
    { date: nthWeekdayOfMonth(year, 1, 1, 3), name: 'Martin Luther King Jr. Day' },
    { date: nthWeekdayOfMonth(year, 2, 1, 3), name: "Washington's Birthday" },
    { date: lastWeekdayOfMonth(year, 5, 1), name: 'Memorial Day' },
    { date: observed(new Date(year, 5, 19)), name: 'Juneteenth' },
    { date: observed(new Date(year, 6, 4)), name: 'Independence Day' },
    { date: nthWeekdayOfMonth(year, 9, 1, 1), name: 'Labor Day' },
    { date: nthWeekdayOfMonth(year, 10, 1, 2), name: 'Columbus Day' },
    { date: observed(new Date(year, 10, 11)), name: 'Veterans Day' },
    { date: nthWeekdayOfMonth(year, 11, 4, 4), name: 'Thanksgiving Day' },
    { date: observed(new Date(year, 11, 25)), name: 'Christmas Day' },
  ];
  return raw
    .map((h) => ({ date: toDateKey(h.date), name: h.name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
