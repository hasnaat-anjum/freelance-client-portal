/**
 * Freelance Client Portal Builder — data model + stats (js/store.js)
 *
 * Pure functions only: no DOM, no localStorage, no network. Testable in
 * plain Node (see js/store.test.js) and reused by the browser app.
 *
 * A PORTAL is one client project, and it is the single unit the app
 * manages. Everything the client sees on their portal page comes from
 * this one object, so the exported HTML is always a faithful copy of
 * what the freelancer sees in the builder.
 *
 *   portal = {
 *     id, createdAt, updatedAt, status: 'active' | 'completed' | 'on-hold',
 *     business: { name, email, phone, website, brandColor },
 *     client:   { name, company, email },
 *     project:  { title, type, startDate, currency },
 *     milestones: [{ id, title, date, status, deliverables: [], note }],
 *     payments:   [{ id, label, amountMinor, dueDate, status }],
 *     needs:      [{ id, label, detail, status }],
 *     updates:    [{ id, date, text }],
 *     faqs:       [{ id, q, a }],
 *   }
 *
 * Statuses:
 *   milestone.status: 'done' | 'in-progress' | 'todo'
 *   payment.status:   'paid' | 'unpaid'      (overdue is computed from date)
 *   need.status:      'received' | 'waiting' | 'not-needed'
 *
 * Money is always integer minor units (see js/money.js).
 */

'use strict';

const money = require('./money.js');

/* ------------------------------------------------------------------ */
/* Ids and blank objects                                               */
/* ------------------------------------------------------------------ */

/** Short unique id, e.g. "m_kt3x9f2a1". Good enough for local data. */
function newId(prefix) {
  return (prefix || 'id') + '_' +
    Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

/** A fresh, empty portal — the "New portal" starting point. */
function blankPortal() {
  const now = money.todayStr();
  return {
    id: newId('p'),
    createdAt: now,
    updatedAt: now,
    status: 'active',
    business: { name: '', email: '', phone: '', website: '', brandColor: '#1e3a5f' },
    client: { name: '', company: '', email: '' },
    project: { title: '', type: 'Website', startDate: now, currency: 'USD' },
    milestones: [],
    payments: [],
    needs: [],
    updates: [],
    faqs: [],
  };
}

function blankMilestone() {
  return { id: newId('m'), title: '', date: money.todayStr(), status: 'todo', deliverables: [], note: '' };
}

function blankPayment() {
  return { id: newId('pay'), label: '', amountMinor: 0, dueDate: money.todayStr(), status: 'unpaid' };
}

function blankNeed() {
  return { id: newId('n'), label: '', detail: '', status: 'waiting' };
}

function blankUpdate() {
  return { id: newId('u'), date: money.todayStr(), text: '' };
}

function blankFaq() {
  return { id: newId('f'), q: '', a: '' };
}

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/* ------------------------------------------------------------------ */

/**
 * Project progress in whole percent. A done milestone counts 1, an
 * in-progress one counts 0.5, a to-do one counts 0. No milestones yet
 * means 0% — never divide by zero.
 */
function progressPct(portal) {
  const list = (portal && portal.milestones) || [];
  if (list.length === 0) return 0;
  let score = 0;
  for (const m of list) {
    if (m.status === 'done') score += 1;
    else if (m.status === 'in-progress') score += 0.5;
  }
  return Math.round((score / list.length) * 100);
}

/** Count milestones by status: { done, inProgress, todo, total }. */
function milestoneCounts(portal) {
  const out = { done: 0, inProgress: 0, todo: 0, total: 0 };
  for (const m of (portal && portal.milestones) || []) {
    out.total += 1;
    if (m.status === 'done') out.done += 1;
    else if (m.status === 'in-progress') out.inProgress += 1;
    else out.todo += 1;
  }
  return out;
}

/**
 * The next milestone the client is waiting on: the earliest-dated
 * milestone that is not done yet. Returns null when everything is done
 * (or there are no milestones).
 */
function nextMilestone(portal, today) {
  const open = ((portal && portal.milestones) || [])
    .filter(function (m) { return m.status !== 'done'; })
    .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
  if (open.length === 0) return null;
  const next = open[0];
  const ref = today || money.todayStr();
  const days = next.date && money.isValidDate(next.date)
    ? money.daysBetween(ref, next.date) : null;
  return { milestone: next, daysUntil: days };
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

/**
 * Payment totals for a portal, in minor units, relative to `today`:
 *   totalMinor      — everything scheduled
 *   paidMinor       — what the client already paid
 *   outstandingMinor— total minus paid
 *   overdueMinor    — unpaid lines whose due date has passed
 *   overdueCount    — how many lines are overdue
 *   nextDue         — the next unpaid line (or null)
 */
function paymentTotals(portal, today) {
  const ref = today || money.todayStr();
  const out = {
    totalMinor: 0, paidMinor: 0, outstandingMinor: 0,
    overdueMinor: 0, overdueCount: 0, nextDue: null,
  };
  const unpaid = [];
  for (const p of (portal && portal.payments) || []) {
    const amount = typeof p.amountMinor === 'number' ? p.amountMinor : 0;
    out.totalMinor += amount;
    if (p.status === 'paid') {
      out.paidMinor += amount;
    } else {
      unpaid.push(p);
      if (p.dueDate && money.isValidDate(p.dueDate) &&
          money.daysBetween(p.dueDate, ref) > 0) {
        out.overdueMinor += amount;
        out.overdueCount += 1;
      }
    }
  }
  out.outstandingMinor = out.totalMinor - out.paidMinor;
  unpaid.sort(function (a, b) { return (a.dueDate || '').localeCompare(b.dueDate || ''); });
  out.nextDue = unpaid.length ? unpaid[0] : null;
  return out;
}

/** Unpaid payment lines whose due date has already passed. */
function overduePayments(portal, today) {
  const ref = today || money.todayStr();
  return ((portal && portal.payments) || []).filter(function (p) {
    return p.status !== 'paid' && p.dueDate &&
      money.isValidDate(p.dueDate) && money.daysBetween(p.dueDate, ref) > 0;
  });
}

/** Is one payment line overdue right now? */
function isPaymentOverdue(payment, today) {
  if (!payment || payment.status === 'paid') return false;
  const ref = today || money.todayStr();
  return !!payment.dueDate && money.isValidDate(payment.dueDate) &&
    money.daysBetween(payment.dueDate, ref) > 0;
}

/* ------------------------------------------------------------------ */
/* "What I need from you" checklist                                    */
/* ------------------------------------------------------------------ */

/** Checklist summary: { total, received, waiting, pct }. */
function needsSummary(portal) {
  const list = ((portal && portal.needs) || [])
    .filter(function (n) { return n.status !== 'not-needed'; });
  const received = list.filter(function (n) { return n.status === 'received'; }).length;
  return {
    total: list.length,
    received: received,
    waiting: list.length - received,
    pct: list.length === 0 ? 100 : Math.round((received / list.length) * 100),
  };
}

/* ------------------------------------------------------------------ */
/* Alerts — what needs the freelancer's attention today                */
/* ------------------------------------------------------------------ */

/**
 * A short list of things to act on, most urgent first. Each alert is
 * { kind, text } where kind is 'overdue-payment' | 'waiting-need' |
 * 'milestone-due' | 'all-clear'. The dashboard shows these per portal.
 */
function portalAlerts(portal, today) {
  const ref = today || money.todayStr();
  const alerts = [];
  for (const p of overduePayments(portal, ref)) {
    alerts.push({
      kind: 'overdue-payment',
      text: 'Payment overdue: ' + (p.label || 'Payment') + ' — ' +
        money.formatMoneyShort(p.amountMinor || 0, portal.project.currency) +
        ', due ' + money.prettyDate(p.dueDate),
    });
  }
  const waiting = needsSummary(portal).waiting;
  if (waiting > 0) {
    alerts.push({
      kind: 'waiting-need',
      text: 'Waiting on ' + waiting + ' item' + (waiting === 1 ? '' : 's') +
        ' from the client (logins, files or content).',
    });
  }
  const next = nextMilestone(portal, ref);
  if (next && next.daysUntil !== null && next.daysUntil >= 0 && next.daysUntil <= 3) {
    alerts.push({
      kind: 'milestone-due',
      text: 'Milestone "' + next.milestone.title + '" is due ' +
        (next.daysUntil === 0 ? 'today' : 'in ' + next.daysUntil + ' day' +
          (next.daysUntil === 1 ? '' : 's')) + '.',
    });
  }
  if (alerts.length === 0) {
    alerts.push({ kind: 'all-clear', text: 'Nothing overdue — all clear.' });
  }
  return alerts;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Validate a portal before it is saved or exported. Returns an array
 * of problem strings; empty means the portal is usable. Warnings that
 * do not block export (e.g. no milestones yet) are NOT listed here —
 * they belong in the UI, not in validation.
 */
function validatePortal(portal) {
  const problems = [];
  if (!portal || typeof portal !== 'object') return ['Portal is not an object.'];
  if (!portal.project || !portal.project.title || !portal.project.title.trim()) {
    problems.push('Project title is missing.');
  }
  if (!portal.client || !portal.client.name || !portal.client.name.trim()) {
    problems.push('Client name is missing.');
  }
  if (portal.project && portal.project.startDate &&
      !money.isValidDate(portal.project.startDate)) {
    problems.push('Project start date is not a real date.');
  }
  for (const m of portal.milestones || []) {
    if (!m.title || !m.title.trim()) problems.push('A milestone has no title.');
    if (m.date && !money.isValidDate(m.date)) {
      problems.push('Milestone "' + (m.title || '?') + '" has an invalid date.');
    }
    if (['done', 'in-progress', 'todo'].indexOf(m.status) === -1) {
      problems.push('Milestone "' + (m.title || '?') + '" has an unknown status.');
    }
  }
  for (const p of portal.payments || []) {
    if (typeof p.amountMinor !== 'number' || p.amountMinor < 0) {
      problems.push('Payment "' + (p.label || '?') + '" has an invalid amount.');
    }
    if (p.dueDate && !money.isValidDate(p.dueDate)) {
      problems.push('Payment "' + (p.label || '?') + '" has an invalid due date.');
    }
  }
  for (const u of portal.updates || []) {
    if (u.date && !money.isValidDate(u.date)) {
      problems.push('An update has an invalid date.');
    }
  }
  return problems;
}

/**
 * Validate a full imported data object (from JSON import). Returns an
 * array of problem strings; empty means the data is usable.
 */
function validateImport(data) {
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Data is not an object.'];
  }
  if (!Array.isArray(data.portals)) {
    return ['"portals" must be a list.'];
  }
  for (const portal of data.portals) {
    const sub = validatePortal(portal);
    for (const s of sub) {
      problems.push('Portal "' + ((portal && portal.project && portal.project.title) || '?') +
        '": ' + s);
    }
  }
  return problems;
}

/* ------------------------------------------------------------------ */
/* Sorting and summaries                                               */
/* ------------------------------------------------------------------ */

/** Portals sorted: active first, then most recently updated first. */
function sortPortals(portals) {
  const rank = { active: 0, 'on-hold': 1, completed: 2 };
  return (portals || []).slice().sort(function (a, b) {
    const ra = rank[a.status] === undefined ? 3 : rank[a.status];
    const rb = rank[b.status] === undefined ? 3 : rank[b.status];
    if (ra !== rb) return ra - rb;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
}

/** One-line summary for a dashboard card. */
function portalSummary(portal, today) {
  const totals = paymentTotals(portal, today);
  const counts = milestoneCounts(portal);
  return {
    progress: progressPct(portal),
    milestonesDone: counts.done,
    milestonesTotal: counts.total,
    paidMinor: totals.paidMinor,
    outstandingMinor: totals.outstandingMinor,
    overdueCount: totals.overdueCount,
    needsWaiting: needsSummary(portal).waiting,
  };
}

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

/**
 * A realistic demo portal: a website redesign for a local bakery.
 * Numbers are hand-checked: 5 milestones (2 done, 1 in progress),
 * 3 payments totalling Rs. 150,000 with Rs. 75,000 paid, 5 checklist
 * items (3 received, 2 waiting). Used by the app's "Load demo" button
 * and by the examples/ folder.
 */
function demoPortal() {
  const p = blankPortal();
  p.business = {
    name: 'Hasnaat Anjum — Freelance Web Developer',
    email: 'hasnaatanjum125@gmail.com',
    phone: '+92 300 0000000',
    website: 'https://hasnaat-anjum-portfolio.vercel.app',
    brandColor: '#1e3a5f',
  };
  p.client = { name: 'Ayesha Khan', company: 'Bright Bakery', email: 'ayesha@brightbakery.pk' };
  p.project = { title: 'Website Redesign for Bright Bakery', type: 'Website', startDate: '2026-11-02', currency: 'PKR' };
  p.milestones = [
    { id: newId('m'), title: 'Discovery & homepage design', date: '2026-11-09', status: 'done',
      deliverables: ['Homepage mockup approved', 'Colour palette + fonts agreed'], note: 'Client picked the warm cream theme.' },
    { id: newId('m'), title: 'Menu & ordering pages', date: '2026-11-16', status: 'done',
      deliverables: ['Menu page with photos', 'Online order form'], note: '' },
    { id: newId('m'), title: 'Online ordering + payments', date: '2026-11-27', status: 'in-progress',
      deliverables: ['Cash on delivery checkout', 'Order confirmation email'], note: 'Waiting on the bakery’s delivery areas list.' },
    { id: newId('m'), title: 'Testing & fixes', date: '2026-12-04', status: 'todo',
      deliverables: ['Mobile + desktop testing', 'Speed check'], note: '' },
    { id: newId('m'), title: 'Launch & handover', date: '2026-12-11', status: 'todo',
      deliverables: ['Site live on brightbakery.pk', 'Training video + handover doc'], note: '' },
  ];
  p.payments = [
    { id: newId('pay'), label: 'Deposit (50%)', amountMinor: 7500000, dueDate: '2026-11-02', status: 'paid' },
    { id: newId('pay'), label: 'Mid-project payment (25%)', amountMinor: 3750000, dueDate: '2026-11-27', status: 'unpaid' },
    { id: newId('pay'), label: 'Final payment on launch (25%)', amountMinor: 3750000, dueDate: '2026-12-11', status: 'unpaid' },
  ];
  p.needs = [
    { id: newId('n'), label: 'Logo files (PNG + SVG)', detail: 'High-resolution logo, transparent background if possible.', status: 'received' },
    { id: newId('n'), label: 'Photos of cakes & bakery', detail: '10–15 good photos, phone photos are fine.', status: 'received' },
    { id: newId('n'), label: 'Menu with prices', detail: 'Full menu list with current prices in Rs.', status: 'received' },
    { id: newId('n'), label: 'Delivery areas & charges', detail: 'Which areas you deliver to, and the delivery fee for each.', status: 'waiting' },
    { id: newId('n'), label: 'Domain & hosting login', detail: 'Only needed before launch week — a temporary login is fine.', status: 'waiting' },
  ];
  p.updates = [
    { id: newId('u'), date: '2026-11-02', text: 'Project started. Deposit received — thank you! Homepage design is underway.' },
    { id: newId('u'), date: '2026-11-09', text: 'Homepage design approved. Menu and ordering pages are now in progress.' },
    { id: newId('u'), date: '2026-11-20', text: 'Menu and ordering pages are done. Next: online ordering and payments.' },
  ];
  p.faqs = [
    { id: newId('f'), q: 'How do I see the work in progress?', a: 'I send a preview link at every milestone. You can open it on your phone — no login needed.' },
    { id: newId('f'), q: 'What if I want to change something?', a: 'Small changes inside a milestone are free. Bigger changes go in a short change note with the extra cost and new date, so there are no surprises.' },
    { id: newId('f'), q: 'When do I pay?', a: 'Payments follow the schedule on this page. Each payment is due on its date, and work on the next milestone starts once it arrives.' },
  ];
  return p;
}

/* ------------------------------------------------------------------ */
/* Exports (Node + browser)                                            */
/* ------------------------------------------------------------------ */

const api = {
  newId,
  blankPortal, blankMilestone, blankPayment, blankNeed, blankUpdate, blankFaq,
  progressPct, milestoneCounts, nextMilestone,
  paymentTotals, overduePayments, isPaymentOverdue,
  needsSummary, portalAlerts,
  validatePortal, validateImport,
  sortPortals, portalSummary,
  demoPortal,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.FCPStore = api;
