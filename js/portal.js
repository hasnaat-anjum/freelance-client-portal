/**
 * Freelance Client Portal Builder — standalone portal page (js/portal.js)
 *
 * Pure functions only: no DOM, no localStorage, no network. Testable in
 * plain Node (see js/portal.test.js) and reused by the browser app.
 *
 * buildStandalonePortalHTML(portal) turns one portal object into a
 * complete, self-contained HTML document the freelancer can send to
 * their client — by email, WhatsApp, or hosted anywhere. It has:
 *
 *   - NO external dependencies: all CSS is inline, no fonts, no scripts,
 *     no images, so the file works offline and forever.
 *   - NO JavaScript: the page is a static status page, so nothing can
 *     break in the client's browser or email preview.
 *   - ESCAPED user content: every name, title and note goes through
 *     escapeHtml, so a stray "<" in a client note cannot break the page.
 *   - The freelancer's brand colour, used for the header and accents.
 *
 * The same HTML is shown in the app's live preview (via an iframe),
 * so what the freelancer sees is exactly what the client gets.
 */

'use strict';

const money = require('./money.js');
const store = require('./store.js');

/* ------------------------------------------------------------------ */
/* Small builders                                                      */
/* ------------------------------------------------------------------ */

/** Status pill text + class for a milestone. */
function milestonePill(m) {
  if (m.status === 'done') return { text: 'Done', cls: 'pill-done' };
  if (m.status === 'in-progress') return { text: 'In progress', cls: 'pill-progress' };
  return { text: 'Not started', cls: 'pill-todo' };
}

/** Status pill text + class for a payment line, relative to today. */
function paymentPill(p, today, currency) {
  if (p.status === 'paid') return { text: 'Paid', cls: 'pill-done' };
  if (store.isPaymentOverdue(p, today)) return { text: 'Overdue', cls: 'pill-overdue' };
  return { text: 'Due ' + money.prettyDate(p.dueDate), cls: 'pill-todo' };
}

/** Status pill text + class for a "what I need" item. */
function needPill(n) {
  if (n.status === 'received') return { text: 'Received', cls: 'pill-done' };
  if (n.status === 'not-needed') return { text: 'Not needed', cls: 'pill-muted' };
  return { text: 'Waiting for you', cls: 'pill-waiting' };
}

/* ------------------------------------------------------------------ */
/* The standalone page                                                 */
/* ------------------------------------------------------------------ */

/**
 * Build the full client-facing portal page as one HTML string.
 * `today` ("YYYY-MM-DD") defaults to the real today; tests pass a
 * fixed date so the output is deterministic.
 */
function buildStandalonePortalHTML(portal, today) {
  const ref = today || money.todayStr();
  const esc = money.escapeHtml;
  const business = portal.business || {};
  const client = portal.client || {};
  const project = portal.project || {};
  const currency = project.currency || 'USD';
  const brand = (business.brandColor || '#1e3a5f').trim() || '#1e3a5f';

  const progress = store.progressPct(portal);
  const counts = store.milestoneCounts(portal);
  const totals = store.paymentTotals(portal, ref);
  const needs = store.needsSummary(portal);
  const next = store.nextMilestone(portal, ref);
  const milestones = (portal.milestones || []).slice()
    .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
  const payments = (portal.payments || []).slice()
    .sort(function (a, b) { return (a.dueDate || '').localeCompare(b.dueDate || ''); });
  const updates = (portal.updates || []).slice()
    .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

  const milestoneRows = milestones.map(function (m) {
    const pill = milestonePill(m);
    const deliverables = (m.deliverables || []).filter(function (d) { return d && d.trim(); });
    const delivHtml = deliverables.length
      ? '<ul class="deliv">' + deliverables.map(function (d) {
        return '<li>' + esc(d) + '</li>';
      }).join('') + '</ul>'
      : '';
    const noteHtml = m.note && m.note.trim()
      ? '<p class="note">' + esc(m.note) + '</p>' : '';
    return '<div class="ms ' + (m.status === 'done' ? 'ms-done' : '') + '">' +
      '<div class="ms-head"><span class="ms-title">' + esc(m.title) + '</span>' +
      '<span class="pill ' + pill.cls + '">' + pill.text + '</span></div>' +
      '<div class="ms-date">Due ' + money.prettyDate(m.date) + '</div>' +
      delivHtml + noteHtml + '</div>';
  }).join('\n') || '<p class="empty">Milestones will appear here as the project is planned.</p>';

  const paymentRows = payments.map(function (p) {
    const pill = paymentPill(p, ref, currency);
    return '<tr><td>' + esc(p.label || 'Payment') + '</td>' +
      '<td class="num">' + money.formatMoneyShort(p.amountMinor || 0, currency) + '</td>' +
      '<td>' + money.prettyDate(p.dueDate) + '</td>' +
      '<td><span class="pill ' + pill.cls + '">' + pill.text + '</span></td></tr>';
  }).join('\n') || '<tr><td colspan="4" class="empty">No payments scheduled yet.</td></tr>';

  const needRows = ((portal.needs || []).map(function (n) {
    const pill = needPill(n);
    const detail = n.detail && n.detail.trim()
      ? '<div class="need-detail">' + esc(n.detail) + '</div>' : '';
    return '<div class="need">' +
      '<span class="need-box ' + (n.status === 'received' ? 'need-box-on' : '') + '">' +
      (n.status === 'received' ? '&#10003;' : '') + '</span>' +
      '<div class="need-body"><div class="need-label">' + esc(n.label) + '</div>' + detail + '</div>' +
      '<span class="pill ' + pill.cls + '">' + pill.text + '</span></div>';
  }).join('\n')) || '<p class="empty">Nothing needed from you right now.</p>';

  const updateRows = updates.map(function (u) {
    return '<div class="upd"><div class="upd-date">' + money.prettyDate(u.date) + '</div>' +
      '<div class="upd-text">' + esc(u.text) + '</div></div>';
  }).join('\n') || '<p class="empty">Updates will appear here as the project moves.</p>';

  const faqRows = (portal.faqs || []).filter(function (f) {
    return (f.q && f.q.trim()) || (f.a && f.a.trim());
  }).map(function (f) {
    return '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>';
  }).join('\n') || '<p class="empty">No questions yet.</p>';

  const nextHtml = next
    ? '<p class="next">Next up: <strong>' + esc(next.milestone.title) + '</strong> — due ' +
      money.prettyDate(next.milestone.date) +
      (next.daysUntil === 0 ? ' (today)' :
        next.daysUntil > 0 ? ' (in ' + next.daysUntil + ' day' + (next.daysUntil === 1 ? '' : 's') + ')' :
        ' (' + Math.abs(next.daysUntil) + ' day' + (Math.abs(next.daysUntil) === 1 ? '' : 's') + ' overdue)') +
      '</p>'
    : '<p class="next">All milestones are complete — thank you!</p>';

  const contactBits = [];
  if (business.email) contactBits.push('<a href="mailto:' + esc(business.email) + '">' + esc(business.email) + '</a>');
  if (business.phone) contactBits.push('<span>' + esc(business.phone) + '</span>');
  if (business.website) contactBits.push('<a href="' + esc(business.website) + '">' + esc(business.website) + '</a>');
  const contactHtml = contactBits.length
    ? '<p class="contact">' + contactBits.join(' &middot; ') + '</p>'
    : '';

  const clientName = client.name || 'there';
  const companyBit = client.company ? ' &middot; ' + esc(client.company) : '';

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(project.title || 'Client Portal') + ' — ' + esc(business.name || 'Your freelancer') + '</title>\n' +
    '<style>\n' +
    '  * { box-sizing: border-box; }\n' +
    '  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; ' +
    'color: #1f2937; background: #f3f4f6; line-height: 1.55; }\n' +
    '  .wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 48px; }\n' +
    '  header { background: ' + esc(brand) + '; color: #fff; padding: 36px 24px 28px; border-radius: 0 0 16px 16px; }\n' +
    '  header h1 { margin: 0 0 6px; font-size: 26px; line-height: 1.25; }\n' +
    '  header .sub { margin: 0; opacity: .92; font-size: 15px; }\n' +
    '  header .biz { margin: 14px 0 0; font-size: 13px; opacity: .85; }\n' +
    '  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; ' +
    'padding: 20px 22px; margin-top: 16px; }\n' +
    '  .card h2 { margin: 0 0 12px; font-size: 18px; }\n' +
    '  .bar { height: 12px; background: #e5e7eb; border-radius: 99px; overflow: hidden; }\n' +
    '  .bar > div { height: 100%; background: ' + esc(brand) + '; border-radius: 99px; }\n' +
    '  .stats { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }\n' +
    '  .stat { flex: 1 1 140px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }\n' +
    '  .stat b { display: block; font-size: 18px; }\n' +
    '  .stat span { font-size: 12px; color: #6b7280; }\n' +
    '  .next { margin: 14px 0 0; }\n' +
    '  .ms { border-left: 3px solid #d1d5db; padding: 2px 0 14px 14px; }\n' +
    '  .ms-done { border-left-color: #16a34a; }\n' +
    '  .ms-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap; }\n' +
    '  .ms-title { font-weight: 700; }\n' +
    '  .ms-date { font-size: 13px; color: #6b7280; margin-top: 2px; }\n' +
    '  .deliv { margin: 8px 0 0; padding-left: 18px; }\n' +
    '  .deliv li { margin: 2px 0; }\n' +
    '  .note { margin: 8px 0 0; font-size: 14px; color: #4b5563; background: #f9fafb; ' +
    'border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; }\n' +
    '  table { width: 100%; border-collapse: collapse; font-size: 14px; }\n' +
    '  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }\n' +
    '  th { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }\n' +
    '  td.num { text-align: right; white-space: nowrap; }\n' +
    '  tfoot td { font-weight: 700; border-bottom: 0; }\n' +
    '  .need { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }\n' +
    '  .need:last-child { border-bottom: 0; }\n' +
    '  .need-box { flex: 0 0 22px; height: 22px; border: 2px solid #d1d5db; border-radius: 6px; ' +
    'text-align: center; line-height: 19px; font-size: 14px; color: #fff; margin-top: 1px; }\n' +
    '  .need-box-on { background: #16a34a; border-color: #16a34a; }\n' +
    '  .need-body { flex: 1; }\n' +
    '  .need-label { font-weight: 600; }\n' +
    '  .need-detail { font-size: 13px; color: #6b7280; }\n' +
    '  .pill { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 9px; ' +
    'border-radius: 99px; white-space: nowrap; }\n' +
    '  .pill-done { background: #dcfce7; color: #166534; }\n' +
    '  .pill-progress { background: #dbeafe; color: #1e40af; }\n' +
    '  .pill-todo { background: #f3f4f6; color: #374151; }\n' +
    '  .pill-overdue { background: #fee2e2; color: #991b1b; }\n' +
    '  .pill-waiting { background: #fef3c7; color: #92400e; }\n' +
    '  .pill-muted { background: #f3f4f6; color: #9ca3af; }\n' +
    '  .upd { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }\n' +
    '  .upd:last-child { border-bottom: 0; }\n' +
    '  .upd-date { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }\n' +
    '  .upd-text { margin-top: 2px; }\n' +
    '  details { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }\n' +
    '  details summary { cursor: pointer; font-weight: 600; }\n' +
    '  details p { margin: 8px 0 0; color: #4b5563; }\n' +
    '  footer { text-align: center; color: #6b7280; font-size: 13px; margin-top: 24px; }\n' +
    '  footer a { color: ' + esc(brand) + '; }\n' +
    '  .contact { margin: 8px 0 0; }\n' +
    '  .contact a { color: #fff; }\n' +
    '  .empty { color: #6b7280; }\n' +
    '  @media (max-width: 560px) { header h1 { font-size: 22px; } .card { padding: 16px; } }\n' +
    '</style>\n</head>\n<body>\n<div class="wrap">\n' +
    '<header>\n<h1>' + esc(project.title || 'Your project') + '</h1>\n' +
    '<p class="sub">Hi ' + esc(clientName) + companyBit + ' — here is where your project stands, all in one place.</p>\n' +
    '<p class="biz">' + esc(business.name || '') + '</p>\n' + contactHtml + '\n</header>\n' +
    '<section class="card">\n<h2>Progress</h2>\n' +
    '<div class="bar"><div style="width: ' + progress + '%"></div></div>\n' +
    '<div class="stats">\n' +
    '<div class="stat"><b>' + progress + '%</b><span>complete</span></div>\n' +
    '<div class="stat"><b>' + counts.done + ' of ' + counts.total + '</b><span>milestones done</span></div>\n' +
    '<div class="stat"><b>' + money.formatMoneyShort(totals.paidMinor, currency) + '</b><span>paid of ' + money.formatMoneyShort(totals.totalMinor, currency) + '</span></div>\n' +
    '<div class="stat"><b>' + needs.received + ' of ' + needs.total + '</b><span>items received from you</span></div>\n' +
    '</div>\n' + nextHtml + '\n</section>\n' +
    '<section class="card">\n<h2>Milestones</h2>\n' + milestoneRows + '\n</section>\n' +
    '<section class="card">\n<h2>Payments</h2>\n<table>\n<thead><tr><th>Payment</th><th style="text-align:right">Amount</th><th>Due</th><th>Status</th></tr></thead>\n<tbody>\n' + paymentRows + '\n</tbody>\n' +
    '<tfoot><tr><td>Total</td><td class="num">' + money.formatMoneyShort(totals.totalMinor, currency) + '</td>' +
    '<td colspan="2">' + (totals.outstandingMinor > 0
      ? money.formatMoneyShort(totals.outstandingMinor, currency) + ' outstanding'
      : 'Fully paid — thank you!') + '</td></tr></tfoot>\n</table>\n</section>\n' +
    '<section class="card">\n<h2>What I need from you</h2>\n' + needRows + '\n</section>\n' +
    '<section class="card">\n<h2>Latest updates</h2>\n' + updateRows + '\n</section>\n' +
    '<section class="card">\n<h2>Questions, answered</h2>\n' + faqRows + '\n</section>\n' +
    '<footer>\n<p>This page was prepared by ' + esc(business.name || 'your freelancer') + ' on ' + money.prettyDate(ref) + '.</p>\n' +
    (business.email ? '<p>Questions? Email <a href="mailto:' + esc(business.email) + '">' + esc(business.email) + '</a>.</p>\n' : '') +
    '</footer>\n</div>\n</body>\n</html>\n';
}

/** Safe download filename for a portal, e.g. "client-portal-bright-bakery.html". */
function portalFilename(portal) {
  const base = (portal.client && portal.client.company) ||
    (portal.client && portal.client.name) ||
    (portal.project && portal.project.title) || 'portal';
  return 'client-portal-' + money.slugify(base) + '.html';
}

/* ------------------------------------------------------------------ */
/* Exports (Node + browser)                                            */
/* ------------------------------------------------------------------ */

const api = { buildStandalonePortalHTML, portalFilename, milestonePill, paymentPill, needPill };

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.FCPPortal = api;
