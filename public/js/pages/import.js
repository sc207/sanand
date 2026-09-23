/* Import from Excel.
   ------------------------------------------------------------
   A page rather than a sheet, which is the one deliberate exception to
   "every form lives in the sheet": this is not a form. It is a check
   screen, and the preview table it exists for needs the width of the
   content column to be read at all.

   Four steps, and the third is the point of the whole thing:

     1  What are you importing
     2  What the sheet must look like — shown BEFORE a file is asked
        for, with a template to download, because an operator who finds
        out about the columns from an error message has already wasted
        an afternoon in Excel
     3  What will happen — every row, what it will do, and what is
        wrong with it, with nothing yet written
     4  What did happen

   Step 3 is a dry run on the server. The Import button stays disabled
   while any row is wrong, because the server refuses a file with
   errors outright (all of it or none of it), and a button that only
   ever produces a refusal is worse than one that is plainly not ready.
*/
(function (global) {
  'use strict';

  const { esc, attr, icon, money } = UI;

  const STEPS = ['What', 'The format', 'Check', 'Done'];

  let state = null;
  const fresh = () => ({
    step: 0, kind: null, kinds: [], file: null, report: null, result: null,
    seva: null, busy: false, error: null,
    opts: { create_lookups: '', allow_duplicates: '' },
  });

  /* What each kind is for, in the trust's terms rather than the
     schema's. The server names the columns; this names the job. */
  const BLURB = {
    devotees: 'The register — people, not what they have taken. Use this for a list of names and mobile numbers you already hold.',
    sevarthi: 'A person, the seva they have taken, what they committed, and anything already paid. This is the one that gets a season of registrations in.',
    donations: 'Money or goods given outside a seva.',
    visits: 'Padhramni asked for, agreed, or already done.',
  };
  const KIND_ICON = { devotees: 'users', sevarthi: 'flame', donations: 'gift', visits: 'home' };

  /* What a column accepts, written as the operator would say it. The
     server knows the type; only this file knows how to explain it. */
  const TYPE_HELP = {
    text: 'Any text',
    mobile: 'Digits — at least 10. +91, spaces and dashes are fine',
    money: 'A number. 21000 or 21,000 or ₹21,000',
    date: 'A real date cell, or type 2027-02-04. Typed as 04/02/2027 it is read day-first',
    yesno: 'Yes or No (blank counts as No)',
    lookup: 'Must already be in the list, unless you tick "add new values"',
  };

  async function render(host) {
    if (!state) state = fresh();

    if (!UI.can('admin')) {
      host.innerHTML = `
        <div class="flex justify-between items-center mg-page-head"><div><h1 class="banner-title mg-page-title">Import from Excel</h1></div></div>
        <div class="card mg-empty">
          ${icon('shield', 'ico-lg mg-empty-mandala')}
          <p>Importing a spreadsheet is kept for an administrator.</p>
          <p class="mg-muted-xs">It writes devotees, seva and money in one go, which is why it is
             held back. Everything you do at the counter is still yours — ask an administrator,
             or switch account from the name at the top right.</p>
        </div>`;
      return;
    }

    if (!state.kinds.length) {
      host.innerHTML = `<div class="card loading">${icon('clock', 'ico-lg')} Loading…</div>`;
      try {
        state.kinds = await API.importKinds();
      } catch (e) {
        host.innerHTML = `<div class="card mg-empty"><p>${esc(e.message)}</p></div>`;
        return;
      }
    }

    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Import from Excel</h1>
          ${state.step === 0 ? `<p class="mg-page-sub">Bring a spreadsheet you already keep into
             the register. Nothing is saved until you have seen exactly what it will do.</p>` : ''}
        </div>
      </div>
      ${UI.steps(STEPS, state.step)}
      <div id="impBody">${BODY[state.step]()}</div>`;

    UI.bindSteps(host, (i) => { state.step = Math.min(i, state.step); paint(); });
    BIND[state.step](host);
    Lang.translateTree(host);
  }

  function paint() {
    const host = document.getElementById('main');
    if (host) render(host);
  }

  /* ============================================================
     1 — what
     ============================================================ */
  const BODY = {};
  const BIND = {};

  BODY[0] = () => `
    <div class="imp-kinds">
      ${state.kinds.map((k) => `
        <button type="button" class="imp-kind" data-kind="${attr(k.key)}">
          <span class="imp-kind-ico">${icon(KIND_ICON[k.key] || 'sheet', 'ico-lg')}</span>
          <span class="imp-kind-t">${esc(k.title)}</span>
          <span class="imp-kind-s">${esc(BLURB[k.key] || k.what)}</span>
          <span class="imp-kind-n">${k.columns.length} columns ·
            ${k.columns.filter((c) => c.required).length} of them required</span>
        </button>`).join('')}
    </div>`;

  BIND[0] = (host) => {
    host.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', async () => {
      state.kind = b.getAttribute('data-kind');
      state.file = null; state.report = null; state.error = null;
      state.step = 1;
      if (state.kind === 'sevarthi' && !state.seva) {
        try { state.seva = await API.sevaNames(); } catch (e) { state.seva = []; }
      }
      paint();
    }));
  };

  /* ============================================================
     2 — the format, then the file
     ============================================================ */
  const spec = () => state.kinds.find((k) => k.key === state.kind) || { columns: [] };

  BODY[1] = () => {
    const s = spec();
    const req = s.columns.filter((c) => c.required);
    return `
      <div class="card">
        <div class="imp-head">
          <h3 class="card-title">${esc(s.title)}</h3>
          <a class="btn btn-primary" href="${attr(API.importTemplateUrl(state.kind))}" download>
            ${icon('sheet', 'ico-sm')} Download the template</a>
        </div>
        <p class="imp-lede">One row per ${state.kind === 'devotees' ? 'person'
          : state.kind === 'sevarthi' ? 'seva taken'
          : state.kind === 'donations' ? 'donation' : 'visit'}, with the headings below in the
          first row.</p>
        <div class="imp-req">
          ${icon('alert', 'ico-sm')}
          <span>Required: ${req.map((c) => `<strong>${esc(c.label)}</strong>`).join(', ')}.
          Everything else may be left blank.</span>
        </div>
        <p class="imp-fine">Spelling, capitals and column order do not matter, and extra
          columns are ignored — so a sheet exported from this app can be handed straight
          back.</p>

        <div class="dt-wrap"><table class="custom-table dt imp-cols">
          <thead><tr><th>Heading</th><th>Needed</th><th>What goes in it</th></tr></thead>
          <tbody>${s.columns.map((c) => `
            <tr>
              <td data-k="Heading"><code>${esc(c.label)}</code></td>
              <td data-k="Needed">${c.required
                ? '<span class="badge badge-pending">Required</span>'
                : '<span class="mg-muted-xs">Optional</span>'}</td>
              <td data-k="What goes in it">${esc(TYPE_HELP[c.type] || 'Any text')}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>

        ${state.kind === 'sevarthi' ? sevaHelp() : ''}
        ${state.kind === 'sevarthi' ? giftHelp() : ''}
      </div>

      <div class="card">
        <h3 class="card-title">Choose the file</h3>
        <label class="imp-drop" id="impDrop">
          <input type="file" id="impFile" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
          ${icon('upload', 'ico-lg')}
          <span class="imp-drop-t">${state.file ? esc(state.file.name) : 'Drop the file here, or click to pick one'}</span>
          <span class="imp-drop-s">.xlsx from Excel, or .csv — both are read the same way</span>
        </label>
        ${state.error ? `<div class="imp-error">${icon('alert', 'ico-sm')} ${esc(state.error)}</div>` : ''}
        <div class="form-actions">
          <button type="button" class="btn btn-outline" data-back>Back</button>
          <button type="button" class="btn btn-primary" id="impCheck" ${state.file ? '' : 'disabled'}>
            ${state.busy ? 'Reading…' : 'Check the file'}</button>
        </div>
      </div>`;
  };

  /* The Seva column matches on the name, so the names are worth putting
     in front of the operator rather than leaving them to guess at a
     spelling and meet an error for it. */
  function sevaHelp() {
    const list = state.seva || [];
    const open = list.filter((p) => p.status !== 'closed');
    const rows = open.map((p) => `
      <tr><td data-k="Seva">${esc(p.name)}</td>
          <td data-k="Days">${p.days ? esc(p.days) : '<span class="mg-muted-xs">no date fixed — leave the date blank</span>'}</td></tr>`).join('');
    return UI.moreFields(`The ${open.length} seva names the Seva column accepts`, `
      <p class="mg-muted-xs">Write the name exactly as it appears here. Where a seva runs on
         several days, the Seva date column must name one of them.</p>
      <div class="dt-wrap imp-seva-wrap"><table class="custom-table dt imp-seva">
        <thead><tr><th>Seva</th><th>Days</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      { count: open.length });
  }

  function giftHelp() {
    return UI.moreFields('How Bapa\'s support should be written', `
      <ul class="imp-notes">
        <li><strong>Bapa covers part.</strong> Put his agreed share under
            <code>Bapa's agreed share</code> and leave <code>Gift from Bapa</code> as No.
            What he has actually handed over goes under <code>Paid by Bapa</code> — the agreement
            and the handover are two different facts.</li>
        <li><strong>A gift from Bapa.</strong> Write Yes under <code>Gift from Bapa</code>. The whole
            contribution becomes his, so <code>Bapa's agreed share</code> is filled in for you.</li>
        <li><strong>No half payment can become a gift.</strong> A row with Yes under
            <code>Gift from Bapa</code> and anything under <code>Paid by devotee</code> is refused,
            with the line named — only the full amount can be a gift.</li>
      </ul>`, {});
  }

  BIND[1] = (host) => {
    const input = host.querySelector('#impFile');
    const drop = host.querySelector('#impDrop');
    const take = (f) => { if (!f) return; state.file = f; state.error = null; paint(); };

    if (input) input.addEventListener('change', () => take(input.files && input.files[0]));
    if (drop) {
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
        e.preventDefault(); drop.classList.add('is-over');
      }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => {
        e.preventDefault(); drop.classList.remove('is-over');
      }));
      drop.addEventListener('drop', (e) => take(e.dataTransfer && e.dataTransfer.files[0]));
    }

    const back = host.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { state.step = 0; paint(); });

    const go = host.querySelector('#impCheck');
    if (go) go.addEventListener('click', async () => {
      if (!state.file || state.busy) return;
      state.busy = true; state.error = null; paint();
      try {
        state.report = await API.importPreview(state.kind, state.file, state.opts);
        state.busy = false;
        state.step = 2;
      } catch (e) {
        state.busy = false;
        state.error = e.message;
      }
      paint();
    });
  };

  /* ============================================================
     3 — check
     ============================================================ */
  const VERDICT = {
    create: ['Will be added', 'badge-ok'],
    update: ['Will be updated', 'badge-info'],
    skip: ['Already there — skipped', 'badge-cancelled'],
  };

  BODY[2] = () => {
    const r = state.report;
    if (!r) return '';
    if (r.fatal) {
      return `
        <div class="card">
          <div class="imp-error">${icon('alert', 'ico-sm')} ${esc(r.fatal)}</div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline" data-back>Pick another file</button>
            <a class="btn btn-primary" href="${attr(API.importTemplateUrl(state.kind))}" download>
              ${icon('sheet', 'ico-sm')} Download the template</a>
          </div>
        </div>`;
    }

    const c = r.counts || {};
    const bad = c.error || 0;
    /* The .stat-card-info wrapper is not decoration: .stat-card is a
       row-reverse flex, so without it the label and the figure become
       two items on ONE line and the strip reads "10 Rows read" instead
       of a figure above its name. Every other figure in the app wraps
       them; this one did not, and it showed up the moment the cells
       were narrow enough to matter. */
    const fig = (k, v, cls) => `
      <div class="stat-card ${cls || ''}">
        <div class="stat-card-info">
          <span class="stat-card-title">${esc(k)}</span>
          <span class="stat-card-value">${esc(String(v))}</span>
        </div>
      </div>`;

    const newLk = Object.entries(r.newLookups || {}).filter(([, v]) => v.length);
    const unknown = r.columns && r.columns.unknown && r.columns.unknown.length
      ? r.columns.unknown : [];

    return `
      <div class="card">
        <h3 class="card-title">${esc(state.file ? state.file.name : 'The file')} — what will happen</h3>
        <div class="stats-grid imp-figs">
          ${fig('Rows read', r.total)}
          ${fig('To be added', c.create || 0)}
          ${fig('To be updated', c.update || 0)}
          ${fig('Already there', c.skip || 0)}
          ${fig('To fix', bad, bad ? 'is-bad' : '')}
        </div>

        ${bad ? `<div class="imp-error">
            ${icon('alert', 'ico-sm')}
            <span><strong>${bad} row${bad === 1 ? '' : 's'} need${bad === 1 ? 's' : ''} fixing.</strong>
            Nothing is imported until every row is right — one half-imported sheet is far harder to
            untangle than one you fix and send again. Correct them in Excel and check the file again.</span>
          </div>` : `<div class="imp-ok">${icon('check', 'ico-sm')}
            <span>Every row reads correctly. Nothing has been saved yet.</span></div>`}

        ${unknown.length ? `<p class="mg-muted-xs imp-unknown">
            ${icon('alert', 'ico-sm')} Columns the import does not use, and will ignore:
            ${unknown.map((u) => `<code>${esc(u)}</code>`).join(' ')}</p>` : ''}

        <div class="imp-opts">
          <label class="imp-check">
            <input type="checkbox" id="impNewLk" ${state.opts.create_lookups ? 'checked' : ''}>
            <span><strong>Add samaj and categories the file mentions but the list does not have.</strong>
              <span class="mg-muted-xs">Off by default, so a misspelling becomes an error you can see
              rather than a second samaj nobody meant to create.</span></span>
          </label>
          ${newLk.length ? `<p class="mg-muted-xs imp-willadd">Would add:
            ${newLk.map(([t, vs]) => `${esc(t.replace(/_/g, ' '))} — ${vs.map((v) => `<strong>${esc(v)}</strong>`).join(', ')}`).join(' · ')}</p>` : ''}
          ${state.kind === 'sevarthi' ? `
            <label class="imp-check">
              <input type="checkbox" id="impDup" ${state.opts.allow_duplicates ? 'checked' : ''}>
              <span><strong>Register again even where this person already holds that seva.</strong>
                <span class="mg-muted-xs">Leave this off unless you mean it. It is what stops importing
                the same file twice from doubling every seva and every payment against it.</span></span>
            </label>` : ''}
        </div>

        ${rowsTable(r)}
        ${r.truncated ? `<p class="mg-muted-xs">Showing the first 200 rows. All ${r.total} were checked.</p>` : ''}

        ${state.error ? `<div class="imp-error">${icon('alert', 'ico-sm')} ${esc(state.error)}</div>` : ''}
        <div class="form-actions">
          <button type="button" class="btn btn-outline" data-back>Pick another file</button>
          <button type="button" class="btn btn-primary" id="impGo" ${bad || state.busy ? 'disabled' : ''}>
            ${state.busy ? 'Importing…' : `Import ${(c.create || 0) + (c.update || 0)} row${((c.create || 0) + (c.update || 0)) === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>`;
  };

  /* The preview table leads with the line number, because the only
     thing the operator can do with a wrong row is go back to that line
     in Excel. */
  function rowsTable(r) {
    const nameOf = (rec) => rec.full_name || rec.donor_name || rec.devotee_name || '';
    const rows = r.rows || [];
    if (!rows.length) return '';
    /* Wrong rows first: they are the only ones that need acting on, and
       hunting for six red lines in four hundred green ones is the sort
       of thing that gets skipped. */
    const sorted = rows.slice().sort((a, b) =>
      (b.errors.length ? 1 : 0) - (a.errors.length ? 1 : 0) || a.line - b.line);

    return `<div class="dt-wrap"><table class="custom-table dt imp-rows">
      <thead><tr><th class="n">Line</th><th>Who</th><th>What will happen</th></tr></thead>
      <tbody>${sorted.map((row) => {
        const [label, cls] = VERDICT[row.action] || VERDICT.create;
        const what = row.errors.length
          ? `<ul class="imp-errs">${row.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
          : `<span class="badge ${cls}">${esc(label)}</span>` +
            (row.existing ? ` <span class="mg-muted-xs">already on the register as ${esc(row.existing)}</span>` : '') +
            (row.reason ? ` <span class="mg-muted-xs">${esc(row.reason)}</span>` : '') +
            (row.poojaName ? ` <span class="mg-muted-xs">${esc(row.poojaName)} · ${esc(row.slotLabel || '')}</span>` : '') +
            (row.notes && row.notes.length
              ? `<ul class="imp-notes-sm">${row.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '');
        return `<tr class="${row.errors.length ? 'imp-bad' : ''}">
          <td class="n" data-k="Line">${esc(String(row.line))}</td>
          <td data-k="Who">${esc(nameOf(row.rec) || '—')}</td>
          <td data-k="What will happen">${what}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }

  BIND[2] = (host) => {
    const back = host.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { state.step = 1; state.report = null; state.error = null; paint(); });

    const recheck = async () => {
      state.busy = true; paint();
      try { state.report = await API.importPreview(state.kind, state.file, state.opts); state.error = null; }
      catch (e) { state.error = e.message; }
      state.busy = false; paint();
    };

    const lk = host.querySelector('#impNewLk');
    if (lk) lk.addEventListener('change', () => {
      state.opts.create_lookups = lk.checked ? '1' : '';
      recheck();
    });
    const dup = host.querySelector('#impDup');
    if (dup) dup.addEventListener('change', () => {
      state.opts.allow_duplicates = dup.checked ? '1' : '';
      recheck();
    });

    const go = host.querySelector('#impGo');
    if (go) go.addEventListener('click', async () => {
      if (state.busy) return;
      state.busy = true; state.error = null; paint();
      try {
        state.result = await API.importCommit(state.kind, state.file, state.opts);
        state.busy = false;
        state.step = 3;
      } catch (e) {
        state.busy = false;
        state.error = e.message;
      }
      paint();
    });
  };

  /* ============================================================
     4 — done
     ============================================================ */
  const WENT = {
    devotees: 'devotees',
    sevarthi: 'payments',
    donations: 'donations',
    visits: 'visits',
  };

  BODY[3] = () => {
    const res = state.result || {};
    const c = res.counts || {};
    const line = (k, v) => v ? `<li><strong>${esc(String(v))}</strong> ${esc(k)}</li>` : '';
    return `
      <div class="card imp-done">
        <div class="imp-ok">${icon('check', 'ico-lg')}
          <span><strong>Imported.</strong> ${esc(res.summary || '')}</span></div>
        <ul class="imp-tally">
          ${line('devotees added', c.created || c.devotees)}
          ${line('devotees updated', c.updated)}
          ${line('seva registered', c.seats)}
          ${line('payments recorded', c.payments)}
          ${line('donations recorded', c.donations)}
          ${line('padhramni recorded', c.visits)}
          ${c.money ? `<li><strong>${esc(money(c.money))}</strong> recorded against them</li>` : ''}
          ${line('rows already present, skipped', c.skipped)}
        </ul>
        <p class="mg-muted-xs">Every row was written to the change history, so the import can be
           traced the same way a counter entry can. Anything that needs correcting is corrected
           where it normally would be — this did not create a separate kind of record.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" data-again>Import another file</button>
          <button type="button" class="btn btn-primary" data-page="${attr(WENT[res.kind] || 'dashboard')}">
            See the ${esc(WENT[res.kind] || 'dashboard')}</button>
        </div>
      </div>`;
  };

  BIND[3] = (host) => {
    const again = host.querySelector('[data-again]');
    if (again) again.addEventListener('click', () => { state = fresh(); paint(); });
    /* data-page is the router's, so the "see the ..." button needs no
       handler here — app.js picks it up. */
  };

  global.Pages = global.Pages || {};
  global.Pages.import = {
    render(host) {
      state = fresh();                 // a fresh visit never resumes a half-done import
      return render(host);
    },
  };
})(window);
