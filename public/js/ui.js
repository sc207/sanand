/* Shared UI primitives: escaping, formatting, the sheet (modal),
   toasts, and standard loading/empty/error blocks.

   Everything user-entered is rendered through esc() — never inject a
   raw value into innerHTML. */
(function (global) {
  'use strict';

  /* ---------- escaping & formatting ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
  const attr = esc;

  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const num = (n) => Number(n || 0).toLocaleString('en-IN');

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];

  /** A pooja whose date the trust has not fixed yet. */
  const TBD = 'Date to be announced';
  function fmtRange(start, end) {
    if (!start || !end) return TBD;
    return start === end ? fmtDateLong(start) : `${fmtDate(start)} – ${fmtDate(end)}`;
  }

  function fmtDate(iso) {
    if (!iso) return TBD;
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return esc(iso);
    return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
  }
  function fmtDateLong(iso) {
    if (!iso) return TBD;
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return esc(iso);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }
  const todayISO = () => new Date().toLocaleDateString('en-CA');   // YYYY-MM-DD, local
  const monthISO = () => todayISO().slice(0, 7);

  function icon(name, cls) {
    return `<svg class="ico ${cls || ''}" aria-hidden="true"><use href="/assets/icons.svg#${attr(name)}"/></svg>`;
  }

  /* ---------- state blocks ---------- */
  const loading = (rows) =>
    `<div class="loading">${'<div class="skeleton"></div>'.repeat(rows || 3)}</div>`;

  /* sk's empty state: a card with a mandala mark, heading and line. */
  const empty = (title, sub, iconName) => `
    <div class="card mg-empty">
      <div class="mg-empty-mandala">${icon(iconName || 'search')}</div>
      <h3>${esc(title)}</h3>
      ${sub ? `<p>${esc(sub)}</p>` : ''}
    </div>`;

  const errorState = (msg) => `
    <div class="card mg-empty error-state">
      ${icon('alert')}
      <h3>Could not load</h3>
      <p>${esc(msg)}</p>
    </div>`;

  function progressBar(done, total, okWhenFull) {
    if (total == null || total <= 0) return '';
    const pct = Math.min(100, Math.round((done / total) * 100));
    const full = okWhenFull && pct >= 100;
    return `<div class="progress ${full ? 'ok' : ''}"><span style="width:${pct}%"></span></div>`;
  }

  /* sk's badge vocabulary: confirmed / pending / cancelled / maroon. */
  const statusBadge = (status) => {
    const map = {
      pending:        ['badge-pending', 'Pending'],
      partially_paid: ['badge-maroon', 'Part paid'],
      paid:           ['badge-confirmed', 'Paid'],
      cancelled:      ['badge-cancelled', 'Cancelled'],
      requested:      ['badge-pending', 'Requested'],
      confirmed:      ['badge-maroon', 'Confirmed'],
      completed:      ['badge-confirmed', 'Completed'],
      open:           ['badge-confirmed', 'Open'],
      closed:         ['badge-cancelled', 'Closed'],
    };
    const [cls, label] = map[status] || ['badge-maroon', status || '—'];
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  };

  /* ---------- toasts ---------- */
  function toast(message, kind) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.setAttribute('role', 'status');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }, kind === 'err' ? 4200 : 2600);
  }

  /* ---------- sheet (bottom sheet on phone, dialog on desktop) ---------- */
  const sheetEl = () => document.getElementById('sheet');
  let lastFocused = null;

  function openSheet({ title, body, footer, onMount }) {
    const sheet = sheetEl();
    lastFocused = document.activeElement;

    document.getElementById('sheetTitle').textContent =
      (global.Lang ? Lang.t(title || '') : title) || '';
    document.getElementById('sheetBody').innerHTML = body || '';
    document.getElementById('sheetFoot').innerHTML = footer || '';

    sheet.classList.add('active');          // sk shows the overlay with .active
    document.body.style.overflow = 'hidden';

    if (typeof onMount === 'function') onMount(sheet);
    if (global.Lang) Lang.translateTree(sheet);
    bindTranslate(sheet);

    const focusable = sheet.querySelector(
      'input:not([type=hidden]), select, textarea, button:not(.icon-btn)'
    );
    if (focusable) setTimeout(() => focusable.focus(), 60);
  }

  function closeSheet() {
    const sheet = sheetEl();
    if (!sheet || !sheet.classList.contains('active')) return;
    sheet.classList.remove('active');
    document.getElementById('sheetBody').innerHTML = '';
    document.getElementById('sheetFoot').innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  function confirmSheet({ title, message, confirmLabel, danger, onConfirm }) {
    openSheet({
      title: title || 'Please confirm',
      body: `<p class="muted">${esc(message || '')}</p>`,
      footer: `
        <button class="btn btn-outline" data-sheet-close>Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : ''}" data-confirm-yes>${esc(confirmLabel || 'Confirm')}</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-confirm-yes]').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          try { await onConfirm(); closeSheet(); }
          catch (err) { toast(err.message, 'err'); btn.disabled = false; }
        });
      },
    });
  }

  /* Trap focus + ESC to close. Bound once. */
  document.addEventListener('keydown', (e) => {
    const sheet = sheetEl();
    if (!sheet || !sheet.classList.contains('active')) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.key !== 'Tab') return;
    const items = sheet.querySelectorAll(
      'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- misc helpers ---------- */
  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms || 280);
    };
  }

  /** Read a form into a plain object (trimmed strings, numbers coerced). */
  function readForm(root) {
    const out = {};
    root.querySelectorAll('[name]').forEach((el) => {
      if (el.type === 'checkbox') { out[el.name] = el.checked; return; }
      if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; return; }
      let v = el.value;
      if (typeof v === 'string') v = v.trim();
      if (el.type === 'number' && v !== '') v = Number(v);
      out[el.name] = v === '' ? null : v;
    });
    return out;
  }

  function showFieldError(root, name, message) {
    const el = root.querySelector(`[name="${name}"]`);
    if (!el) return;
    el.setAttribute('aria-invalid', 'true');
    let hint = el.parentElement.querySelector('.form-error');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'form-error';
      el.parentElement.appendChild(hint);
    }
    hint.textContent = message;
    el.focus();
  }

  function clearFieldErrors(root) {
    root.querySelectorAll('.form-error').forEach((e) => e.remove());
    root.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  }

  /** <select> of lookup values with an inline "+ New" button. */
  async function lookupSelect(type, name, selectedId, label) {
    const items = await API.lookups(type);
    const opts = items.map((i) =>
      `<option value="${attr(i.id)}"${String(i.id) === String(selectedId) ? ' selected' : ''}>${esc(i.value)}</option>`
    ).join('');
    return `
      <div class="form-group" data-lookup-field="${attr(type)}">
        <label class="form-label" for="f_${attr(name)}">${esc(label)}</label>
        <div class="input-with-btn">
          <select class="form-select" id="f_${attr(name)}" name="${attr(name)}">
            <option value="">— Select —</option>${opts}
          </select>
          <button type="button" class="btn btn-outline" data-add-lookup="${attr(type)}"
                  title="Add new" aria-label="Add new ${attr(label)}">${icon('plus', 'ico-sm')}</button>
        </div>
      </div>`;
  }

  /** Wire every [data-add-lookup] button inside a container. */
  function bindLookupAdders(root) {
    root.querySelectorAll('[data-add-lookup]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-add-lookup');
        const select = btn.parentElement.querySelector('select');
        const label = prompt('Add new ' + type.replace(/_/g, ' ') + ':');
        if (!label || !label.trim()) return;
        API.addLookup(type, label.trim())
          .then((row) => {
            const opt = document.createElement('option');
            opt.value = row.id;
            opt.textContent = row.value;
            select.appendChild(opt);
            select.value = row.id;
            toast('Added "' + row.value + '"', 'ok');
          })
          .catch((e) => toast(e.message, 'err'));
      });
    });
  }

  /* ============================================================
     DEVOTEE PICKER — search the register or add someone new,
     without losing whatever else is already filled in the form.
     Used by "who is being visited" and by "escort".
     ============================================================ */

  /** Single-select: search-as-you-type, or add a new devotee inline.
      Renders a hidden `${name}_id` that readForm() picks up. */
  function devoteeField(name, label, initial) {
    const sel = initial || null;
    return `
      <div class="form-group" data-devotee-field="${attr(name)}">
        <label class="form-label" for="f_${attr(name)}_q">${esc(label)}</label>
        <input type="hidden" name="${attr(name)}_id" value="${attr(sel ? sel.id : '')}">
        <input class="form-input" id="f_${attr(name)}_q" data-dv-search
               placeholder="Search name or mobile…"
               value="${attr(sel ? sel.full_name : (initial && initial.full_name) || '')}" autocomplete="off">
        <div class="dv-results" hidden></div>
        <div class="dv-selected small muted" ${sel ? '' : 'hidden'}>
          Selected: <strong data-dv-selected-name>${esc(sel ? sel.full_name : '')}</strong>
          <button type="button" class="btn btn-outline mg-btn-xs" data-dv-clear style="margin-left:.5rem">Change</button>
        </div>
        <button type="button" class="btn-add-devotee" data-dv-add>+ Add new devotee</button>
        <div class="dv-inline-form" hidden></div>
      </div>`;
  }

  /** Multi-select (escort): a checklist of chosen devotees, search to add,
      "+ Add new" to register someone not yet in the picker's results. */
  function devoteeMultiField(name, label, initial) {
    const chosen = initial || [];
    return `
      <div class="form-group" data-devotee-multi="${attr(name)}">
        <label class="form-label">${esc(label)}</label>
        <div class="dv-chips">${chosen.map((d) => chipHTML(name, d)).join('')}</div>
        <input class="form-input" data-dv-search placeholder="Search name or mobile to add…" autocomplete="off">
        <div class="dv-results" hidden></div>
        <button type="button" class="btn-add-devotee" data-dv-add>+ Add new devotee</button>
        <div class="dv-inline-form" hidden></div>
      </div>`;
  }
  function chipHTML(name, d) {
    return `<span class="dv-chip" data-id="${attr(d.id)}">
      <input type="hidden" name="${attr(name)}[]" value="${attr(d.id)}">
      ${esc(d.full_name)}<button type="button" class="dv-chip-x" data-dv-remove aria-label="Remove">&times;</button>
    </span>`;
  }

  const DV_ADD_FIELDS = () => `
    <input class="form-input" data-dv-new-name placeholder="Full name" style="margin-bottom:.4rem">
    <input class="form-input" data-dv-new-mobile placeholder="Mobile no." inputmode="tel" style="margin-bottom:.4rem">
    <div class="btn-row">
      <button type="button" class="btn btn-outline mg-btn-xs" data-dv-cancel-new>Cancel</button>
      <button type="button" class="btn btn-primary mg-btn-xs" data-dv-save-new>Save &amp; select</button>
    </div>`;

  /** Wire every devotee field/multi-field inside `root`. Call once after
      the form is in the DOM (openSheet's onMount is the usual place). */
  function bindDevotees(root) {
    root.querySelectorAll('[data-devotee-field]').forEach((wrap) => bindSingle(wrap));
    root.querySelectorAll('[data-devotee-multi]').forEach((wrap) => bindMulti(wrap));

    function paintResults(box, rows, onPick) {
      if (!rows.length) { box.innerHTML = `<div class="dv-empty small muted">No match — add them below.</div>`; box.hidden = false; return; }
      box.innerHTML = rows.map((d) => `
        <button type="button" class="dv-result" data-id="${attr(d.id)}">
          <strong>${esc(d.full_name)}</strong>
          <span class="small muted">${[d.mobile, d.city].filter(Boolean).map(esc).join(' · ')}</span>
        </button>`).join('');
      box.hidden = false;
      box.querySelectorAll('[data-id]').forEach((b) => {
        const d = rows.find((x) => String(x.id) === b.getAttribute('data-id'));
        b.addEventListener('click', () => onPick(d));
      });
    }

    function showAddForm(wrap, box, onSaved) {
      box.innerHTML = DV_ADD_FIELDS();
      box.hidden = false;
      box.querySelector('[data-dv-cancel-new]').addEventListener('click', () => { box.hidden = true; box.innerHTML = ''; });
      box.querySelector('[data-dv-save-new]').addEventListener('click', async (e) => {
        const fname = box.querySelector('[data-dv-new-name]').value.trim();
        const mobile = box.querySelector('[data-dv-new-mobile]').value.trim();
        if (!fname) { toast('Enter a name', 'err'); return; }
        e.currentTarget.disabled = true;
        try {
          const d = await API.post('/devotees', { full_name: fname, mobile });
          box.hidden = true; box.innerHTML = '';
          onSaved(d);
          toast('Devotee added', 'ok');
        } catch (err) {
          e.currentTarget.disabled = false;
          toast(err.message, 'err');
        }
      });
    }

    function bindSingle(wrap) {
      const name = wrap.getAttribute('data-devotee-field');
      const idField = wrap.querySelector(`input[name="${name}_id"]`);
      const search = wrap.querySelector('[data-dv-search]');
      const results = wrap.querySelector('.dv-results');
      const selectedBox = wrap.querySelector('.dv-selected');
      const selectedName = wrap.querySelector('[data-dv-selected-name]');
      const addForm = wrap.querySelector('.dv-inline-form');

      function select(d) {
        idField.value = d.id;
        search.value = d.full_name;
        selectedName.textContent = d.full_name;
        selectedBox.hidden = false;
        results.hidden = true;
      }
      wrap.querySelector('[data-dv-clear]')?.addEventListener('click', () => {
        idField.value = ''; search.value = ''; selectedBox.hidden = true; search.focus();
      });
      search.addEventListener('input', debounce(async () => {
        idField.value = '';
        const q = search.value.trim();
        if (q.length < 2) { results.hidden = true; return; }
        try { paintResults(results, await API.devotees({ search: q }), select); }
        catch (e) { /* silent — search is non-critical */ }
      }, 260));
      wrap.querySelector('[data-dv-add]').addEventListener('click', () => {
        showAddForm(wrap, addForm, (d) => { select(d); });
      });
    }

    function bindMulti(wrap) {
      const name = wrap.getAttribute('data-devotee-multi');
      const chips = wrap.querySelector('.dv-chips');
      const search = wrap.querySelector('[data-dv-search]');
      const results = wrap.querySelector('.dv-results');
      const addForm = wrap.querySelector('.dv-inline-form');

      function has(id) { return !!chips.querySelector(`[data-id="${id}"]`); }
      function add(d) {
        if (has(d.id)) { toast(d.full_name + ' is already added', 'err'); return; }
        chips.insertAdjacentHTML('beforeend', chipHTML(name, d));
        bindRemove(chips.lastElementChild);
        search.value = ''; results.hidden = true;
      }
      function bindRemove(chip) {
        chip.querySelector('[data-dv-remove]').addEventListener('click', () => chip.remove());
      }
      chips.querySelectorAll('.dv-chip').forEach(bindRemove);

      search.addEventListener('input', debounce(async () => {
        const q = search.value.trim();
        if (q.length < 2) { results.hidden = true; return; }
        try { paintResults(results, await API.devotees({ search: q }), add); }
        catch (e) { /* silent */ }
      }, 260));
      wrap.querySelector('[data-dv-add]').addEventListener('click', () => {
        showAddForm(wrap, addForm, (d) => add(d));
      });
    }
  }

  /** Read the ids out of a devotee-multi field by name (readForm() only
      sees the last hidden input of a repeated name, so this reads them all). */
  function multiIds(root, name) {
    return [...root.querySelectorAll(`input[name="${name}[]"]`)].map((el) => el.value);
  }

  /* Attach an EN <-> ગુ button to a free-text input. Names and numbers
     never get this — only fields where a sentence is typed. */
  function bindTranslate(root) {
    root.querySelectorAll('[data-translate]').forEach((field) => {
      if (field.dataset.trBound) return;
      field.dataset.trBound = '1';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tr-btn';
      btn.title = 'Translate English ⇄ ગુજરાતી';
      btn.innerHTML = 'અ⇄A';
      field.parentElement.appendChild(btn);

      btn.addEventListener('click', async () => {
        const text = field.value.trim();
        if (!text) return;
        const original = field.value;
        btn.disabled = true;
        btn.classList.add('is-busy');
        try {
          const r = await API.post('/translate', { text });
          field.value = r.text;
          field.dataset.trOriginal = original;
          toast('Translated — tap again to restore', 'ok');
        } catch (e) {
          if (e.status === 503) {
            toast('Translator is warming up, try again shortly', 'err');
            API.post('/translate/warmup', {}).catch(() => {});
          } else toast(e.message, 'err');
        }
        btn.disabled = false;
        btn.classList.remove('is-busy');
      });
    });
  }

  global.UI = {
    esc, attr, money, num, fmtDate, fmtDateLong, fmtRange, TBD,
    todayISO, monthISO, MONTHS, bindTranslate,
    icon, loading, empty, errorState, progressBar, statusBadge,
    toast, openSheet, closeSheet, confirmSheet,
    debounce, readForm, showFieldError, clearFieldErrors,
    devoteeField, devoteeMultiField, bindDevotees, multiIds,
    lookupSelect, bindLookupAdders,
  };
})(window);
