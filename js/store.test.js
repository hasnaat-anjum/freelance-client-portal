/**
 * Tests for js/store.js — run with: node js/store.test.js
 * No dependencies. Exits non-zero on the first failure.
 */
'use strict';

const s = require('./store.js');
const money = require('./money.js');

let passed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    console.error('FAIL: ' + name + '\n  expected: ' + JSON.stringify(expected) +
      '\n  actual:   ' + JSON.stringify(actual));
    process.exit(1);
  }
  passed += 1;
}

/** Build a small portal by hand for deterministic tests. */
function samplePortal() {
  const p = s.blankPortal();
  p.business = { name: 'Test Freelancer', email: 't@example.com', phone: '', website: '', brandColor: '#123456' };
  p.client = { name: 'Client One', company: 'Acme', email: 'c@acme.com' };
  p.project = { title: 'Test Project', type: 'Website', startDate: '2026-11-01', currency: 'USD' };
  p.milestones = [
    { id: 'm1', title: 'Design', date: '2026-11-05', status: 'done', deliverables: ['Mockup'], note: '' },
    { id: 'm2', title: 'Build', date: '2026-11-20', status: 'in-progress', deliverables: [], note: '' },
    { id: 'm3', title: 'Launch', date: '2026-11-30', status: 'todo', deliverables: [], note: '' },
  ];
  p.payments = [
    { id: 'p1', label: 'Deposit', amountMinor: 500000, dueDate: '2026-11-01', status: 'paid' },
    { id: 'p2', label: 'Final', amountMinor: 500000, dueDate: '2026-11-10', status: 'unpaid' },
  ];
  p.needs = [
    { id: 'n1', label: 'Logo', detail: '', status: 'received' },
    { id: 'n2', label: 'Photos', detail: '', status: 'waiting' },
    { id: 'n3', label: 'Old copy', detail: '', status: 'not-needed' },
  ];
  p.updates = [{ id: 'u1', date: '2026-11-05', text: 'Design done.' }];
  p.faqs = [];
  return p;
}

const TODAY = '2026-11-27';

/* progress */
check('progressPct 2 done-ish of 3', s.progressPct(samplePortal()), 50);
check('progressPct empty milestones', s.progressPct(s.blankPortal()), 0);
const allDone = samplePortal();
allDone.milestones.forEach(function (m) { m.status = 'done'; });
check('progressPct all done', s.progressPct(allDone), 100);

/* milestone counts + next */
check('milestoneCounts', s.milestoneCounts(samplePortal()),
  { done: 1, inProgress: 1, todo: 1, total: 3 });
const nxt = s.nextMilestone(samplePortal(), TODAY);
check('nextMilestone title', nxt.milestone.title, 'Build');
check('nextMilestone daysUntil (past date)', nxt.daysUntil, -7);
check('nextMilestone null when all done', s.nextMilestone(allDone, TODAY), null);

/* payments */
const totals = s.paymentTotals(samplePortal(), TODAY);
check('paymentTotals total', totals.totalMinor, 1000000);
check('paymentTotals paid', totals.paidMinor, 500000);
check('paymentTotals outstanding', totals.outstandingMinor, 500000);
check('paymentTotals overdue', totals.overdueMinor, 500000);
check('paymentTotals overdueCount', totals.overdueCount, 1);
check('paymentTotals nextDue label', totals.nextDue.label, 'Final');
check('overduePayments count', s.overduePayments(samplePortal(), TODAY).length, 1);
check('isPaymentOverdue true', s.isPaymentOverdue(samplePortal().payments[1], TODAY), true);
check('isPaymentOverdue paid is false', s.isPaymentOverdue(samplePortal().payments[0], TODAY), false);
check('isPaymentOverdue future unpaid', s.isPaymentOverdue(
  { label: 'X', amountMinor: 100, dueDate: '2026-12-01', status: 'unpaid' }, TODAY), false);

/* needs */
check('needsSummary', s.needsSummary(samplePortal()),
  { total: 2, received: 1, waiting: 1, pct: 50 });
check('needsSummary empty', s.needsSummary(s.blankPortal()),
  { total: 0, received: 0, waiting: 0, pct: 100 });

/* alerts */
const alerts = s.portalAlerts(samplePortal(), TODAY);
check('alerts: overdue first', alerts[0].kind, 'overdue-payment');
check('alerts include waiting need', alerts.some(function (a) { return a.kind === 'waiting-need'; }), true);
const cleanPortal = samplePortal();
cleanPortal.milestones.forEach(function (m) { m.status = 'done'; });
cleanPortal.needs.forEach(function (n) { n.status = 'received'; });
cleanPortal.payments[1].status = 'paid';
check('alerts all-clear on clean portal', s.portalAlerts(cleanPortal, '2026-11-01')[0].kind, 'all-clear');

/* validation */
check('validatePortal clean', s.validatePortal(samplePortal()), []);
const bad = s.blankPortal();
check('validatePortal blank has problems', s.validatePortal(bad).length >= 2, true);
const badDate = samplePortal();
badDate.milestones[0].date = '2026-02-30';
check('validatePortal bad milestone date', s.validatePortal(badDate).length, 1);
const badMoney = samplePortal();
badMoney.payments[0].amountMinor = -5;
check('validatePortal negative payment', s.validatePortal(badMoney).length, 1);
check('validateImport not object', s.validateImport(null), ['Data is not an object.']);
check('validateImport portals not list', s.validateImport({ portals: 1 }), ['"portals" must be a list.']);
check('validateImport clean', s.validateImport({ portals: [samplePortal()] }), []);

/* sorting + summary */
const a = samplePortal(); a.status = 'completed'; a.updatedAt = '2026-11-20';
const b = samplePortal(); b.status = 'active'; b.updatedAt = '2026-11-01';
const c = samplePortal(); c.status = 'active'; c.updatedAt = '2026-11-25';
check('sortPortals active first, newest first',
  s.sortPortals([a, b, c]).map(function (p) { return p.updatedAt; }),
  ['2026-11-25', '2026-11-01', '2026-11-20']);
const summary = s.portalSummary(samplePortal(), TODAY);
check('portalSummary progress', summary.progress, 50);
check('portalSummary overdueCount', summary.overdueCount, 1);
check('portalSummary needsWaiting', summary.needsWaiting, 1);

/* demo data — hand-checked numbers */
const demo = s.demoPortal();
check('demo: 5 milestones', demo.milestones.length, 5);
check('demo: progress 50%', s.progressPct(demo), 50);
const dTotals = s.paymentTotals(demo, '2026-11-27');
check('demo: total Rs. 150,000', dTotals.totalMinor, 15000000);
check('demo: paid Rs. 75,000', dTotals.paidMinor, 7500000);
check('demo: outstanding Rs. 75,000', dTotals.outstandingMinor, 7500000);
check('demo: needs 3 of 5 received', s.needsSummary(demo), { total: 5, received: 3, waiting: 2, pct: 60 });
check('demo: validates clean', s.validatePortal(demo), []);
check('demo: money format', money.formatMoneyShort(dTotals.totalMinor, 'PKR'), 'Rs. 150,000');

/* blank factories */
check('blankPayment status', s.blankPayment().status, 'unpaid');
check('blankNeed status', s.blankNeed().status, 'waiting');
check('newId prefix', s.newId('m').indexOf('m_'), 0);

console.log('store.test.js: ' + passed + ' checks passed.');
