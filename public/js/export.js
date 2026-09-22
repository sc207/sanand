/* ============================================================
   EXPORT — the list you are looking at, as a file
   ------------------------------------------------------------
   Two outputs, one definition. A page declares its columns once
   (`{ key, label, value(row), type }`) and both the spreadsheet and the
   printed sheet are built from that list, so they can never disagree
   about what a report contains.

   Three rules, learned from doing this badly elsewhere:

   1. **Export what the filter says, not what the screen shows.** The
      lists page at 25 rows; an export that stopped at the page boundary
      would quietly hand the trust a quarter of the answer. Pages keep
      their fetched rows in module state, so the export takes all of
      them — filtered and sorted as the operator left them.
   2. **Say what it was filtered by.** A printed sheet that says
      "15 sevarthi" without saying "still to collect" is a sheet nobody
      can check a month later. Every export stamps its filters, its
      totals and when it was taken.
   3. **Amounts are numbers, not text.** ₹21,00,000 in a CSV cell is a
      string Excel cannot sum. The formatted form belongs on the printed
      sheet; the spreadsheet gets 2100000.
   ============================================================ */
(function (global) {
  'use strict';
  const { esc, attr, money, num, fmtDate, icon } = UI;

  /* ---------- CSV ----------
     Excel opens a .csv natively, which is why this is the "Excel"
     export: it needs no library, and nothing is fetched at runtime —
     the app has to work at the mandir with no connection. */

  /** A leading = + - @ makes Excel treat the cell as a formula, so a
      devotee's note could execute when the file is opened. Prefix it
      with an apostrophe, which Excel strips on display. */
  function deFang(s) {
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  }

  function csvCell(v, type) {
    if (v === null || v === undefined) return '';
    if (type === 'money' || type === 'num') {
      const n = Number(v);
      return Number.isFinite(n) ? String(n) : '';   // bare, so SUM() works
    }
    const s = deFang(String(v));
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCsv(columns, rows, meta) {
    const lines = [];
    /* Meta rides above the header as its own rows. Excel shows them as
       ordinary cells and they survive a re-save, unlike a comment. */
    (meta || []).forEach(([k, v]) => lines.push(csvCell(k) + ',' + csvCell(v)));
    if (meta && meta.length) lines.push('');
    lines.push(columns.map((c) => csvCell(c.label)).join(','));
    rows.forEach((r) => {
      lines.push(columns.map((c) => csvCell(c.value(r), c.type)).join(','));
    });
    return lines.join('\r\n');
  }

  /** Save a string as a file. The BOM matters: without it Excel reads
      the bytes as the system codepage and every Gujarati name becomes
      mojibake. */
  function download(name, text, mime) {
    const blob = new Blob(['﻿' + text], { type: (mime || 'text/csv') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const stamp = () => new Date().toLocaleDateString('en-CA');
  const safeName = (s) => String(s).replace(/[<>:"/\\|?*]+/g, '_').replace(/\s+/g, '-');

  function csv(opt) {
    const rows = opt.rows || [];
    if (!rows.length) { UI.toast('Nothing to export in this view.', 'err'); return; }
    download(`${safeName(opt.filename || 'export')}-${stamp()}.csv`,
      toCsv(opt.columns, rows, opt.meta), 'text/csv');
    UI.toast(`${num(rows.length)} row${rows.length === 1 ? '' : 's'} exported`, 'ok');
  }

  /* ---------- printed sheet / PDF ----------
     openPrintDoc links the real stylesheets, so the print dialog's
     "Save as PDF" produces something that matches the app rather than a
     bare table. No PDF library is involved, and none can be: the
     browser's own print engine is the only one available offline. */

  function cell(c, r) {
    const v = c.value(r);
    if (c.type === 'money') return esc(money(Number(v) || 0));
    if (c.type === 'num') return esc(num(Number(v) || 0));
    return esc(v == null ? '' : String(v));
  }

  const PRINT_CSS = `
  @page { size: A4 landscape; margin: 12mm 10mm; }
  .ex-doc { padding: 0; }
  .ex-head { border-bottom: 2px solid var(--primary-maroon); padding-bottom: .6rem; margin-bottom: .9rem; }
  .ex-title { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 800;
              color: var(--primary-maroon); margin: 0; }
  .ex-sub { font-size: .85rem; color: var(--muted-brown); margin: .2rem 0 0; }
  .ex-meta { display: flex; flex-wrap: wrap; gap: .3rem 1.4rem; margin: .55rem 0 0;
             font-size: .78rem; color: var(--dark-brown); }
  .ex-meta b { color: var(--primary-maroon); }
  table.ex { width: 100%; border-collapse: collapse; font-size: .76rem; }
  table.ex th {
    text-align: left; padding: .4rem .5rem; background: var(--warm-ivory);
    border-bottom: 1.5px solid var(--warm-border); font-weight: 700; color: var(--dark-brown);
    white-space: nowrap;
  }
  table.ex td { padding: .34rem .5rem; border-bottom: 1px solid var(--warm-border); vertical-align: top; }
  table.ex td.n, table.ex th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table.ex td.w, table.ex th.w { white-space: nowrap; }
  table.ex tbody tr:nth-child(even) td { background: #FCF8F0; }
  .ex-foot { margin-top: .8rem; font-size: .72rem; color: var(--muted-brown);
             display: flex; justify-content: space-between; gap: 1rem; }
  /* A long report must not lose its column headings on page two. */
  thead { display: table-header-group; }
  tr { break-inside: avoid; }`;

  function pdf(opt) {
    const rows = opt.rows || [];
    if (!rows.length) { UI.toast('Nothing to print in this view.', 'err'); return; }
    const cols = opt.columns;
    const numeric = (c) => c.type === 'money' || c.type === 'num';
    /* Dates and short labels must not break across lines — "2027-02-" on
       one row and "04" on the next is unreadable on a printed sheet.
       Long free text (address, note, seva name) is left to wrap. */
    const cls = (c) => numeric(c) ? 'n' : (c.type === 'date' || c.nowrap) ? 'w' : '';

    const inner = `
      <div class="ex-doc">
        <div class="ex-head">
          <h1 class="ex-title">${esc(opt.title || 'Report')}</h1>
          ${opt.subtitle ? `<p class="ex-sub">${esc(opt.subtitle)}</p>` : ''}
          <div class="ex-meta">
            ${(opt.meta || []).map(([k, v]) =>
              `<span><b>${esc(k)}:</b> ${esc(v)}</span>`).join('')}
          </div>
        </div>
        <table class="ex">
          <thead><tr>${cols.map((c) =>
            `<th class="${cls(c)}">${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map((r) => `<tr>${cols.map((c) =>
              `<td class="${cls(c)}">${cell(c, r)}</td>`).join('')}</tr>`).join('')}
          </tbody>
          ${opt.totals ? `<tfoot><tr>${cols.map((c) => {
            const t = opt.totals[c.key];
            /* A totals row carries both sums and a label ("Total (28)"),
               so format by the value's own type, not the column's —
               num() over a label produced a cell reading "NaN". */
            const text = t === undefined || t === null ? ''
              : typeof t === 'number' ? (c.type === 'money' ? money(t) : num(t))
              : String(t);
            return `<td class="${cls(c)}" style="font-weight:800;border-top:2px solid var(--warm-border)">${
              esc(text)}</td>`;
          }).join('')}</tr></tfoot>` : ''}
        </table>
        <div class="ex-foot">
          <span>${esc(opt.footer || 'Shri Vihat Meldi Dham — Sanand')}</span>
          <span>${esc(num(rows.length))} row${rows.length === 1 ? '' : 's'}</span>
        </div>
      </div>`;

    global.openPrintDoc({ title: opt.title || 'Report', wrapClass: 'ex-wrap', inner, css: PRINT_CSS });
  }

  /* ---------- the toolbar ----------
     One pair of buttons, identical on every page, so an operator who
     finds the export once finds it everywhere. */
  function toolbar(id) {
    return `<div class="export-bar" id="${attr(id || 'exportBar')}">
      <button type="button" class="btn btn-outline mg-btn-xs" data-export="pdf">
        ${icon('print', 'ico-sm')} Print / PDF</button>
      <button type="button" class="btn btn-outline mg-btn-xs" data-export="csv">
        ${icon('sheet', 'ico-sm')} Excel (CSV)</button>
    </div>`;
  }

  /** Wire the toolbar. `build()` is called at click time, not at render
      time, so the export always reflects the filters as they are now. */
  function bindToolbar(root, build) {
    if (!root) return;
    root.querySelectorAll('[data-export]').forEach((b) =>
      b.addEventListener('click', () => {
        const spec = build();
        if (!spec) return;
        (b.getAttribute('data-export') === 'csv' ? csv : pdf)(spec);
      }));
  }

  global.Export = { csv, pdf, toolbar, bindToolbar, toCsv, download };
})(window);
