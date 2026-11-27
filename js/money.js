/**
 * Freelance Client Portal Builder — money helpers (js/money.js)
 *
 * Pure functions only: no DOM, no localStorage, no network. That is why
 * this file can be tested in plain Node (see js/money.test.js) and reused
 * by the browser app (js/app.js) without change.
 *
 * GOLDEN RULE: money is always stored and calculated in INTEGER MINOR
 * UNITS (paisa / cents). Never store or add decimal amounts — 0.1 + 0.2
 * style float drift would silently corrupt a freelancer's books.
 *   toMinor("85,000.50") -> 8500050
 *   fromMinor(8500050)   -> 85000.5
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Currencies                                                          */
/* ------------------------------------------------------------------ */

/** Supported currencies. `minor` is always 100 (2 decimal places). */
const CURRENCIES = {
  PKR: { code: 'PKR', symbol: 'Rs. ', decimals: 2 },
  USD: { code: 'USD', symbol: '$', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', decimals: 2 },
  INR: { code: 'INR', symbol: '₹', decimals: 2 },
  AED: { code: 'AED', symbol: 'AED ', decimals: 2 },
};

/** Fall back to USD for an unknown currency code (never crash on bad data). */
function currencyInfo(code) {
  return CURRENCIES[code] || CURRENCIES.USD;
}

/* ------------------------------------------------------------------ */
/* Minor-unit conversion                                               */
/* ------------------------------------------------------------------ */

/**
 * Convert a user-typed amount ("85,000.50", 85000.5, "85000") to integer
 * minor units. Returns null when the input is not a usable amount.
 * Accepts commas and surrounding whitespace. Zero is allowed here
 * (a payment line may legitimately be 0); callers decide what to do.
 */
function toMinor(input) {
  if (input === null || input === undefined || input === '') return null;
  const cleaned = String(input).replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Math.round(parseFloat(cleaned) * 100);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

/** Minor units back to a plain number (e.g. 8500050 -> 85000.5). */
function fromMinor(minor) {
  return minor / 100;
}

/**
 * Format minor units for display, e.g. formatMoney(8500050, 'PKR')
 * -> "Rs. 85,000.50". Negative values keep the minus sign in front.
 */
function formatMoney(minor, currencyCode) {
  const info = currencyInfo(currencyCode);
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + info.symbol + grouped + '.' + frac;
}

/** Short form without decimals when the amount is whole, e.g. "Rs. 85,000". */
function formatMoneyShort(minor, currencyCode) {
  if (minor % 100 === 0) {
    return formatMoney(minor, currencyCode).replace(/\.00$/, '');
  }
  return formatMoney(minor, currencyCode);
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/** Today's date as "YYYY-MM-DD" in the user's local timezone. */
function todayStr(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/** Is the string a real calendar date (rejects 2026-02-30 etc.)? */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) &&
    d.getMonth() === Number(m[2]) - 1 &&
    d.getDate() === Number(m[3]);
}

/** Whole days from date A to date B ("2026-11-01" -> "2026-11-21" = 20). */
function daysBetween(a, b) {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / 86400000);
}

/**
 * Human date: "2026-11-27" -> "27 Nov 2026". Returns the raw string
 * when it is not a valid date (never crash on bad data).
 */
function prettyDate(dateStr) {
  if (!isValidDate(dateStr)) return dateStr || '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = dateStr.split('-').map(Number);
  return parts[2] + ' ' + months[parts[1] - 1] + ' ' + parts[0];
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

/** Escape text for safe insertion into HTML (prevents broken markup). */
function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "Website Redesign!" -> "website-redesign" (safe file-name slug). */
function slugify(text) {
  return String(text || 'portal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'portal';
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/** Escape one CSV cell (quotes, commas and newlines). */
function csvCell(value) {
  const s = String(value === null || value === undefined ? '' : value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Build a CSV string from a header array and rows of values. */
function buildCSV(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\n') + '\n';
}

/* ------------------------------------------------------------------ */
/* Exports (Node + browser)                                            */
/* ------------------------------------------------------------------ */

const api = {
  CURRENCIES, currencyInfo,
  toMinor, fromMinor, formatMoney, formatMoneyShort,
  todayStr, isValidDate, daysBetween, prettyDate,
  escapeHtml, slugify,
  csvCell, buildCSV,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.FCPMoney = api;
