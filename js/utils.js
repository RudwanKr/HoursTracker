/**
 * utils.js — Formatting, UUID, base64 UTF-8 helpers
 */

/** Generate a UUID v4 using the browser crypto API */
export function uuid() {
  return crypto.randomUUID();
}

/**
 * Encode a string to base64, correctly handling non-ASCII (UTF-8).
 * Do NOT use plain btoa() on arbitrary strings.
 */
export function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64 string back to a UTF-8 string.
 */
export function decodeBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Format a duration in fractional hours to "Xh Ym" or "0m".
 * @param {number} hours - fractional hours (may be negative)
 * @param {boolean} [showSign=false] - prefix with + or - for non-zero
 */
export function formatDuration(hours, showSign = false) {
  const sign = hours < 0 ? '-' : (showSign && hours > 0 ? '+' : '');
  const absH = Math.abs(hours);
  const h = Math.floor(absH);
  const m = Math.round((absH - h) * 60);
  if (h === 0 && m === 0) return '0m';
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

/**
 * Format a duration in fractional hours to "HH:MM:SS" for timer display.
 * @param {number} seconds - total seconds
 */
export function formatHMS(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Parse a local date string "YYYY-MM-DD" into a Date (midnight local time).
 * Never use new Date("YYYY-MM-DD") — it's UTC.
 */
export function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a Date object to a "YYYY-MM-DD" local date string.
 */
export function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get today's local date string "YYYY-MM-DD".
 */
export function today() {
  return toLocalDateStr(new Date());
}

/**
 * Format a local date string to a readable form e.g. "Nov 9, 2026".
 */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format an ISO timestamp to local time string "HH:MM".
 */
export function formatTime(isoStr) {
  if (!isoStr) return '—';
  const date = new Date(isoStr);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format an ISO timestamp to local datetime string.
 */
export function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const date = new Date(isoStr);
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Parse a local date+time string ("YYYY-MM-DD", "HH:MM") to UTC ISO string.
 */
export function localDateTimeToISO(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

/**
 * Escape text for safe DOM insertion (not needed if using textContent, but
 * provided for string building in test output).
 */
export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Clamp a number between min and max.
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

