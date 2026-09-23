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

  /* Mobile is required wherever a devotee is REGISTERED (the register
     form, Add Sevarthi) — it is how the trust reaches them and how
     duplicates are caught. Deliberately loose: ten digits or more, so a
     +91 prefix or a landline passes. Mirrors assertMobile() in
     server/routes/devotees.js, which is the real check — this one only
     fails faster, without a round trip. */
  function mobileError(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return 'Mobile number is required';
    if (digits.length < 10) return 'Enter the full mobile number (at least 10 digits)';
    return null;
  }

  /* The one place the money on a booking is worked out. Every screen
     reads these fields instead of doing its own arithmetic, so the
     dashboard, the ledger, the payment list and the devotee profile can
     never disagree. Outstanding and excess are per booking and never
     cancel each other out. */
  function coverage(row) {
    const committed = Number(row.amount_committed || 0);
    const bappa = Number(row.bappa_paid || 0);
    const paid = Number(row.amount_paid || 0);
    const devotee = row.devotee_paid === undefined ? Math.max(0, paid - bappa) : Number(row.devotee_paid || 0);
    return {
      committed,
      devotee_paid: devotee,
      bappa_paid: bappa,
      covered: paid,
      outstanding: Math.max(0, committed - paid),
      excess: Math.max(0, paid - committed),
      bappa_supported: bappa > 0,
      /* What Bapa agreed to cover but has not been recorded against yet —
         the planned figure on the booking, not money in hand. */
      bappa_planned: Number(row.bhuvaji_planned_amount || 0),
    };
  }

  /* Status badge plus the two indicators the trust asked to see
     alongside it — deliberately NOT statuses of their own, so the
     booking state machine in db.js stays as it is. */
  function coverageBadges(row) {
    if (row.status === 'cancelled') return statusBadge('cancelled');
    const c = coverage(row);
    /* A gift is Bapa giving the whole seva, which is a bigger thing
       than Bapa helping with part of one — so it replaces the "Bappa
       Supported" mark rather than sitting next to it and saying the
       same thing twice. Putting it here means every screen that shows
       a booking gets it at once: the payments table, the devotee's
       profile, the ledger and the global search. */
    return statusBadge(row.status) +
      (row.is_gift
        ? ` <span class="badge badge-gift">${icon('diya', 'ico-sm')}Gift from Bapa</span>`
        : c.bappa_supported ? ' <span class="badge badge-maroon">Bappa Supported</span>' : '') +
      (c.excess > 0 ? ` <span class="badge badge-pending">Excess ${esc(money(c.excess))}</span>` : '');
  }

  /* "12 minutes ago" reads as activity; a raw 2026-09-21 21:38:02
     reads as a log file. SQLite stamps local time with no zone, so the
     space is swapped for a T to parse it as local rather than UTC.
     Anything older than a week falls back to the date itself, which is
     what someone actually wants at that distance. */
  function ago(stamp) {
    if (!stamp) return '';
    const then = new Date(String(stamp).replace(' ', 'T'));
    if (isNaN(then)) return String(stamp);
    const secs = Math.floor((Date.now() - then.getTime()) / 1000);
    if (secs < 45) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
    const days = Math.round(hrs / 24);
    if (days <= 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return fmtDate(then.toLocaleDateString('en-CA'));
  }

  /* `ago` is for timestamps that have happened. A padhramni is a date
     in the diary, so it needs the forward half too: how soon, in whole
     calendar days, ignoring the clock. Returns a label and a tone the
     caller can colour by. */
  function whenDay(iso) {
    if (!iso) return { days: null, label: TBD, tone: 'none' };
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return { days: null, label: esc(iso), tone: 'none' };
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(y, m - 1, d) - t) / 86400000);
    if (days === 0) return { days, label: 'Today', tone: 'now' };
    if (days === 1) return { days, label: 'Tomorrow', tone: 'soon' };
    if (days === -1) return { days, label: 'Yesterday', tone: 'past' };
    if (days > 0) return { days, label: `In ${days} days`, tone: days <= 7 ? 'soon' : 'later' };
    return { days, label: `${-days} days ago`, tone: 'past' };
  }

  /* ---------- who may do what ----------
     The mirror of server/middleware/roles.js, and only a mirror: the
     server is what actually refuses. This exists so an operator is not
     offered a button that will bounce — meeting a refusal at a counter
     with somebody waiting is worse than never seeing the control.

     Ranked, not a set, so a check reads as "at least an accountant"
     and a new tier slots in without revisiting every call site. */
  const ROLE_RANK = { operator: 0, accountant: 1, admin: 2, superadmin: 3 };

  /** The signed-in operator is at least `min`. */
  function can(min) {
    const me = (global.API && API.currentUser && API.currentUser()) || {};
    return (ROLE_RANK[me.role] || 0) >= (ROLE_RANK[min] || 0);
  }

  /* ---------- expandable rows ----------
     A list row answers the one question its page exists for; anything
     an operator only needs *after* choosing that row lives in a panel
     underneath it. Keeps a long list scannable without throwing the
     detail away. */
  let expandSeq = 0;

  /** summary + detail -> one row with a disclosure toggle. */
  function expandableRow(summary, detail, opts) {
    const o = opts || {};
    const id = 'more-' + (++expandSeq);
    return `<div class="list-row ${o.rowClass || ''}">
      <div class="row-item ${o.itemClass || ''}" data-expand="${id}">
        ${summary}
        <button type="button" class="icon-btn row-expand" data-expand="${id}" aria-expanded="false"
                aria-controls="${id}" title="${attr(o.label || 'More detail')}">
          ${icon('chevron-right', 'ico-sm')}
        </button>
      </div>
      <div class="row-more" id="${id}" hidden>${detail}</div>
    </div>`;
  }

  /* The whole summary strip toggles, not just the chevron — a 24px
     target in a list this long is a miss waiting to happen. The row's
     own buttons (Collect, Profile) still do their own job, so a click
     that started on one is left alone. */
  function bindExpanders(root) {
    if (!root) return;
    root.querySelectorAll('.row-item[data-expand], .dt-row[data-expand]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button:not(.row-expand), a, input, select')) return;
        const id = row.getAttribute('data-expand');
        const panel = root.querySelector('#' + CSS.escape(id));
        const btn = row.querySelector('.row-expand');
        if (!panel) return;
        const open = panel.hidden;
        panel.hidden = !open;
        if (btn) btn.setAttribute('aria-expanded', String(open));
        /* A card row lives inside a .list-row wrapper; a table row IS
           the row and has no wrapper, so `closest` returns null and
           this threw on every click — the panel still opened, which is
           what hid it. Mark whichever element is actually the row. */
        (row.closest('.list-row') || row).classList.toggle('is-open', open);
      });
    });
  }

  /* ---------- pagination ----------
     Shared by every long list (devotees, the sevarthi ledger, the
     collections list, the audit trail) so they page identically.

     The control uses `data-pager`, NOT `data-page`: app.js has a
     document-wide click handler that treats any `data-page` element as
     a nav link, so a pager built with it navigates away mid-click. */
  const PAGE_SIZE = 25;

  function paginate(items, page, size) {
    const per = size || PAGE_SIZE;
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const p = Math.min(Math.max(1, Number(page) || 1), pages);   // clamp: a filter change can leave it past the end
    const start = (p - 1) * per;
    return {
      slice: items.slice(start, start + per),
      page: p, pages, total,
      from: total ? start + 1 : 0,
      to: Math.min(start + per, total),
    };
  }

  /** Renders nothing when everything fits on one page. */
  function pager(pg, noun) {
    if (!pg || pg.pages <= 1) return '';
    return `<div class="pager">
      <button class="btn btn-outline mg-btn-xs" data-pager="prev" ${pg.page === 1 ? 'disabled' : ''}>
        ${icon('chevron-left', 'ico-sm')} Previous</button>
      <span class="pager-count">${esc(num(pg.from))}–${esc(num(pg.to))} of ${esc(num(pg.total))}${
        noun ? ' ' + esc(noun) : ''}</span>
      <button class="btn btn-outline mg-btn-xs" data-pager="next" ${pg.page === pg.pages ? 'disabled' : ''}>
        Next ${icon('chevron-right', 'ico-sm')}</button>
    </div>`;
  }

  /** `go(delta)` receives -1 or +1. */
  function bindPager(root, go) {
    if (!root) return;
    root.querySelectorAll('[data-pager]').forEach((el) =>
      el.addEventListener('click', () => go(el.getAttribute('data-pager') === 'next' ? 1 : -1)));
  }

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
      paid:           ['badge-confirmed', 'Covered'],
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

  /* Esc and light dismiss close the dialog without going through
     closeSheet(), so the cleanup hangs off the dialog's own event.
     #sheet is markup above these script tags, but fall back to
     DOMContentLoaded in case the load order ever changes. */
  function bindSheetClose() {
    const sheet = sheetEl();
    if (sheet) sheet.addEventListener('close', teardownSheet);
    else document.addEventListener('DOMContentLoaded', bindSheetClose, { once: true });
  }
  bindSheetClose();

  /* One dialog serves the whole app. Opening while one is already open
     REPLACES its contents rather than stacking — calling showModal() on
     an open dialog would throw, and nested sheets were never the design
     (see the note on bindLookupAdders). */
  function openSheet({ title, body, footer, onMount }) {
    const sheet = sheetEl();
    if (!sheet.open) lastFocused = document.activeElement;

    document.getElementById('sheetTitle').textContent =
      (global.Lang ? Lang.t(title || '') : title) || '';
    document.getElementById('sheetBody').innerHTML = body || '';
    document.getElementById('sheetFoot').innerHTML = footer || '';

    if (!sheet.open) {
      /* showModal() is what gives the focus trap and Esc. If it is
         unavailable or refuses, fall back to the plain overlay the app
         used before rather than leaving the operator with no sheet. */
      try {
        if (typeof sheet.showModal === 'function') sheet.showModal();
        else sheet.setAttribute('open', '');
      } catch (e) {
        sheet.setAttribute('open', '');
      }
      sheet.classList.add('active');             // styles.css shows it with .active
      document.body.style.overflow = 'hidden';
    }
    sheet.scrollTop = 0;
    const box = sheet.querySelector('.modal-box');
    if (box) box.scrollTop = 0;

    if (typeof onMount === 'function') onMount(sheet);
    if (global.Lang) Lang.translateTree(sheet);
    bindTranslate(sheet);

    /* Focus the first real field, not the ✕ in the header — the header
       comes first in the DOM, so an unscoped query lands the operator
       on the close button and they have to tab into the form before
       they can type a name. */
    const bodyEl = document.getElementById('sheetBody');
    const focusable = (bodyEl && bodyEl.querySelector(
      'input:not([type=hidden]):not([disabled]), select, textarea'
    )) || sheet.querySelector('.modal-footer .btn');
    if (focusable) setTimeout(() => focusable.focus(), 60);
  }

  function closeSheet() {
    const sheet = sheetEl();
    if (!sheet || !sheet.open) return;
    sheet.close();            // 'close' fires, and teardown() below cleans up
  }

  /* Teardown lives on the dialog's own close event so that Esc, light
     dismiss and closeSheet() all leave exactly the same state behind —
     there is no path that skips the cleanup. */
  function teardownSheet() {
    const sheet = sheetEl();
    if (!sheet) return;
    sheet.classList.remove('active');
    sheet.removeAttribute('open');
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
    <input class="form-input" data-dv-new-mobile placeholder="Mobile no. (required)" inputmode="tel" style="margin-bottom:.4rem">
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
        const mobileMsg = mobileError(mobile);
        if (mobileMsg) { toast(mobileMsg, 'err'); return; }
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

  /* ============================================================
     THE WORKBENCH TABLE
     ------------------------------------------------------------
     Payments and the Devotee register are the two pages an operator
     lives in, and both read as a wall. The reason turned out to be
     structural rather than decorative: their collapsed row carried a
     name and a mobile on the left and one figure on the right, with
     roughly 800px of nothing between — so a screen of rows gave no
     column to run your eye down and no way to compare two people.
     Padhramni felt fine by contrast because its row carries five
     things in fixed positions across the line, which is a table in
     everything but name.

     So these two get a real one: named columns, figures aligned in
     their own right-hand columns and sortable by clicking the
     heading. The disclosure the trust likes is kept exactly — the row
     still opens a panel underneath, it is just a second <tr> now.

     Under 860px a table is the wrong shape, so the same markup stacks:
     thead is hidden and every cell prints its own heading from
     `data-k`. One code path, so the phone can never drift from the
     desktop.
     ============================================================ */

  /** Builds the table. `columns` is
        { key, label, cell(row), type?: 'money'|'num', sortable?, hideOn?: 'sm' }
      `type` right-aligns and sets tabular figures; `sortable` makes the
      heading a button emitting `data-dtsort`. `actions(row)` fills the
      last cell, which always also carries the disclosure chevron. */
  function dataTable(o) {
    const cols = (o.columns || []).filter(Boolean);
    const rows = o.rows || [];
    const sortKey = o.sort && o.sort.key;
    const sortDir = (o.sort && o.sort.dir) || 'desc';
    const head = cols.map((c) => {
      const cls = [c.type === 'money' || c.type === 'num' ? 'n' : '',
                   c.hideOn === 'sm' ? 'dt-sm-hide' : ''].filter(Boolean).join(' ');
      if (!c.sortable) return `<th class="${cls}">${esc(c.label)}</th>`;
      const on = c.key === sortKey;
      return `<th class="${cls} dt-sortable" ${on ? `aria-sort="${sortDir === 'asc' ? 'ascending' : 'descending'}"` : ''}>
        <button type="button" class="dt-sort ${on ? 'is-on' : ''}" data-dtsort="${attr(c.key)}">
          <span>${esc(c.label)}</span>
          ${icon(on && sortDir === 'asc' ? 'chevron-left' : 'chevron-right', 'ico-sm dt-caret')}
        </button></th>`;
    }).join('');

    const body = rows.map((r) => {
      const id = 'more-' + (++expandSeq);
      const cells = cols.map((c) => {
        const cls = [c.type === 'money' || c.type === 'num' ? 'n' : '',
                     c.hideOn === 'sm' ? 'dt-sm-hide' : '', c.cellClass || ''].filter(Boolean).join(' ');
        /* data-k is what the phone prints as the cell's own heading,
           so a stacked row never becomes a column of bare values. */
        return `<td class="${cls}" data-k="${attr(c.label)}">${c.cell(r)}</td>`;
      }).join('');
      /* Both names on purpose. `dt-row`/`dt-more` are the table's own,
         and `row-item`/`row-more` are what the rest of the app calls a
         summary strip and its disclosure panel — bindExpanders, the
         [hidden] rule and every check that asks "is this row's panel
         open" then work on a table row exactly as they do on a card. */
      return `<tr class="dt-row row-item" data-expand="${id}">
          ${cells}
          <td class="dt-act">
            <div class="dt-act-in">
              ${o.actions ? o.actions(r) : ''}
              <button type="button" class="icon-btn row-expand" data-expand="${id}" aria-expanded="false"
                      aria-controls="${id}" title="${attr(o.label || 'More detail')}">
                ${icon('chevron-right', 'ico-sm')}</button>
            </div>
          </td>
        </tr>
        <tr class="dt-more row-more" id="${id}" hidden>
          <td colspan="${cols.length + 1}">${o.detail ? o.detail(r) : ''}</td>
        </tr>`;
    }).join('');

    return `<div class="dt-wrap"><table class="custom-table dt">
      <thead><tr>${head}<th class="dt-act"><span class="visually-hidden">Actions</span></th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
  }

  /** `go(key)` receives the column key that was clicked; the page owns
      what that means, including flipping direction on a repeat click. */
  function bindDataTable(root, go) {
    if (!root || typeof go !== 'function') return;
    root.querySelectorAll('[data-dtsort]').forEach((b) =>
      b.addEventListener('click', () => go(b.getAttribute('data-dtsort'))));
  }

  /* ============================================================
     DATA-ENTRY KIT
     ------------------------------------------------------------
     Three pieces every entry sheet in the app now shares, so that a
     form the operator has learned once behaves the same everywhere.
     ============================================================ */

  /** A numbered stepper for a multi-step sheet.
      `labels` is the full list, `current` the 0-based step in force.
      A finished step is a real <button>: going back to correct a name
      must never mean starting the flow again, and the only honest
      affordance for that is something focusable and clickable. */
  function steps(labels, current) {
    const html = labels.map((label, i) => {
      const state = i === current ? 'is-now' : i < current ? 'is-done' : '';
      const tag = i < current ? 'button' : 'span';
      return `${i ? `<span class="step-sep" aria-hidden="true">${icon('chevron-right', 'ico-sm')}</span>` : ''}
        <${tag} class="step ${state}"${i < current ? ` type="button" data-step-go="${attr(i)}"` : ''}${
          i === current ? ' aria-current="step"' : ''}>
          <span class="step-n" aria-hidden="true">${esc(String(i + 1))}</span>
          <span class="step-t">${esc(label)}</span>
        </${tag}>`;
    }).join('');
    return `<nav class="steps" aria-label="Progress">${html}</nav>`;
  }

  /** Wires the clickable finished steps rendered by `steps()`. */
  function bindSteps(root, onGo) {
    if (!root || typeof onGo !== 'function') return;
    root.querySelectorAll('[data-step-go]').forEach((b) =>
      b.addEventListener('click', () => onGo(Number(b.getAttribute('data-step-go')))));
  }

  /** Optional fields, folded away behind one line.
      The fields stay in the DOM whether or not the block is open, so
      `readForm` still collects them and a prefilled value is never
      silently dropped — which is also why a block that already holds
      an answer opens itself. */
  function moreFields(label, inner, opts) {
    const o = opts || {};
    return `<details class="more-fields"${o.open ? ' open' : ''}>
      <summary>${icon('chevron-right', 'ico-sm')}<span>${esc(label)}</span>${
        o.count ? `<span class="more-count">${esc(o.count)}</span>` : ''}</summary>
      <div class="more-fields-body">${inner}</div>
    </details>`;
  }

  /** "This is who and what you are entering against."
      `rows` is [[label, value, cls?], …] — the money summary that made
      Record Payment the one sheet nobody got lost in. */
  function contextCard({ title, badge, sub, rows }) {
    return `<div class="entry-context">
      <div class="ec-title">${esc(title || '')}${badge || ''}</div>
      ${sub ? `<div class="ec-sub">${esc(sub)}</div>` : ''}
      ${(rows && rows.length) ? `<dl class="ec-rows">${rows.map(([k, v, cls]) =>
        `<div class="ec-row ${cls || ''}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    </div>`;
  }

  /** Replaces the sheet's footer between steps of one flow.
      Each step owns its own actions, and the primary one has to be in
      the footer where it is always visible — a "next" that lives in
      the scrolling body reads as no next at all. */
  function sheetFooter(html, binds) {
    const foot = document.getElementById('sheetFoot');
    if (!foot) return null;
    foot.innerHTML = html || '';
    foot.querySelectorAll('[data-sheet-close]').forEach((b) =>
      b.addEventListener('click', closeSheet));
    if (binds) Object.keys(binds).forEach((sel) => {
      const el = foot.querySelector(sel);
      if (el) el.addEventListener('click', binds[sel]);
    });
    if (global.Lang) Lang.translateTree(foot);
    return foot;
  }

  /** Enter moves to the next field rather than submitting a half-filled
      form — the counter is a conversation, and the operator types in
      the order the answers arrive. The last field submits. */
  function bindEnterFlow(form, onLast) {
    if (!form) return;
    form.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const el = e.target;
      if (!el.matches || !el.matches('input:not([type=checkbox]):not([type=radio])')) return;
      e.preventDefault();
      const fields = [...form.querySelectorAll('input, select, textarea')]
        .filter((f) => !f.disabled && f.type !== 'hidden' && f.offsetParent !== null);
      const next = fields[fields.indexOf(el) + 1];
      if (next) next.focus();
      else if (typeof onLast === 'function') onLast();
    });
  }

  global.UI = {
    esc, attr, money, num, fmtDate, fmtDateLong, fmtRange, TBD,
    todayISO, monthISO, MONTHS, bindTranslate,
    icon, loading, empty, errorState, progressBar, statusBadge,
    mobileError, coverage, coverageBadges, ago, whenDay,
    PAGE_SIZE, paginate, pager, bindPager,
    expandableRow, bindExpanders, dataTable, bindDataTable,
    can, ROLE_RANK,
    steps, bindSteps, moreFields, contextCard, sheetFooter, bindEnterFlow,
    toast, openSheet, closeSheet, confirmSheet,
    debounce, readForm, showFieldError, clearFieldErrors,
    devoteeField, devoteeMultiField, bindDevotees, multiIds,
    lookupSelect, bindLookupAdders,
  };
})(window);
