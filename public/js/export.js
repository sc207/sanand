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

  /* A4 landscape at these margins is about 277mm of printable width. A
     table with 15–17 columns wants half as much again, and a normal
     (auto) table layout cannot shrink below its min-content width — so
     it simply ran off the right edge and the last columns were cut off
     the page with nothing to say they existed.

     Three things together fix it, and all three are needed:
       1. `table-layout: fixed` — the width is decided by the colgroup,
          not the content, so the table can never exceed the page.
       2. cells wrap. Under a fixed layout a `nowrap` cell still spills
          out of its own column, so wide tables drop nowrap and break
          long values instead.
       3. the type scales down with the column count, so wrapping does
          not turn every row into four lines. */
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
  table.ex {
    width: 100%; table-layout: fixed; border-collapse: collapse;
    font-size: var(--ex-fs, .76rem);
  }
  table.ex th {
    text-align: left; padding: .4rem var(--ex-pad, .5rem); background: var(--warm-ivory);
    border-bottom: 1.5px solid var(--warm-border); font-weight: 700; color: var(--dark-brown);
  }
  table.ex td {
    padding: .34rem var(--ex-pad, .5rem); border-bottom: 1px solid var(--warm-border);
    vertical-align: top;
  }
  /* Free text may break mid-word to fit its column. Numbers and dates
     may NOT: an amount split as 11,00,0 / 00 across two lines is worse
     than not printing it, so those keep nowrap however tight it gets
     and the colgroup gives them room instead.
     (No backticks in here: this whole block is a template literal, and
     one inside a CSS comment ends the string. That is how this rule
     broke the first time — everything after it parsed as JS.) */
  table.ex td { overflow-wrap: anywhere; }
  table.ex td.n, table.ex th.n { text-align: right; }
  /* nowrap is for the VALUES, never the headings: "Paid by devotee" is
     a phrase and must be allowed onto a second line, or it runs into
     the next column's heading. */
  table.ex td.n { font-variant-numeric: tabular-nums; white-space: nowrap; overflow-wrap: normal; }
  table.ex td.w { white-space: nowrap; overflow-wrap: normal; }
  table.ex th { overflow-wrap: anywhere; word-break: normal; hyphens: none; }
  table.ex tbody tr:nth-child(even) td { background: #FCF8F0; }
  .ex-foot { margin-top: .8rem; font-size: .72rem; color: var(--muted-brown);
             display: flex; justify-content: space-between; gap: 1rem; }
  /* A long report must not lose its column headings on page two. */
  thead { display: table-header-group; }
  tr { break-inside: avoid; }`;

  function pdf(opt) {
    const rows = opt.rows || [];
    if (!rows.length) { UI.toast('Nothing to print in this view.', 'err'); return; }

    /* A sheet of paper is not a spreadsheet. The devotee register has
       seventeen columns; on A4 landscape that is about 60px each, which
       is narrower than a name or an amount, and the result fits only by
       becoming unreadable. Columns marked `print: false` stay in the
       CSV and leave the printed copy — and the sheet says so, so nobody
       reads it as the whole record. */
    const cols = opt.columns.filter((c) => c.print !== false);
    const dropped = opt.columns.filter((c) => c.print === false).map((c) => c.label);
    const numeric = (c) => c.type === 'money' || c.type === 'num';
    /* Dates and short labels must not break across lines — "2027-02-" on
       one row and "04" on the next is unreadable on a printed sheet.
       Long free text (address, note, seva name) is left to wrap. */
    /* nowrap is decided per cell, not per column. "2027-02-04" must not
       break; "Date to be announced" lives in the same column and must,
       or it runs straight over the next one. A value with no space is
       an atom; anything else is a phrase. */
    const headCls = (c) => numeric(c) ? 'n' : '';
    const cls = (c, r) => {
      if (numeric(c)) return 'n';
      if (!(c.type === 'date' || c.nowrap)) return '';
      const v = String(c.value(r) == null ? '' : c.value(r));
      return /\s/.test(v) ? '' : 'w';
    };

    /* Under a fixed layout every column would otherwise get an equal
       share — starving a name to give a one-digit count the same width.
       Each column gets a base weight for the kind of thing it holds,
       raised to fit its widest *unbreakable* run: the whole value in a
       nowrap column, the longest word elsewhere. Hand-tuned weights
       were always one dataset away from being a pixel too narrow;
       measuring the content is self-correcting. */
    const WEIGHT = { num: 0.6, money: 0.95, date: 0.85 };
    const atomOf = (c) => {
      const unbreakable = numeric(c) || c.type === 'date' || c.nowrap;
      let longest = String(c.label || '').split(/\s+/)
        .reduce((a, w) => Math.max(a, w.length), 0);
      for (const r of rows) {
        const v = String(cell(c, r)).replace(/<[^>]*>/g, '');
        const n = unbreakable ? v.length
          : v.split(/\s+/).reduce((a, w) => Math.max(a, w.length), 0);
        if (n > longest) longest = n;
      }
      return longest;
    };
    const weightOf = (c) => {
      const base = c.weight || WEIGHT[c.type] || (c.nowrap ? 1 : 1.35);
      // ~10 characters per unit of weight, plus the cell's own padding.
      return Math.max(base, atomOf(c) / 10 + 0.15);
    };
    const totalWeight = cols.reduce((a, c) => a + weightOf(c), 0);
    const colgroup = `<colgroup>${cols.map((c) =>
      `<col style="width:${(weightOf(c) / totalWeight * 100).toFixed(3)}%">`).join('')}</colgroup>`;

    /* Shrink the type as the table gets busier, so wrapping does not
       turn every row into a paragraph. 9 columns keeps the comfortable
       size; 17 lands near .6rem, which is still readable in print. */
    const n = cols.length;
    const tight = n > 10;
    const fs = n <= 9 ? 0.76 : Math.max(0.6, 0.76 - (n - 9) * 0.02);
    const pad = tight ? 0.32 : 0.5;

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
        <table class="ex ${tight ? 'ex-tight' : ''}"
               style="--ex-fs:${fs}rem;--ex-pad:${pad}rem">
          ${colgroup}
          <thead><tr>${cols.map((c) =>
            `<th class="${headCls(c)}">${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map((r) => `<tr>${cols.map((c) =>
              `<td class="${cls(c, r)}">${cell(c, r)}</td>`).join('')}</tr>`).join('')}
          </tbody>
          ${opt.totals ? `<tfoot><tr>${cols.map((c) => {
            const t = opt.totals[c.key];
            /* A totals row carries both sums and a label ("Total (28)"),
               so format by the value's own type, not the column's —
               num() over a label produced a cell reading "NaN". */
            const text = t === undefined || t === null ? ''
              : typeof t === 'number' ? (c.type === 'money' ? money(t) : num(t))
              : String(t);
            return `<td class="${headCls(c)}" style="font-weight:800;border-top:2px solid var(--warm-border)">${
              esc(text)}</td>`;
          }).join('')}</tr></tfoot>` : ''}
        </table>
        <div class="ex-foot">
          <span>${esc(opt.footer || 'Shri Vihat Meldi Dham — Sanand')}</span>
          <span>${dropped.length
            ? esc('Also in the Excel export: ' + dropped.join(', ')) + ' · '
            : ''}${esc(num(rows.length))} row${rows.length === 1 ? '' : 's'}</span>
        </div>
      </div>`;

    global.openPrintDoc({ title: opt.title || 'Report', wrapClass: 'ex-wrap', inner, css: PRINT_CSS });
  }

  /* ---------- the toolbar ----------
     One pair of buttons, identical on every page, so an operator who
     finds the export once finds it everywhere. */
  function toolbar(id) {
    /* The words are wrapped so a phone can drop them and keep the two
       marks, which lets both buttons share a row with the page's own
       primary action instead of taking a row of their own above the
       list. `title` and `aria-label` carry the name either way, so the
       button is never a bare icon to a screen reader or a long press. */
    return `<div class="ex-bar" id="${attr(id || 'exportBar')}">
      <button type="button" class="btn btn-outline mg-btn-xs" data-export="pdf"
              title="Print / PDF" aria-label="Print / PDF">
        ${icon('print', 'ico-sm')}<span class="ex-label">Print / PDF</span></button>
      <button type="button" class="btn btn-outline mg-btn-xs" data-export="csv"
              title="Excel (CSV)" aria-label="Excel (CSV)">
        ${icon('sheet', 'ico-sm')}<span class="ex-label">Excel (CSV)</span></button>
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
