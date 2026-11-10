/**
 * calc.js — Pure functions: dates, active days, week/month/job statistics.
 *
 * Rules:
 * - No DOM, no storage, no Date.now() calls inside. "today" and data are passed in.
 * - Week starts on Sunday (day 0).
 * - All day logic uses local date strings "YYYY-MM-DD".
 * - Sessions crossing midnight are split at local midnight.
 */

// ─── Date arithmetic helpers ─────────────────────────────────────────────────

/**
 * Parse "YYYY-MM-DD" to a UTC day number (integer).
 * Using Date.UTC avoids DST issues for day arithmetic.
 */
function dayNum(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/**
 * Convert a UTC day number back to "YYYY-MM-DD".
 */
function dayNumToStr(n) {
  const d = new Date(n * 86400000);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

/**
 * Convert an ISO timestamp to a local date string "YYYY-MM-DD".
 */
function isoToLocalDate(isoStr) {
  const d = new Date(isoStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

/**
 * Get the Sunday that starts the week containing dateStr.
 * Returns "YYYY-MM-DD".
 */
export function weekStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Sun
  date.setDate(d - dow);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Get the Saturday that ends the week.
 */
export function weekEnd(dateStr) {
  const start = weekStart(dateStr);
  const n = dayNum(start) + 6;
  return dayNumToStr(n);
}

/**
 * Returns "YYYY-MM-DD" of the first day of the month.
 */
export function monthStart(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/**
 * Returns "YYYY-MM-DD" of the last day of the month.
 */
export function monthEnd(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const last = new Date(y, m, 0); // day 0 of next month = last day of this month
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

/**
 * Enumerate all "YYYY-MM-DD" strings from startStr to endStr inclusive.
 */
export function dateRange(startStr, endStr) {
  const result = [];
  const a = dayNum(startStr);
  const b = dayNum(endStr);
  for (let n = a; n <= b; n++) result.push(dayNumToStr(n));
  return result;
}

// ─── Active days ─────────────────────────────────────────────────────────────

/**
 * Build a Set of active date strings for a job, up to endOfRange (inclusive).
 * Uses the job's periods array.
 * @param {object} job
 * @param {string} todayStr - "today" so open periods end here
 * @param {string} [endOfRange] - optional upper bound to limit the set
 */
export function activeDaySet(job, todayStr, endOfRange) {
  const result = new Set();
  for (const p of job.periods) {
    const pStart = p.start;
    const pEnd = p.end ?? todayStr;
    // Clamp to endOfRange if provided
    const rangeEnd = endOfRange && pEnd > endOfRange ? endOfRange : pEnd;
    if (pStart > rangeEnd) continue;
    const days = dateRange(pStart, rangeEnd);
    for (const day of days) result.add(day);
  }
  return result;
}

/**
 * Count active days for a job within a date range [rangeStart, rangeEnd].
 */
export function activeDaysInRange(job, rangeStart, rangeEnd, todayStr) {
  const all = activeDaySet(job, todayStr, rangeEnd);
  let count = 0;
  const a = dayNum(rangeStart);
  const b = dayNum(rangeEnd);
  for (let n = a; n <= b; n++) {
    if (all.has(dayNumToStr(n))) count++;
  }
  return count;
}

// ─── Session splitting ────────────────────────────────────────────────────────

/**
 * Split a session at local midnight boundaries.
 * Returns an array of { date: "YYYY-MM-DD", hours: number } objects.
 * @param {string} startISO
 * @param {string} endISO
 */
export function splitSessionByDay(startISO, endISO) {
  const result = [];
  let cur = new Date(startISO);
  const end = new Date(endISO);

  while (cur < end) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const d = cur.getDate();
    // Midnight of next local day
    const nextMidnight = new Date(y, m, d + 1, 0, 0, 0, 0);
    const segEnd = nextMidnight < end ? nextMidnight : end;
    const hours = (segEnd - cur) / 3600000;
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (hours > 0) result.push({ date: dateStr, hours });
    cur = segEnd;
  }
  return result;
}

/**
 * Build a map of { "YYYY-MM-DD": workedHours } for a job's sessions.
 * Soft-deleted sessions are excluded.
 * @param {Array} sessions - all sessions for this job
 */
export function workedHoursByDay(sessions) {
  const map = {};
  for (const s of sessions) {
    if (s.deletedAt) continue;
    const segs = splitSessionByDay(s.start, s.end);
    for (const seg of segs) {
      map[seg.date] = (map[seg.date] || 0) + seg.hours;
    }
  }
  return map;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

/**
 * Compute stats for a job over a date range.
 * @param {object} job
 * @param {Array}  sessions - sessions for this job (not soft-deleted)
 * @param {string} rangeStart "YYYY-MM-DD"
 * @param {string} rangeEnd   "YYYY-MM-DD"
 * @param {string} todayStr   "YYYY-MM-DD"
 * @param {object} [dayMap]   optional pre-built workedHoursByDay map
 * @returns {{ activeDays, requiredHours, workedHours, remaining, balance }}
 */
export function rangeStats(job, sessions, rangeStart, rangeEnd, todayStr, dayMap) {
  const map = dayMap || workedHoursByDay(sessions);
  const active = activeDaysInRange(job, rangeStart, rangeEnd, todayStr);
  const requiredHours = job.weeklyHours * (active / 7);

  let workedHours = 0;
  const a = dayNum(rangeStart);
  const b = dayNum(rangeEnd);
  for (let n = a; n <= b; n++) {
    const ds = dayNumToStr(n);
    if (map[ds]) workedHours += map[ds];
  }

  const remaining = requiredHours - workedHours; // negative = overtime
  const balance = workedHours - requiredHours;   // positive = surplus

  return { activeDays: active, requiredHours, workedHours, remaining, balance };
}

// ─── Week list ────────────────────────────────────────────────────────────────

/**
 * Generate a list of all ISO week ranges (Sun–Sat) from firstDay to lastDay,
 * plus the current week (even if partially beyond lastDay).
 * Returns array of { weekStart, weekEnd } strings.
 */
export function allWeeks(firstDay, lastDay, todayStr) {
  const weeks = [];
  const seen = new Set();
  // Include weeks from firstDay to max(lastDay, todayStr)
  const rangeEndStr = lastDay > todayStr ? lastDay : todayStr;
  let cur = weekStart(firstDay);
  while (cur <= rangeEndStr) {
    if (!seen.has(cur)) {
      seen.add(cur);
      weeks.push({ weekStart: cur, weekEnd: weekEnd(cur) });
    }
    // Advance by 7 days
    cur = dayNumToStr(dayNum(cur) + 7);
  }
  return weeks;
}

/**
 * Generate a list of all calendar months from firstDay to max(lastDay, todayStr).
 * Returns array of { monthStart, monthEnd, label } objects.
 */
export function allMonths(firstDay, lastDay, todayStr) {
  const months = [];
  const rangeEndStr = lastDay > todayStr ? lastDay : todayStr;
  let [y, m] = firstDay.split('-').map(Number);
  while (true) {
    const ms = `${y}-${String(m).padStart(2, '0')}-01`;
    if (ms > rangeEndStr) break;
    const me = monthEnd(ms);
    months.push({
      monthStart: ms,
      monthEnd: me,
      label: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

/**
 * Find the first active day across all periods of a job.
 */
export function jobFirstDay(job) {
  if (!job.periods || job.periods.length === 0) return null;
  return job.periods.reduce((min, p) => p.start < min ? p.start : min, job.periods[0].start);
}

/**
 * Find the last relevant day for a job (last period end, or today if open).
 */
export function jobLastDay(job, todayStr) {
  if (!job.periods || job.periods.length === 0) return todayStr;
  const ends = job.periods.map(p => p.end ?? todayStr);
  return ends.reduce((max, e) => e > max ? e : max, ends[0]);
}

