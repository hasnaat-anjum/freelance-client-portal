/**
 * Tests for js/portal.js — run with: node js/portal.test.js
 * No dependencies. Exits non-zero on the first failure.
 */
'use strict';

const portal = require('./portal.js');
const store = require('./store.js');

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

function contains(name, haystack, needle) {
  if (haystack.indexOf(needle) === -1) {
    console.error('FAIL: ' + name + '\n  missing: ' + JSON.stringify(needle));
    process.exit(1);
  }
  passed += 1;
}

function notContains(name, haystack, needle) {
  if (haystack.indexOf(needle) !== -1) {
    console.error('FAIL: ' + name + '\n  should not contain: ' + JSON.stringify(needle));
    process.exit(1);
  }
  passed += 1;
}

const TODAY = '2026-11-27';
const demo = store.demoPortal();

/* filename */
check('portalFilename company slug', portal.portalFilename(demo), 'client-portal-bright-bakery.html');
const noCompany = store.blankPortal();
noCompany.client = { name: 'John Doe', company: '', email: '' };
noCompany.project = { title: 'Logo', type: 'Design', startDate: '2026-11-27', currency: 'USD' };
check('portalFilename falls back to client name', portal.portalFilename(noCompany), 'client-portal-john-doe.html');

/* pills */
check('milestonePill done', portal.milestonePill({ status: 'done' }), { text: 'Done', cls: 'pill-done' });
check('milestonePill in-progress', portal.milestonePill({ status: 'in-progress' }), { text: 'In progress', cls: 'pill-progress' });
check('milestonePill todo', portal.milestonePill({ status: 'todo' }), { text: 'Not started', cls: 'pill-todo' });
check('paymentPill paid', portal.paymentPill({ status: 'paid' }, TODAY), { text: 'Paid', cls: 'pill-done' });
check('paymentPill overdue', portal.paymentPill(
  { status: 'unpaid', dueDate: '2026-11-10' }, TODAY), { text: 'Overdue', cls: 'pill-overdue' });
check('paymentPill upcoming', portal.paymentPill(
  { status: 'unpaid', dueDate: '2026-12-11' }, TODAY), { text: 'Due 11 Dec 2026', cls: 'pill-todo' });
check('needPill received', portal.needPill({ status: 'received' }), { text: 'Received', cls: 'pill-done' });
check('needPill waiting', portal.needPill({ status: 'waiting' }), { text: 'Waiting for you', cls: 'pill-waiting' });

/* full HTML — demo portal */
const html = portal.buildStandalonePortalHTML(demo, TODAY);
contains('html has doctype', html, '<!DOCTYPE html>');
contains('html has viewport', html, 'width=device-width');
contains('html has project title', html, 'Website Redesign for Bright Bakery');
contains('html greets client', html, 'Hi Ayesha Khan');
contains('html has company', html, 'Bright Bakery');
contains('html has progress 50%', html, '50%');
contains('html has paid amount', html, 'Rs. 75,000');
contains('html has total amount', html, 'Rs. 150,000');
contains('html has outstanding', html, 'Rs. 75,000 outstanding');
contains('html has milestone', html, 'Online ordering + payments');
contains('html has deliverable', html, 'Cash on delivery checkout');
contains('html has payment label', html, 'Mid-project payment (25%)');
contains('html has need label', html, 'Delivery areas &amp; charges');
contains('html has update text', html, 'Menu and ordering pages are done.');
contains('html has FAQ', html, 'How do I see the work in progress?');
contains('html has brand color', html, '#1e3a5f');
contains('html has next milestone', html, 'Next up:');
contains('html has no external script', html, '</style>');
notContains('html has no <script>', html, '<script');
notContains('html has no external http link to a CDN', html, 'https://cdn');
notContains('html has no unescaped script tag from data', html, '<script>');

/* escaping — hostile content must not break the page */
const evil = store.blankPortal();
evil.business = { name: 'Evil <script>alert(1)</script>', email: '', phone: '', website: '', brandColor: '#000000' };
evil.client = { name: 'A & B <b>', company: '', email: '' };
evil.project = { title: 'X <img src=x onerror=alert(1)>', type: 'Website', startDate: '2026-11-27', currency: 'USD' };
evil.milestones = [{ id: 'm1', title: '<b>bold</b>', date: '2026-11-28', status: 'todo', deliverables: ['<i>ital</i>'], note: 'a & b' }];
const evilHtml = portal.buildStandalonePortalHTML(evil, TODAY);
contains('evil: script escaped', evilHtml, '&lt;script&gt;alert(1)&lt;/script&gt;');
contains('evil: img escaped', evilHtml, '&lt;img src=x onerror=alert(1)&gt;');
contains('evil: ampersand escaped', evilHtml, 'A &amp; B');
notContains('evil: no raw <script>', evilHtml, '<script>alert');
notContains('evil: no raw <img', evilHtml, '<img src=x');

/* blank portal still renders */
const blankHtml = portal.buildStandalonePortalHTML(store.blankPortal(), TODAY);
contains('blank: renders', blankHtml, '<!DOCTYPE html>');
contains('blank: empty milestones message', blankHtml, 'Milestones will appear here');
contains('blank: zero total shows fully paid', blankHtml, 'Fully paid — thank you!');
contains('blank: no milestones yet shows 0%', blankHtml, '0%');

console.log('portal.test.js: ' + passed + ' checks passed.');
