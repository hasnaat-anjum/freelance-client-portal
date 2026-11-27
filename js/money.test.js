/**
 * Tests for js/money.js — run with: node js/money.test.js
 * No dependencies. Exits non-zero on the first failure.
 */
'use strict';

const m = require('./money.js');

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

/* toMinor */
check('toMinor plain', m.toMinor('85000'), 8500000);
check('toMinor decimals', m.toMinor('85,000.50'), 8500050);
check('toMinor number input', m.toMinor(12.34), 1234);
check('toMinor zero', m.toMinor('0'), 0);
check('toMinor empty', m.toMinor(''), null);
check('toMinor letters', m.toMinor('abc'), null);
check('toMinor negative', m.toMinor('-5'), null);
check('toMinor 3 decimals', m.toMinor('1.234'), null);
check('toMinor spaces', m.toMinor('  100.25  '), 10025);

/* fromMinor / formatMoney */
check('fromMinor', m.fromMinor(8500050), 85000.5);
check('formatMoney PKR', m.formatMoney(8500050, 'PKR'), 'Rs. 85,000.50');
check('formatMoney USD', m.formatMoney(123456, 'USD'), '$1,234.56');
check('formatMoney negative', m.formatMoney(-5000, 'USD'), '-$50.00');
check('formatMoney zero', m.formatMoney(0, 'EUR'), '€0.00');
check('formatMoney unknown currency falls back to USD', m.formatMoney(100, 'XXX'), '$1.00');
check('formatMoneyShort whole', m.formatMoneyShort(8500000, 'PKR'), 'Rs. 85,000');
check('formatMoneyShort with cents', m.formatMoneyShort(8500050, 'PKR'), 'Rs. 85,000.50');

/* dates */
check('todayStr format', /^\d{4}-\d{2}-\d{2}$/.test(m.todayStr()), true);
check('isValidDate ok', m.isValidDate('2026-11-27'), true);
check('isValidDate Feb 30', m.isValidDate('2026-02-30'), false);
check('isValidDate garbage', m.isValidDate('not-a-date'), false);
check('daysBetween', m.daysBetween('2026-11-01', '2026-11-21'), 20);
check('daysBetween negative', m.daysBetween('2026-11-21', '2026-11-01'), -20);
check('prettyDate', m.prettyDate('2026-11-27'), '27 Nov 2026');
check('prettyDate invalid passthrough', m.prettyDate('junk'), 'junk');

/* text helpers */
check('escapeHtml', m.escapeHtml('<b>"A" & \'B\'</b>'),
  '&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
check('escapeHtml null', m.escapeHtml(null), '');
check('slugify', m.slugify('Website Redesign! For Bright Bakery'), 'website-redesign-for-bright-bakery');
check('slugify empty', m.slugify(''), 'portal');

/* csv */
check('csvCell plain', m.csvCell('hello'), 'hello');
check('csvCell with comma', m.csvCell('a,b'), '"a,b"');
check('csvCell with quote', m.csvCell('say "hi"'), '"say ""hi"""');
check('buildCSV', m.buildCSV(['a', 'b'], [[1, 'x,y'], [2, 'z']]),
  'a,b\n1,"x,y"\n2,z\n');

console.log('money.test.js: ' + passed + ' checks passed.');
