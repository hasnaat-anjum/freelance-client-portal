/**
 * Freelance Client Portal Builder — browser app (js/app.js)
 *
 * Plain vanilla JS, no frameworks. The pure logic lives in money.js,
 * store.js and portal.js (all tested in Node); this file only does DOM
 * work, localStorage persistence, and file downloads.
 *
 * Data: portals are kept in localStorage under STORAGE_KEY as
 *   { version: 1, portals: [ ... ] }
 * The editor works on a deep copy of one portal; nothing is written
 * back until the user presses "Save portal" (or the page is left —
 * we also save on tab switch, so work is never lost silently).
 */

'use strict';

(function () {
  var Money = window.FCPMoney;
  var Store = window.FCPStore;
  var Portal = window.FCPPortal;

  var STORAGE_KEY = 'fcp-portals-v1';

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */

  var portals = loadPortals();
  var currentId = null;      // id of the portal open in the editor
  var draft = null;          // deep copy being edited
  var activeTab = 'milestones';

  /* ---------------------------------------------------------------- */
  /* Small helpers                                                     */
  /* ---------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function showNotice(text, kind) {
    var el = $('notice');
    el.textContent = text;
    el.className = 'notice notice-' + (kind || 'ok');
    el.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(function () { el.hidden = true; }, 6000);
  }

  function esc(s) { return Money.escapeHtml(s); }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------------------------------------------------------- */
  /* Persistence                                                       */
  /* ---------------------------------------------------------------- */

  function loadPortals() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.portals)) return [];
      return data.portals;
    } catch (e) {
      return [];
    }
  }

  function savePortals() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, portals: portals }));
    } catch (e) {
      showNotice('Could not save to this browser (storage is full or blocked). Export JSON to keep a copy.', 'error');
    }
  }

  function findPortal(id) {
    for (var i = 0; i < portals.length; i++) {
      if (portals[i].id === id) return portals[i];
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Dashboard                                                         */
  /* ---------------------------------------------------------------- */

  function renderDashboard() {
    var today = Money.todayStr();
    var sorted = Store.sortPortals(portals);

    var active = portals.filter(function (p) { return p.status === 'active'; }).length;
    var overdueCount = 0;
    var outstandingMinor = 0;
    var waitingNeeds = 0;
    portals.forEach(function (p) {
      var totals = Store.paymentTotals(p, today);
      overdueCount += totals.overdueCount;
      outstandingMinor += totals.outstandingMinor;
      waitingNeeds += Store.needsSummary(p).waiting;
    });

    $('dashboard-stats').innerHTML =
      statBox(active, 'active portal' + (active === 1 ? '' : 's')) +
      statBox(overdueCount, 'overdue payment' + (overdueCount === 1 ? '' : 's')) +
      statBox(waitingNeeds, 'item' + (waitingNeeds === 1 ? '' : 's') + ' waiting from clients') +
      statBox(portals.length, 'portal' + (portals.length === 1 ? '' : 's') + ' total');

    $('dashboard-empty').hidden = portals.length !== 0;
    var grid = $('portal-grid');
    grid.innerHTML = '';

    sorted.forEach(function (p) {
      var summary = Store.portalSummary(p, today);
      var alerts = Store.portalAlerts(p, today);
      var currency = (p.project && p.project.currency) || 'USD';
      var card = document.createElement('div');
      card.className = 'portal-card';
      card.innerHTML =
        '<h3>' + esc(p.project.title || '(Untitled project)') + '</h3>' +
        '<p class="client-line">' + esc(p.client.name || 'No client yet') +
        (p.client.company ? ' &middot; ' + esc(p.client.company) : '') + '</p>' +
        '<div class="progress-wrap"><div class="progress-bar"><div style="width: ' +
        summary.progress + '%"></div></div>' +
        '<span class="progress-num">' + summary.progress + '%</span></div>' +
        '<p class="portal-meta"><b>' + summary.milestonesDone + ' / ' + summary.milestonesTotal +
        '</b> milestones &middot; <b>' +
        Money.formatMoneyShort(summary.paidMinor, currency) + '</b> paid &middot; <b>' +
        Money.formatMoneyShort(summary.outstandingMinor, currency) + '</b> outstanding</p>' +
        '<ul class="alert-list">' + alerts.map(function (a) {
          return '<li class="alert-' + a.kind + '">' + esc(a.text) + '</li>';
        }).join('') + '</ul>' +
        '<div class="portal-actions">' +
        '<button class="btn btn-primary btn-small" data-act="open">Open</button>' +
        '<button class="btn btn-small" data-act="download">Download page</button>' +
        '<button class="btn btn-small" data-act="duplicate">Duplicate</button>' +
        '<button class="btn btn-danger btn-small" data-act="delete">Delete</button>' +
        '</div>';
      card.querySelector('[data-act="open"]').addEventListener('click', function () { openEditor(p.id); });
      card.querySelector('[data-act="download"]').addEventListener('click', function () { downloadPortal(p); });
      card.querySelector('[data-act="duplicate"]').addEventListener('click', function () { duplicatePortal(p.id); });
      card.querySelector('[data-act="delete"]').addEventListener('click', function () { deletePortal(p.id); });
      grid.appendChild(card);
    });
  }

  function statBox(value, label) {
    return '<div class="stat-box"><b>' + esc(String(value)) + '</b><span>' + esc(label) + '</span></div>';
  }

  /* ---------------------------------------------------------------- */
  /* Editor — open / save / close                                      */
  /* ---------------------------------------------------------------- */

  function openEditor(id) {
    var p = findPortal(id);
    if (!p) return;
    currentId = id;
    draft = JSON.parse(JSON.stringify(p));
    activeTab = 'milestones';
    $('view-dashboard').hidden = true;
    $('view-editor').hidden = false;
    fillDetailsForm();
    renderTabs();
    renderPreview();
    window.scrollTo({ top: 0 });
  }

  function closeEditor() {
    saveDraftQuietly();
    currentId = null;
    draft = null;
    $('view-editor').hidden = true;
    $('view-dashboard').hidden = false;
    renderDashboard();
  }

  /** Write the draft back into the list (validation errors block it). */
  function saveDraftQuietly() {
    if (!draft) return true;
    readDetailsForm();
    var problems = Store.validatePortal(draft);
    if (problems.length) {
      var el = $('details-errors');
      el.textContent = problems.join(' ');
      el.hidden = false;
      return false;
    }
    $('details-errors').hidden = true;
    draft.updatedAt = Money.todayStr();
    var idx = -1;
    for (var i = 0; i < portals.length; i++) {
      if (portals[i].id === draft.id) { idx = i; break; }
    }
    if (idx >= 0) portals[idx] = draft;
    else portals.push(draft);
    savePortals();
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Editor — details form                                             */
  /* ---------------------------------------------------------------- */

  function fillDetailsForm() {
    $('f-biz-name').value = draft.business.name || '';
    $('f-biz-email').value = draft.business.email || '';
    $('f-biz-phone').value = draft.business.phone || '';
    $('f-biz-website').value = draft.business.website || '';
    $('f-brand').value = draft.business.brandColor || '#1e3a5f';
    $('f-client-name').value = draft.client.name || '';
    $('f-client-company').value = draft.client.company || '';
    $('f-client-email').value = draft.client.email || '';
    $('f-project-title').value = draft.project.title || '';
    $('f-project-type').value = draft.project.type || 'Website';
    $('f-project-currency').value = draft.project.currency || 'USD';
    $('f-project-start').value = draft.project.startDate || '';
    $('portal-status').value = draft.status || 'active';
    $('editor-title').textContent = draft.project.title || 'Untitled project';
  }

  function readDetailsForm() {
    draft.business.name = $('f-biz-name').value.trim();
    draft.business.email = $('f-biz-email').value.trim();
    draft.business.phone = $('f-biz-phone').value.trim();
    draft.business.website = $('f-biz-website').value.trim();
    draft.business.brandColor = $('f-brand').value || '#1e3a5f';
    draft.client.name = $('f-client-name').value.trim();
    draft.client.company = $('f-client-company').value.trim();
    draft.client.email = $('f-client-email').value.trim();
    draft.project.title = $('f-project-title').value.trim();
    draft.project.type = $('f-project-type').value;
    draft.project.currency = $('f-project-currency').value;
    draft.project.startDate = $('f-project-start').value || Money.todayStr();
    draft.status = $('portal-status').value;
    $('editor-title').textContent = draft.project.title || 'Untitled project';
  }

  /* ---------------------------------------------------------------- */
  /* Editor — list tabs (milestones / payments / needs / updates / faqs) */
  /* ---------------------------------------------------------------- */

  var TAB_TITLES = {
    milestones: 'Milestones',
    payments: 'Payments',
    needs: 'What I need from you',
    updates: 'Updates',
    faqs: 'FAQs',
  };

  function renderTabs() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === activeTab);
    });
    ['milestones', 'payments', 'needs', 'updates', 'faqs'].forEach(function (key) {
      $('panel-' + key).hidden = key !== activeTab;
    });
    renderPanel(activeTab);
  }

  function renderPanel(key) {
    var panel = $('panel-' + key);
    var items = draft[key] || [];
    var html = '<p class="hint">' + tabHint(key) + '</p>';

    items.forEach(function (item, index) {
      html += '<div class="list-row" data-index="' + index + '">' +
        '<div class="row-head"><strong>' + esc(rowTitle(key, item, index)) + '</strong>' +
        '<span class="row-actions">' +
        '<button class="btn btn-small" data-move="-1" ' + (index === 0 ? 'disabled' : '') + ' type="button">&uarr;</button>' +
        '<button class="btn btn-small" data-move="1" ' + (index === items.length - 1 ? 'disabled' : '') + ' type="button">&darr;</button>' +
        '<button class="btn btn-danger btn-small" data-remove="1" type="button">Remove</button>' +
        '</span></div>' +
        rowFields(key, item, index) +
        '</div>';
    });

    html += '<button class="btn add-row-btn" data-add="1" type="button">+ Add ' +
      TAB_TITLES[key].toLowerCase().replace(/s$/, '').replace('what i need from you', 'item') + '</button>';
    panel.innerHTML = html;

    panel.querySelectorAll('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', function () { addItem(key); });
    });
    panel.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.list-row');
        removeItem(key, Number(row.getAttribute('data-index')));
      });
    });
    panel.querySelectorAll('[data-move]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.list-row');
        moveItem(key, Number(row.getAttribute('data-index')), Number(btn.getAttribute('data-move')));
      });
    });
    panel.querySelectorAll('input, select, textarea').forEach(function (input) {
      input.addEventListener('input', function () { onRowInput(key, input); });
      input.addEventListener('change', function () { onRowInput(key, input); });
    });
  }

  function tabHint(key) {
    return {
      milestones: 'The steps of the project, in order. The client sees each one with its date, status and deliverables.',
      payments: 'The payment schedule. Amounts are in the project currency; overdue lines are flagged automatically.',
      needs: 'Everything you are waiting on from the client — logins, photos, content, approvals. Received items show as done on the portal.',
      updates: 'Short dated notes for the client, newest first. One or two lines each is enough.',
      faqs: 'Questions clients always ask, answered once. They appear as expandable answers on the portal page.',
    }[key];
  }

  function rowTitle(key, item, index) {
    if (key === 'milestones') return item.title || 'Milestone ' + (index + 1);
    if (key === 'payments') return item.label || 'Payment ' + (index + 1);
    if (key === 'needs') return item.label || 'Item ' + (index + 1);
    if (key === 'updates') return item.date || 'Update ' + (index + 1);
    if (key === 'faqs') return item.q || 'Question ' + (index + 1);
    return 'Item ' + (index + 1);
  }

  function rowFields(key, item, index) {
    var p = 'data-key="' + key + '" data-index="' + index + '"';
    if (key === 'milestones') {
      return '<div class="form-grid">' +
        field('text', 'Title', item.title, p + ' data-field="title"', true) +
        field('date', 'Due date', item.date, p + ' data-field="date"') +
        fieldSelect('Status', item.status, [['todo', 'Not started'], ['in-progress', 'In progress'], ['done', 'Done']], p + ' data-field="status"') +
        field('text', 'Deliverables (comma separated)', (item.deliverables || []).join(', '), p + ' data-field="deliverables"') +
        fieldTextarea('Note for the client (optional)', item.note, p + ' data-field="note"', true) +
        '</div>';
    }
    if (key === 'payments') {
      return '<div class="form-grid">' +
        field('text', 'Label', item.label, p + ' data-field="label"', true) +
        field('text', 'Amount', Money.fromMinor(item.amountMinor || 0), p + ' data-field="amountMinor"') +
        field('date', 'Due date', item.dueDate, p + ' data-field="dueDate"') +
        fieldSelect('Status', item.status, [['unpaid', 'Unpaid'], ['paid', 'Paid']], p + ' data-field="status"') +
        '</div>';
    }
    if (key === 'needs') {
      return '<div class="form-grid">' +
        field('text', 'What you need', item.label, p + ' data-field="label"', true) +
        fieldSelect('Status', item.status, [['waiting', 'Waiting for client'], ['received', 'Received'], ['not-needed', 'Not needed']], p + ' data-field="status"') +
        fieldTextarea('Detail (optional)', item.detail, p + ' data-field="detail"', true) +
        '</div>';
    }
    if (key === 'updates') {
      return '<div class="form-grid">' +
        field('date', 'Date', item.date, p + ' data-field="date"') +
        fieldTextarea('Update', item.text, p + ' data-field="text"', true) +
        '</div>';
    }
    if (key === 'faqs') {
      return '<div class="form-grid">' +
        field('text', 'Question', item.q, p + ' data-field="q"', true) +
        fieldTextarea('Answer', item.a, p + ' data-field="a"', true) +
        '</div>';
    }
    return '';
  }

  function field(type, label, value, attrs, full) {
    return '<div class="field' + (full ? ' full' : '') + '"><label>' + esc(label) +
      '</label><input type="' + type + '" value="' + esc(value === undefined || value === null ? '' : value) +
      '" ' + attrs + '></div>';
  }

  function fieldTextarea(label, value, attrs, full) {
    return '<div class="field' + (full ? ' full' : '') + '"><label>' + esc(label) +
      '</label><textarea ' + attrs + '>' + esc(value || '') + '</textarea></div>';
  }

  function fieldSelect(label, value, options, attrs) {
    var opts = options.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === value ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
    return '<div class="field"><label>' + esc(label) + '</label><select ' + attrs + '>' + opts + '</select></div>';
  }

  function onRowInput(key, input) {
    var index = Number(input.getAttribute('data-index'));
    var fieldName = input.getAttribute('data-field');
    var item = draft[key][index];
    if (!item) return;
    if (fieldName === 'amountMinor') {
      var minor = Money.toMinor(input.value);
      item.amountMinor = minor === null ? 0 : minor;
    } else if (fieldName === 'deliverables') {
      item.deliverables = input.value.split(',').map(function (d) { return d.trim(); }).filter(Boolean);
    } else {
      item[fieldName] = input.value;
    }
    renderPreview();
    refreshRowTitles(key);
  }

  function refreshRowTitles(key) {
    var panel = $('panel-' + key);
    panel.querySelectorAll('.list-row').forEach(function (row) {
      var index = Number(row.getAttribute('data-index'));
      var strong = row.querySelector('.row-head strong');
      if (strong) strong.textContent = rowTitle(key, draft[key][index], index);
    });
  }

  function addItem(key) {
    var blank = {
      milestones: Store.blankMilestone,
      payments: Store.blankPayment,
      needs: Store.blankNeed,
      updates: Store.blankUpdate,
      faqs: Store.blankFaq,
    }[key]();
    draft[key].push(blank);
    renderPanel(key);
    renderPreview();
  }

  function removeItem(key, index) {
    draft[key].splice(index, 1);
    renderPanel(key);
    renderPreview();
  }

  function moveItem(key, index, delta) {
    var to = index + delta;
    if (to < 0 || to >= draft[key].length) return;
    var tmp = draft[key][index];
    draft[key][index] = draft[key][to];
    draft[key][to] = tmp;
    renderPanel(key);
    renderPreview();
  }

  /* ---------------------------------------------------------------- */
  /* Preview + export                                                  */
  /* ---------------------------------------------------------------- */

  function renderPreview() {
    if (!draft) return;
    readDetailsForm();
    var problems = Store.validatePortal(draft);
    if (problems.length) {
      var el = $('details-errors');
      el.textContent = problems.join(' ');
      el.hidden = false;
    } else {
      $('details-errors').hidden = true;
    }
    var frame = $('preview-frame');
    frame.srcdoc = Portal.buildStandalonePortalHTML(draft, Money.todayStr());
  }

  function downloadPortal(p) {
    var problems = Store.validatePortal(p);
    if (problems.length) {
      showNotice('Cannot export yet: ' + problems.join(' '), 'error');
      return;
    }
    download(Portal.portalFilename(p), Portal.buildStandalonePortalHTML(p, Money.todayStr()), 'text/html;charset=utf-8');
  }

  function duplicatePortal(id) {
    var p = findPortal(id);
    if (!p) return;
    var copy = JSON.parse(JSON.stringify(p));
    copy.id = Store.newId('p');
    copy.project = Object.assign({}, copy.project, { title: (copy.project.title || 'Untitled') + ' (copy)' });
    copy.createdAt = Money.todayStr();
    copy.updatedAt = Money.todayStr();
    portals.push(copy);
    savePortals();
    if (draft && draft.id === id) { draft = JSON.parse(JSON.stringify(copy)); currentId = copy.id; }
    showNotice('Duplicated as "' + copy.project.title + '".');
    if (currentId) { fillDetailsForm(); renderTabs(); renderPreview(); }
    renderDashboard();
  }

  function deletePortal(id) {
    var p = findPortal(id);
    if (!p) return;
    if (!window.confirm('Delete the portal "' + (p.project.title || 'Untitled') + '"? This cannot be undone.')) return;
    portals = portals.filter(function (x) { return x.id !== id; });
    savePortals();
    if (currentId === id) {
      currentId = null;
      draft = null;
      $('view-editor').hidden = true;
      $('view-dashboard').hidden = false;
    }
    renderDashboard();
    showNotice('Portal deleted.');
  }

  /* ---------------------------------------------------------------- */
  /* Top-level actions                                                 */
  /* ---------------------------------------------------------------- */

  function newPortal() {
    var p = Store.blankPortal();
    portals.push(p);
    savePortals();
    openEditor(p.id);
  }

  function loadDemo() {
    if (portals.some(function (p) { return p.project && p.project.title === 'Website Redesign for Bright Bakery'; })) {
      showNotice('The demo portal is already in your list.', 'error');
      return;
    }
    var demo = Store.demoPortal();
    portals.push(demo);
    savePortals();
    renderDashboard();
    showNotice('Demo portal loaded — open it to see a finished client page.');
  }

  function exportAllJSON() {
    download('freelance-client-portals.json',
      JSON.stringify({ version: 1, exportedAt: Money.todayStr(), portals: portals }, null, 2),
      'application/json');
  }

  function importJSONFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        showNotice('That file is not valid JSON.', 'error');
        return;
      }
      var problems = Store.validateImport(data);
      if (problems.length) {
        showNotice('Import blocked: ' + problems.slice(0, 3).join(' '), 'error');
        return;
      }
      var added = 0;
      data.portals.forEach(function (p) {
        if (!findPortal(p.id)) { portals.push(p); added += 1; }
      });
      savePortals();
      renderDashboard();
      showNotice('Imported ' + added + ' portal' + (added === 1 ? '' : 's') + ' (' +
        (data.portals.length - added) + ' already existed).');
    };
    reader.readAsText(file);
  }

  /* ---------------------------------------------------------------- */
  /* Wiring                                                            */
  /* ---------------------------------------------------------------- */

  function bind() {
    $('btn-new-portal').addEventListener('click', newPortal);
    $('btn-empty-new').addEventListener('click', newPortal);
    $('btn-load-demo').addEventListener('click', loadDemo);
    $('btn-empty-demo').addEventListener('click', loadDemo);
    $('btn-export-json').addEventListener('click', exportAllJSON);
    $('btn-import-json').addEventListener('click', function () { $('import-file').click(); });
    $('import-file').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importJSONFile(e.target.files[0]);
      e.target.value = '';
    });

    $('btn-back').addEventListener('click', closeEditor);
    $('btn-save').addEventListener('click', function () {
      if (saveDraftQuietly()) {
        renderPreview();
        showNotice('Portal saved.');
      }
    });
    $('btn-download-html').addEventListener('click', function () {
      if (saveDraftQuietly()) downloadPortal(draft);
    });
    $('btn-print-portal').addEventListener('click', function () {
      if (saveDraftQuietly()) {
        var w = window.open('', '_blank');
        if (w) {
          w.document.write(Portal.buildStandalonePortalHTML(draft, Money.todayStr()));
          w.document.close();
          w.focus();
          w.print();
        }
      }
    });
    $('btn-duplicate').addEventListener('click', function () {
      if (saveDraftQuietly()) duplicatePortal(currentId);
    });
    $('btn-delete').addEventListener('click', function () { deletePortal(currentId); });

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        saveDraftQuietly();
        activeTab = tab.getAttribute('data-tab');
        renderTabs();
      });
    });

    // Details form: re-render the preview live as the freelancer types.
    ['f-biz-name', 'f-biz-email', 'f-biz-phone', 'f-biz-website', 'f-brand',
     'f-client-name', 'f-client-company', 'f-client-email',
     'f-project-title', 'f-project-type', 'f-project-currency', 'f-project-start',
     'portal-status'].forEach(function (id) {
      $(id).addEventListener('input', renderPreview);
      $(id).addEventListener('change', renderPreview);
    });
  }

  bind();
  renderDashboard();
})();
