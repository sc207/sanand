/* Shared flows reachable from anywhere: Add Sevarthi, Add Payment,
   Add Samaj, Add Devotee Category, quick-add menu, global search. */
(function (global) {
  'use strict';

  const { esc, attr, money, icon, toast, openSheet, closeSheet, readForm,
          showFieldError, clearFieldErrors, lookupSelect, bindLookupAdders,
          fmtDate, todayISO, debounce, statusBadge } = UI;

  const CAT_FILTERS = [
    ['all', 'All'],
    ['maha_yagna', 'Maha Yagna'],
    ['mandir_pooja', 'Mandir ni Pooja'],
    ['bhagvat_katha', 'Bhagvat Saptah'],
  ];

  /** Rank open poojas by fit: date match first, then closest amount to
      budget. `keepPoojaId` keeps one pooja in the list even if it reads as
      full — used when re-suggesting for a sevarthi who already holds a seat
      in it, since their own seat is part of that fullness. Shared between
      Add Sevarthi's live suggestions and moving an existing booking. */
  function rankPoojas(allPoojas, { expDate, budget, catFilter, keepPoojaId } = {}) {
    let open = allPoojas.filter((p) => p.status !== 'closed' && (!p.is_full || p.id === keepPoojaId));
    if (catFilter && catFilter !== 'all') open = open.filter((p) => p.category === catFilter);

    return open.map((p) => {
      const dated = !!(p.start_date && p.end_date);
      const fits = expDate && dated ? (expDate >= p.start_date && expDate <= p.end_date) : null;
      const dateRank = fits === true ? 0 : fits === null ? 1 : 2;   // match, then undated/unknown, then mismatch
      const amtDiff = p.amount > 0 && budget > 0 ? Math.abs(p.amount - budget) : null;
      return { p, dateRank, amtDiff, overBudget: budget > 0 && p.amount > budget };
    }).sort((a, b) => {
      if (a.dateRank !== b.dateRank) return a.dateRank - b.dateRank;
      if (a.amtDiff === null && b.amtDiff === null) return 0;
      if (a.amtDiff === null) return 1;
      if (b.amtDiff === null) return -1;
      return a.amtDiff - b.amtDiff;
    });
  }

  /** Markup for one card in a ranked seva list — shared by Add Sevarthi's
      suggestions and the "move to a different seva" picker. */
  function sevaCard(p, dateRank, overBudget, extraBadge) {
    const seats = p.total_seats === null ? `${p.booked_seats} joined` : `${p.booked_seats}/${p.total_seats} seats`;
    return `
      <button type="button" class="card cat-card" data-pooja="${attr(p.id)}" style="margin:0">
        <div class="card-body">
          <div class="row-title">${esc(p.name)}
            ${extraBadge || ''}
            ${dateRank === 0 ? '<span class="badge badge-confirmed">Fits the date</span>' : ''}
            ${overBudget ? '<span class="badge badge-pending">Bapa can cover the gap</span>' : ''}</div>
          <div class="row-sub">${esc(p.category_label)} · ${esc(UI.fmtRange(p.start_date, p.end_date))} · ${esc(seats)}
            ${p.amount ? ' · ' + esc(money(p.amount)) : ''}</div>
        </div>
      </button>`;
  }

  /** When a committed amount is edited down below what's already been
      received, the difference is money the trust is holding that no
      longer matches a seva — make that explicit rather than silently
      losing track of it. The app doesn't model refunds; it just says so. */
  function overpaidHint(paid, total) {
    const excess = Number(paid || 0) - Number(total || 0);
    if (excess <= 0) return '';
    return `<div class="form-hint" style="color:var(--warning)">
      ${esc(money(paid))} already received is more than this ${esc(money(total))} commitment —
      the ${esc(money(excess))} difference stays on record as received, not tracked as a refund
      by this app. Settle it with the sevarthi directly.</div>`;
  }

  /** "Covered by Bapa" as an explicit toggle rather than a bare number
      field sitting at 0 — the amount input only appears (and only ever
      gets sent) once the operator turns it on. Off means 0, unambiguously,
      never a stray figure left in a field nobody meant to fill in. */
  function bhuvajiField(amount) {
    const enabled = Number(amount || 0) > 0;
    return `
      <div class="form-group">
        <label class="small" style="display:flex;align-items:center;gap:.45rem;font-weight:500">
          <input type="checkbox" name="bhuvaji_enabled" id="f_bhuvaji_enabled" ${enabled ? 'checked' : ''} style="width:auto;min-height:0">
          Bapa is covering part of the amount
        </label>
        <div id="bhuvajiAmountWrap" style="margin-top:.5rem${enabled ? '' : ';display:none'}">
          <label class="form-label" for="f_bhuvaji_planned_amount">Covered by Bapa</label>
          <input class="form-input" id="f_bhuvaji_planned_amount" name="bhuvaji_planned_amount" type="number" min="0" step="1"
                 value="${attr(enabled ? amount : 0)}" inputmode="numeric">
          <div class="form-hint">If the sevarthi cannot give the full amount, enter the share Bhuvaji Suresh Bapa will cover.</div>
          ${/* The other half of the arithmetic. Entering Bapa's share
                without seeing what that leaves the sevarthi made the
                operator work the subtraction out in their head. */''}
          <div class="form-hint" id="bhuvajiShareSplit" style="margin-top:.35rem"></div>
        </div>
      </div>`;
  }

  /** Wire the toggle: show/hide the amount field, and zero it out the
      moment it's switched off so a leftover figure can never sneak
      through unseen. Call once the form markup is in the DOM. */
  function bindBhuvajiToggle(form) {
    const split = form.querySelector('#bhuvajiShareSplit');

    /* Contribution = the sevarthi's share + Bapa's. Only one of the two
       is ever typed, so show the other rather than leaving the operator
       to subtract. */
    function paintShare() {
      if (!split) return;
      const total = Number((form.amount_committed || {}).value || 0);
      const bapa = Number(form.bhuvaji_planned_amount.value || 0);
      if (!form.bhuvaji_enabled.checked || !total) { split.innerHTML = ''; return; }
      split.innerHTML = bapa > total
        ? `<span style="color:var(--warning)">That is more than the ${esc(money(total))} contribution.</span>`
        : `Bapa covers <strong>${esc(money(bapa))}</strong>, the sevarthi gives
           <strong>${esc(money(total - bapa))}</strong>.`;
    }

    form.bhuvaji_enabled.addEventListener('change', (e) => {
      document.getElementById('bhuvajiAmountWrap').style.display = e.target.checked ? '' : 'none';
      if (e.target.checked) form.bhuvaji_planned_amount.focus();
      else form.bhuvaji_planned_amount.value = '0';
      paintShare();
    });
    form.bhuvaji_planned_amount.addEventListener('input', paintShare);
    if (form.amount_committed) form.amount_committed.addEventListener('input', paintShare);
    paintShare();
    return { paintShare };
  }

  /** The amount only counts when the toggle is on — reading the number
      field directly would let a stale value slip through while it's
      hidden and supposedly off. */
  const readBhuvajiAmount = (data) => (data.bhuvaji_enabled ? Number(data.bhuvaji_planned_amount || 0) : 0);

  /* ---------- picking someone already on the register ----------
     Most seva after the first are taken by people already registered,
     and retyping a name and number that the trust already holds is both
     slower and a chance to create a near-duplicate. This sits above the
     devotee fields and fills them in from a search; the fields stay
     editable afterwards, and `upsertDevotee` merges by mobile, so a
     correction made here updates the register rather than forking it. */
  function existingDevoteeSearch() {
    return `
      <div class="form-group" id="existingDevotee">
        <label class="form-label" for="f_existing">Already on the register?</label>
        <input class="form-input" id="f_existing" data-existing-search autocomplete="off"
               placeholder="Search name or mobile — or just fill the form below for someone new">
        <div class="dv-results" hidden></div>
        <div class="small muted" id="existingPicked" hidden></div>
      </div>`;
  }

  /** Fill `form`'s devotee fields from a picked register entry. */
  function bindExistingDevotee(form) {
    const wrap = form.querySelector('#existingDevotee');
    if (!wrap) return;
    const input = wrap.querySelector('[data-existing-search]');
    const box = wrap.querySelector('.dv-results');
    const picked = wrap.querySelector('#existingPicked');

    const search = debounce(async () => {
      const q = input.value.trim();
      if (q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
      let rows = [];
      try { rows = await API.devotees({ search: q }); } catch { return; }
      if (!rows.length) {
        box.innerHTML = `<div class="dv-empty small muted">No one matches — fill the form below to register them.</div>`;
        box.hidden = false; return;
      }
      box.innerHTML = rows.slice(0, 8).map((d) => `
        <button type="button" class="dv-result" data-id="${attr(d.id)}">
          <strong>${esc(d.full_name)}</strong>
          <span class="small muted">${[d.mobile, d.city, d.samaj].filter(Boolean).map(esc).join(' · ')}</span>
        </button>`).join('');
      box.hidden = false;
      box.querySelectorAll('[data-id]').forEach((b) =>
        b.addEventListener('click', () => {
          const d = rows.find((x) => String(x.id) === b.getAttribute('data-id'));
          fill(d);
        }));
    }, 280);

    function fill(d) {
      const set = (name, v) => { if (form[name] && v != null) form[name].value = v; };
      set('full_name', d.full_name);
      set('mobile', d.mobile || '');
      set('city', d.city || '');
      set('state', d.state || 'Gujarat');
      set('mul_vatan', d.mul_vatan || '');
      if (form.samaj_id) form.samaj_id.value = d.samaj_id || '';
      if (form.category_id) form.category_id.value = d.category_id || '';
      box.hidden = true; box.innerHTML = '';
      input.value = d.full_name;
      picked.hidden = false;
      picked.innerHTML = `Using <strong>${esc(d.full_name)}</strong> from the register` +
        `${d.booking_count ? ` · already on ${esc(UI.num(d.booking_count))} seva` : ''}` +
        ` — edit anything below and their record updates.`;
      // Any hint the mobile-blur check left is now stale.
      const dup = document.getElementById('dupHint');
      if (dup) dup.textContent = '';
    }

    input.addEventListener('input', () => { picked.hidden = true; search(); });
  }

  /* ---------- splitting an amount between the sevarthi and Bapa ----------
     Whenever money is split, the operator knows one side and the total:
     "he's giving ten lakh, Bapa covers the rest". Typing the second
     figure is arithmetic the form can do.

     The field you type in drives; the *other* one fills itself with
     whatever is left of the due. As soon as you type into that second
     field it becomes yours and the balancing stops — otherwise clearing
     Bapa's share to zero would silently rewrite the sevarthi's, which is
     the usual way two-way binding turns hostile.

     Returns a `reset()` for forms that repaint the pair. */
  function bindSplitBalance(a, b, dueOf, onPaint) {
    let typed = {};
    function wire(self, other) {
      self.addEventListener('input', () => {
        typed[self.name] = true;
        if (!typed[other.name]) {
          const rest = Math.max(0, Number(dueOf() || 0) - Number(self.value || 0));
          other.value = rest || '';
          other.dataset.autofilled = '1';
        }
        delete self.dataset.autofilled;
        if (onPaint) onPaint();
      });
    }
    wire(a, b); wire(b, a);
    return { reset() { typed = {}; } };
  }

  /** Says which side the form filled in, so the hint can own up to it
      rather than leaving a number the operator did not type unexplained.
      `labels` describes the fields in order: [what `a` is, what `b` is]. */
  function autoFilledNote(a, b, labels) {
    const which = a.dataset.autofilled ? labels[0] : b.dataset.autofilled ? labels[1] : null;
    return which
      ? ` <span class="muted">· ${esc(which)} filled in to cover the rest — change it if that's not right</span>`
      : '';
  }

  /* ---------- "paid now" ----------
     A sevarthi who hands the money over while they are registering
     should not have to be found again afterwards to record it. This is
     the same Devotee / Bapa / Both choice as the payment sheet, folded
     into whichever form is already open, and it stays off until the
     operator turns it on so a blank form never records ₹0.

     `name`s are prefixed so this can sit in a form that already has an
     `amount` field of its own (Add Sevarthi's Total Contribution). */
  function paidNowField(opts) {
    const o = opts || {};
    return `
      <div class="divider"></div>
      <div class="form-group">
        <label class="small" style="display:flex;align-items:center;gap:.45rem;font-weight:500">
          <input type="checkbox" name="paid_now" id="f_paid_now" style="width:auto;min-height:0">
          ${esc(o.label || 'Money received now')}
        </label>
        <div id="paidNowWrap" hidden style="margin-top:.6rem">
          <div class="btn-row" style="margin-bottom:.7rem">
            <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
              <input type="radio" name="paid_payer" value="devotee" checked style="width:auto;min-height:0;margin-right:.35rem"> Devotee</label>
            <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
              <input type="radio" name="paid_payer" value="bhuvaji" style="width:auto;min-height:0;margin-right:.35rem"> Bapa</label>
            <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
              <input type="radio" name="paid_payer" value="both" style="width:auto;min-height:0;margin-right:.35rem"> Both</label>
          </div>
          <div id="paidNowSingle" class="form-group">
            <label class="form-label" for="f_paid_amount">Amount received</label>
            <input class="form-input" id="f_paid_amount" name="paid_amount" type="number" min="0" step="1" inputmode="numeric">
          </div>
          <div id="paidNowSplit" hidden>
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_paid_devotee">From devotee</label>
                <input class="form-input" id="f_paid_devotee" name="paid_devotee" type="number" min="0" step="1" inputmode="numeric"></div>
              <div class="form-group"><label class="form-label" for="f_paid_bapa">From Bapa</label>
                <input class="form-input" id="f_paid_bapa" name="paid_bapa" type="number" min="0" step="1" inputmode="numeric"></div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_paid_date">Date</label>
              <input class="form-input" id="f_paid_date" name="paid_date" type="date" value="${attr(todayISO())}"></div>
            <div class="form-group"><label class="form-label" for="f_paid_receipt">Receipt No.</label>
              <input class="form-input" id="f_paid_receipt" name="paid_receipt"></div>
          </div>
          <p class="small" id="paidNowHint" style="margin:0"></p>
        </div>
      </div>`;
  }

  /** Wire it up. `dueOf()` returns what is outstanding right now, so the
      hint can say whether what is being entered settles the seva — in
      Add Sevarthi that is the contribution field, which the operator is
      still typing into. */
  function bindPaidNow(form, dueOf) {
    const wrap = form.querySelector('#paidNowWrap');
    if (!wrap) return;
    const single = form.querySelector('#paidNowSingle');
    const split = form.querySelector('#paidNowSplit');
    const hint = form.querySelector('#paidNowHint');
    const payerOf = () => (form.querySelector('[name="paid_payer"]:checked') || {}).value || 'devotee';

    function paint() {
      const both = payerOf() === 'both';
      single.hidden = both;
      split.hidden = !both;
      const total = both
        ? Number(form.paid_devotee.value || 0) + Number(form.paid_bapa.value || 0)
        : Number(form.paid_amount.value || 0);
      const due = Number(dueOf() || 0);
      hint.innerHTML = !total
        ? '<span class="muted">Leave blank if nothing was handed over.</span>'
        : `Recording <strong>${esc(money(total))}</strong>` +
          (both ? ' as two entries' : '') +
          (total > due ? ` — <span style="color:var(--warning)">${esc(money(total - due))} above the contribution</span>`
           : total === due ? ' — <span style="color:var(--success)">settles this seva in full</span>'
           : ` — <span class="muted">${esc(money(due - total))} would still be due</span>`) +
          (both ? autoFilledNote(form.paid_devotee, form.paid_bapa, ["The devotee's share", "Bapa's share"]) : '');
    }

    form.paid_now.addEventListener('change', (e) => {
      wrap.hidden = !e.target.checked;
      if (e.target.checked) { paint(); form.paid_amount.focus(); }
    });
    form.querySelectorAll('[name="paid_payer"]').forEach((r) => r.addEventListener('change', paint));
    ['paid_amount', 'paid_devotee', 'paid_bapa'].forEach((n) =>
      form[n].addEventListener('input', paint));
    // Type one side, the other covers the rest of the contribution.
    bindSplitBalance(form.paid_devotee, form.paid_bapa, dueOf, paint);
  }

  /** Read the block into the `payment` body the API takes, or null when
      it is switched off. Returns `{ error, field }` for the caller to
      surface rather than throwing. */
  function readPaidNow(data) {
    if (!data.paid_now) return { payment: null };
    const common = { payment_date: data.paid_date || undefined, receipt_no: data.paid_receipt || undefined };
    if (data.paid_payer === 'both') {
      const d = Number(data.paid_devotee || 0);
      const p = Number(data.paid_bapa || 0);
      if (d < 0 || p < 0) return { error: 'An amount cannot be negative', field: 'paid_devotee' };
      if (!d && !p) return { error: 'Enter what was received, or untick the box', field: 'paid_devotee' };
      return { payment: { devotee_amount: d, bhuvaji_amount: p, ...common }, total: d + p };
    }
    const amount = Number(data.paid_amount || 0);
    if (amount < 0) return { error: 'An amount cannot be negative', field: 'paid_amount' };
    if (!amount) return { error: 'Enter what was received, or untick the box', field: 'paid_amount' };
    return { payment: { amount, payer_type: data.paid_payer === 'bhuvaji' ? 'bhuvaji' : 'devotee', ...common },
             total: amount };
  }

  /** The block's own fields never belong in the parent payload. */
  function stripPaidNow(data) {
    const { paid_now, paid_payer, paid_amount, paid_devotee, paid_bapa,
            paid_date, paid_receipt, ...rest } = data;
    return rest;
  }

  /* ============================================================
     ADD SEVARTHI — devotee + preference (one screen) → seva → day → contribution
     Always starts with who's asking and what they want, whether or not the
     operator already knows the seva — the matching list underneath updates
     live as the date/budget/category filter change, closest match first.
     ============================================================ */
  async function addSevarthi(preset) {
    const state = { category: null, poojaId: null, slotId: null, pooja: null, inquiry: null, ...(preset || {}) };
    const host = () => document.getElementById('sevStep');

    openSheet({
      title: 'Add Seva',
      body: `<div id="sevStep"></div>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Close</button>`,
      async onMount() {
        if (state.poojaId) { await stepDay(); return; }  // opened from a pooja page — skip straight in
        await stepSevarthi();
      },
    });

    /* --- devotee + preference, with the matching seva list live underneath --- */
    async function stepSevarthi() {
      host().innerHTML = UI.loading(4);
      const inq = state.inquiry || {};
      const [samajField, catField, allPoojas] = await Promise.all([
        lookupSelect('samaj', 'samaj_id', inq.samaj_id, 'Samaj'),
        lookupSelect('devotee_category', 'category_id', inq.category_id, 'Devotee Category'),
        API.poojas(),
      ]);
      let catFilter = state.catFilter || 'all';
      // Pin the date picker to the Mahotsav itself, not today's month, so the
      // operator isn't clicking "next" repeatedly to reach Feb 2027. Only on
      // first visit — an explicit clear (null) later is respected as-is.
      const mahotsavStart = allPoojas.map((p) => p.start_date).filter(Boolean).sort()[0] || '';
      const defaultExpectedDate = inq.expected_date !== undefined ? inq.expected_date : mahotsavStart;

      host().innerHTML = `
        <form id="sevForm" novalidate>
          ${existingDevoteeSearch()}
          <div class="form-group">
            <label class="form-label req" for="f_full_name">Full Name</label>
            <input class="form-input" id="f_full_name" name="full_name" autocomplete="name" value="${attr(inq.full_name || '')}">
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label req" for="f_mobile">Mobile No.</label>
              <input class="form-input" id="f_mobile" name="mobile" inputmode="tel" autocomplete="tel" value="${attr(inq.mobile || '')}"></div>
            <div class="form-group"><label class="form-label" for="f_city">City</label>
              <input class="form-input" id="f_city" name="city" value="${attr(inq.city || '')}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_state">State</label>
              <input class="form-input" id="f_state" name="state" value="${attr(inq.state || 'Gujarat')}"></div>
            <div class="form-group"><label class="form-label" for="f_mul_vatan">Mul Vatan</label>
              <input class="form-input" id="f_mul_vatan" name="mul_vatan" value="${attr(inq.mul_vatan || '')}"></div>
          </div>
          ${samajField}
          ${catField}
          <div class="divider"></div>
          <div class="section-title" style="margin-top:0">What are they hoping for?</div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_expected_date">Expected date</label>
              <input class="form-input" id="f_expected_date" name="expected_date" type="date" value="${attr(defaultExpectedDate)}"></div>
            <div class="form-group"><label class="form-label" for="f_budget">Their budget</label>
              <input class="form-input" id="f_budget" name="budget" type="number" min="0" step="1" inputmode="numeric" value="${attr(inq.budget || '')}"></div>
          </div>
          <div class="form-hint">Date defaults to the Mahotsav itself — clear it if nothing was mentioned. Either field can be blank.</div>
        </form>

        <div class="divider"></div>
        <div class="section-title" style="margin-top:0">Matching seva</div>
        <div class="btn-row" id="catFilterRow" style="margin-bottom:.7rem"></div>
        <div id="sevResults"></div>`;

      const form = document.getElementById('sevForm');
      bindLookupAdders(form);
      bindExistingDevotee(form);

      const filterRow = document.getElementById('catFilterRow');
      const paintFilters = () => {
        filterRow.innerHTML = CAT_FILTERS.map(([key, label]) => `
          <button type="button" class="badge ${catFilter === key ? 'badge-maroon' : ''}"
                  data-catf="${attr(key)}" style="cursor:pointer;border:1px solid var(--warm-border)">${esc(label)}</button>`
        ).join('');
        filterRow.querySelectorAll('[data-catf]').forEach((b) =>
          b.addEventListener('click', () => {
            catFilter = b.getAttribute('data-catf');
            state.catFilter = catFilter;
            showAllSeva = false;        // a new filter starts collapsed again
            paintFilters();
            paintResults();
          }));
      };

      /* The list is ranked best-fit first, so the answer is almost
         always in the first few. Showing all thirty-five buried the
         form's own fields under a wall of cards; five plus a count is
         enough to choose from, and the rest are one tap away. */
      const SEVA_PREVIEW = 5;
      let showAllSeva = false;

      const paintResults = () => {
        const budget = Number(form.budget.value || 0);
        const expDate = form.expected_date.value || '';
        const ranked = rankPoojas(allPoojas, { expDate, budget, catFilter });
        const shown = showAllSeva ? ranked : ranked.slice(0, SEVA_PREVIEW);
        const hidden = ranked.length - shown.length;

        const box = document.getElementById('sevResults');
        box.innerHTML = ranked.length
          ? `<div class="stack">${shown.map(({ p, dateRank, overBudget }) => sevaCard(p, dateRank, overBudget)).join('')}</div>
             ${hidden > 0 ? `<button type="button" class="btn btn-outline btn-block" id="sevMore" style="margin-top:.7rem">
                 Show ${esc(String(hidden))} more seva</button>` : ''}
             ${showAllSeva && ranked.length > SEVA_PREVIEW ? `<button type="button"
                 class="btn btn-outline btn-block" id="sevLess" style="margin-top:.7rem">Show fewer</button>` : ''}`
          : UI.empty('Nothing open right now', 'Every seva in this filter is either full or closed.', 'temple');

        const more = box.querySelector('#sevMore');
        if (more) more.addEventListener('click', () => { showAllSeva = true; paintResults(); });
        const less = box.querySelector('#sevLess');
        if (less) less.addEventListener('click', () => { showAllSeva = false; paintResults(); });

        box.querySelectorAll('[data-pooja]').forEach((b) =>
          b.addEventListener('click', () => {
            clearFieldErrors(form);
            const data = readForm(form);
            if (!data.full_name) {
              showFieldError(form, 'full_name', 'Please enter the name first');
              form.full_name.scrollIntoView({ behavior: 'smooth', block: 'center' });
              form.full_name.focus();
              return;
            }
            /* Caught here rather than four steps later: the booking will
               be refused without it, and re-entering the whole form at
               the end is the expensive way to find that out. */
            const mobileMsg = UI.mobileError(data.mobile);
            if (mobileMsg) {
              showFieldError(form, 'mobile', mobileMsg);
              form.mobile.scrollIntoView({ behavior: 'smooth', block: 'center' });
              form.mobile.focus();
              return;
            }
            state.inquiry = data;
            state.poojaId = b.getAttribute('data-pooja');
            stepDay();
          }));
      };

      paintFilters();
      paintResults();
      form.expected_date.addEventListener('change', paintResults);
      form.budget.addEventListener('input', debounce(paintResults, 250));
    }

    /* --- step 3: which day (availability) --- */
    async function stepDay() {
      host().innerHTML = UI.loading(2);
      const pooja = await API.pooja(state.poojaId);
      state.pooja = pooja;
      const open = pooja.slots.filter((s) => !s.is_full);
      const whole = pooja.seating_mode === 'whole';
      host().innerHTML = `
        <button class="btn btn-outline mg-btn-xs" data-back>${icon('chevron-left','ico-sm')} Back</button>
        <div class="card" style="margin:.5rem 0">
          <div class="card-body">
            <div class="row-title">${esc(pooja.name)}</div>
            <div class="row-sub">${esc(pooja.category_label || '')} · ${pooja.amount ? esc(money(pooja.amount)) + ' suggested per sevarthi' : 'No fixed amount'}</div>
          </div>
        </div>
        <div class="form-label">${whole ? 'Confirm the patla' : pooja.start_date ? 'Pick a day' : 'Seating'}</div>
        ${pooja.start_date ? '' : `<p class="small muted">The date for this pooja is not fixed yet.</p>`}
        ${whole && pooja.start_date ? `<p class="small muted">This patla is held for the whole yagna.</p>` : ''}
        ${open.length ? '' : `<p class="small" style="color:var(--danger)">This pooja is fully booked. Pick a different one.</p>`}
        <div class="slot-grid">
          ${pooja.slots.map((s) => `
            <button class="slot ${s.is_full ? 'is-full' : ''}" data-slot="${attr(s.id)}" ${s.is_full ? 'disabled' : ''}>
              <div class="slot-date">${!s.slot_date ? 'Date TBA'
                : whole ? esc(UI.fmtRange(pooja.start_date, pooja.end_date)) : esc(fmtDate(s.slot_date))}</div>
              <div class="slot-count">${s.capacity === null
                ? esc(s.booked_count + ' joined')
                : esc(s.booked_count + '/' + s.capacity) + (s.is_full ? ' full' : '')}</div>
            </button>`).join('')}
        </div>`;
      host().querySelector('[data-back]').addEventListener('click', () => {
        state.poojaId = null;
        if (preset && preset.poojaId) { closeSheet(); return; }
        stepSevarthi();
      });
      host().querySelectorAll('[data-slot]').forEach((b) =>
        b.addEventListener('click', () => { state.slotId = b.getAttribute('data-slot'); stepDevotee(); }));
    }

    /* --- step 4: devotee + contribution --- */
    async function stepDevotee() {
      const slot = state.pooja.slots.find((s) => String(s.id) === String(state.slotId));
      const inq = state.inquiry || {};
      host().innerHTML = UI.loading(3);
      const [samajField, catField] = await Promise.all([
        lookupSelect('samaj', 'samaj_id', inq.samaj_id || null, 'Samaj'),
        lookupSelect('devotee_category', 'category_id', inq.category_id || null, 'Devotee Category'),
      ]);

      // The seat's price wins for the committed total — that is what actually
      // funds it. A budget below that price pre-fills Bapa's share with the
      // gap; a budget above it is taken as the higher commitment.
      const suggested = state.pooja.amount || 0;
      const budget = Number(inq.budget || 0);
      const committedDefault = budget > 0 ? Math.max(budget, suggested) : suggested;
      const bapaDefault = budget > 0 && budget < suggested ? (suggested - budget) : 0;
      const amountHint = !budget
        ? `Suggested ${money(suggested)} — a sevarthi may give more.`
        : budget < suggested
          ? `They mentioned ${money(budget)} — this seva is ${money(suggested)}, so Bapa's share is pre-filled with the ${money(suggested - budget)} gap. Adjust either figure.`
          : `They mentioned ${money(budget)}, at or above the ${money(suggested)} for this seva.`;

      host().innerHTML = `
        <button class="btn btn-outline mg-btn-xs" data-back>${icon('chevron-left','ico-sm')} Back</button>
        <div class="card" style="margin:.5rem 0"><div class="card-body" style="padding:.6rem .8rem">
          <div class="row-title">${esc(state.pooja.name)}</div>
          <div class="row-sub">${state.pooja.seating_mode === 'whole'
              ? esc(UI.fmtRange(state.pooja.start_date, state.pooja.end_date))
              : esc(fmtDate(slot.slot_date))}
            · ${slot.capacity === null ? 'open seating' : esc(slot.booked_count + '/' + slot.capacity + ' booked')}</div>
        </div></div>

        <form id="sevForm" novalidate>
          <div class="form-group">
            <label class="form-label req" for="f_full_name">Full Name</label>
            <input class="form-input" id="f_full_name" name="full_name" autocomplete="name" value="${attr(inq.full_name || '')}" required>
            <div class="form-hint" id="dupHint"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label req" for="f_mobile">Mobile No.</label>
              <input class="form-input" id="f_mobile" name="mobile" inputmode="tel" autocomplete="tel" value="${attr(inq.mobile || '')}"></div>
            <div class="form-group"><label class="form-label" for="f_city">City</label>
              <input class="form-input" id="f_city" name="city" value="${attr(inq.city || '')}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_state">State</label>
              <input class="form-input" id="f_state" name="state" value="${attr(inq.state || 'Gujarat')}"></div>
            <div class="form-group"><label class="form-label" for="f_mul_vatan">Mul Vatan</label>
              <input class="form-input" id="f_mul_vatan" name="mul_vatan" value="${attr(inq.mul_vatan || '')}"></div>
          </div>
          ${samajField}
          ${catField}

          <div class="divider"></div>
          <div class="section-title" style="margin-top:0">Contribution</div>
          <div class="form-group">
            <label class="form-label req" for="f_amount_committed">Total Contribution</label>
            <input class="form-input" id="f_amount_committed" name="amount_committed" type="number" min="0" step="1"
                   value="${attr(committedDefault)}" inputmode="numeric">
            <div class="form-hint">${esc(amountHint)}</div>
          </div>
          ${bhuvajiField(bapaDefault)}
          <div class="form-group"><label class="form-label" for="f_notes">Note</label><input class="form-input" id="f_notes" name="notes" data-translate></div>
          ${paidNowField({ label: 'They are paying now' })}
        </form>`;

      const form = document.getElementById('sevForm');
      bindLookupAdders(form); UI.bindTranslate(form); bindBhuvajiToggle(form);
      // Nothing is paid yet, so the whole contribution is what is due.
      bindPaidNow(form, () => Number(form.amount_committed.value || 0));

      // Warn (do not block) when the mobile number already exists.
      const mobileInput = form.querySelector('[name=mobile]');
      mobileInput.addEventListener('blur', async () => {
        const v = mobileInput.value.trim();
        const hint = document.getElementById('dupHint');
        if (v.length < 6) { hint.textContent = ''; return; }
        try {
          const found = await API.devotees({ search: v });
          const match = found.find((d) => (d.mobile || '') === v);
          if (match) {
            hint.textContent = `Existing devotee "${match.full_name}" has this number — their record will be updated, not duplicated.`;
            if (!form.full_name.value) form.full_name.value = match.full_name;
            if (!form.city.value && match.city) form.city.value = match.city;
            if (!form.mul_vatan.value && match.mul_vatan) form.mul_vatan.value = match.mul_vatan;
            if (match.samaj_id) form.samaj_id.value = match.samaj_id;
            if (match.category_id) form.category_id.value = match.category_id;
          } else hint.textContent = '';
        } catch (e) { /* non-blocking */ }
      });

      host().querySelector('[data-back]').addEventListener('click', () => { state.slotId = null; stepDay(); });

      document.getElementById('sheetFoot').innerHTML = `
        <button class="btn btn-outline" data-sheet-close>Cancel</button>
        <button class="btn btn-primary" id="sevSave">Save Sevarthi</button>`;
      document.getElementById('sheetFoot').querySelector('[data-sheet-close]')
        .addEventListener('click', closeSheet);
      document.getElementById('sevSave').addEventListener('click', save);

      async function save(e) {
        const btn = e.currentTarget;
        clearFieldErrors(form);
        const data = readForm(form);

        if (!data.full_name) return showFieldError(form, 'full_name', 'Please enter the name');
        const mobileMsg = UI.mobileError(data.mobile);
        if (mobileMsg) return showFieldError(form, 'mobile', mobileMsg);
        const total = Number(data.amount_committed || 0);
        const bapa = readBhuvajiAmount(data);
        if (bapa > total) return showFieldError(form, 'bhuvaji_planned_amount', "Bapa's share cannot exceed the total");

        /* The seat and any money handed over go in one request, so the
           server can write them in one transaction — the operator never
           has to come back and find this sevarthi to record the cash. */
        const paid = readPaidNow(data);
        if (paid.error) return showFieldError(form, paid.field, paid.error);

        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          const res = await API.post('/bookings', {
            slot_id: state.slotId,
            full_name: data.full_name,
            mobile: data.mobile,
            city: data.city,
            state: data.state,
            mul_vatan: data.mul_vatan,
            samaj_id: data.samaj_id,
            category_id: data.category_id,
            amount_committed: total,
            bhuvaji_planned_amount: bapa,
            notes: data.notes,
            payment: paid.payment || undefined,
          });
          closeSheet();
          toast(`${res.full_name} added as sevarthi` +
                (paid.payment ? ` — ${money(paid.total)} received` : ''), 'ok');
          if (typeof refreshPage === 'function') refreshPage();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Save Sevarthi';
          toast(err.message, 'err');
          if (err.status === 409) stepDay();   // day filled up while the form was open
        }
      }
    }
  }

  /* ============================================================
     ADD PAYMENT — search a pending sevarthi, then record money
     ============================================================ */
  async function addPayment(bookingId) {
    if (bookingId) return paymentForm(bookingId);

    openSheet({
      title: 'Add Payment',
      body: `
        <div class="search-bar">${icon('search')}
          <input class="form-input" id="paySearch" placeholder="Search name, mobile, samaj, category or pooja" autocomplete="off">
        </div>
        <div id="payResults">${UI.loading(3)}</div>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Close</button>`,
      onMount() {
        const input = document.getElementById('paySearch');
        const run = async (q) => {
          const box = document.getElementById('payResults');
          box.innerHTML = UI.loading(2);
          try {
            const rows = await API.outstanding(q);
            if (!rows.length) {
              box.innerHTML = UI.empty('Nothing pending', q ? 'No match for that search.' : 'All sevarthi are fully paid.', 'check');
              return;
            }
            box.innerHTML = `<div class="list">${rows.map((r) => {
              const due = Math.max(0, r.amount_committed - r.amount_paid);
              return `
              <button class="row-item" data-booking="${attr(r.booking_id)}">
                <div class="row-main">
                  <div class="row-title">${esc(r.full_name)} ${UI.coverageBadges(r)}</div>
                  <div class="row-sub">${esc(r.pooja_name)} · ${esc(fmtDate(r.slot_date))}
                    ${r.samaj ? ' · ' + esc(r.samaj) : ''}${r.mobile ? ' · ' + esc(r.mobile) : ''}</div>
                </div>
                <div class="row-end">
                  <div class="row-amount">${esc(money(due))}</div>
                  <div class="small muted">due</div>
                </div>
              </button>`;
            }).join('')}</div>`;
            box.querySelectorAll('[data-booking]').forEach((b) =>
              b.addEventListener('click', () => paymentForm(b.getAttribute('data-booking'))));
          } catch (e) {
            box.innerHTML = UI.errorState(e.message);
          }
        };
        input.addEventListener('input', debounce((ev) => run(ev.target.value.trim()), 260));
        run('');
      },
    });
  }

  /* Correct an entry that was typed wrong. The ledger stays the source
     of truth — the booking's status is recomputed server-side from the
     corrected rows — and the change is audited with the before/after,
     so fixing a typo is not the same as quietly rewriting history. */
  function editPayment(p, onSaved) {
    openSheet({
      title: 'Correct payment entry',
      body: `
        <div class="card" style="margin-bottom:.8rem"><div class="card-body" style="padding:.7rem .85rem">
          <div class="row-title">${esc(p.full_name)}</div>
          <div class="row-sub">${esc(p.pooja_name)} · recorded by ${esc(p.recorded_by || '—')}</div>
        </div></div>
        <form id="payEditForm" novalidate>
          <div class="form-group">
            <label class="form-label req" for="f_amount">Amount</label>
            <input class="form-input" id="f_amount" name="amount" type="number" min="1" step="1"
                   value="${attr(p.amount)}" inputmode="numeric" required>
          </div>
          <div class="form-group">
            <label class="form-label">Paid by</label>
            <div class="btn-row">
              <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
                <input type="radio" name="payer_type" value="devotee" ${p.payer_type !== 'bhuvaji' ? 'checked' : ''}
                       style="width:auto;min-height:0;margin-right:.35rem"> Devotee</label>
              <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
                <input type="radio" name="payer_type" value="bhuvaji" ${p.payer_type === 'bhuvaji' ? 'checked' : ''}
                       style="width:auto;min-height:0;margin-right:.35rem"> Bapa</label>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_payment_date">Date</label>
              <input class="form-input" id="f_payment_date" name="payment_date" type="date" value="${attr(p.payment_date)}"></div>
            <div class="form-group"><label class="form-label" for="f_receipt_no">Receipt No.</label>
              <input class="form-input" id="f_receipt_no" name="receipt_no" value="${attr(p.receipt_no || '')}"></div>
          </div>
          <div class="form-group"><label class="form-label" for="f_notes">Note</label>
            <input class="form-input" id="f_notes" name="notes" data-translate value="${attr(p.notes || '')}"></div>
          <p class="small muted" style="margin:0">The sevarthi's status is recalculated from the ledger
            once this is saved, and the correction is written to the audit log.</p>
        </form>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               <button class="btn btn-primary" id="payEditSave">Save correction</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        sheet.querySelector('#payEditSave').addEventListener('click', async (e) => {
          const form = document.getElementById('payEditForm');
          clearFieldErrors(form);
          const data = readForm(form);
          if (!(Number(data.amount) > 0)) return showFieldError(form, 'amount', 'Enter an amount');
          e.currentTarget.disabled = true;
          try {
            const res = await API.put('/payments/' + p.id, data);
            closeSheet();
            toast(`Corrected — ${String(res.booking_status || '').replace('_', ' ') || 'updated'}`, 'ok');
            if (typeof onSaved === 'function') onSaved();
            else if (typeof refreshPage === 'function') refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  /* `preset.payer_type` opens the form already set to Bapa, so "Add
     Bapa support" from the collections list is one click rather than
     a payment form the operator then has to re-point at Bapa. */
  async function paymentForm(bookingId, preset) {
    const b = await API.get(`/bookings/${bookingId}`);
    const due = Math.max(0, b.amount_committed - b.amount_paid);
    const asBapa = !!(preset && preset.payer_type === 'bhuvaji');

    /* One handover is often split — the sevarthi hands over part and
       Bapa covers the rest. Prefill the split from what Bapa actually
       agreed to: whatever is left of Bapa's promised share, with the
       remainder of the due falling to the devotee. */
    const bapaOwes = Math.max(0, (b.bhuvaji_planned_amount || 0) - (b.bappa_paid || 0));
    const splitBapa = Math.min(bapaOwes, due);
    const splitDevotee = Math.max(0, due - splitBapa);

    openSheet({
      title: asBapa ? 'Add Bapa Support' : 'Record Payment',
      body: `
        <div class="card" style="margin-bottom:.8rem"><div class="card-body" style="padding:.7rem .85rem">
          <div class="row-title">${esc(b.full_name)} ${UI.coverageBadges(b)}</div>
          <div class="row-sub">${esc(b.pooja_name)} · ${esc(fmtDate(b.slot_date))}</div>
          <div class="divider" style="margin:.55rem 0"></div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem">
            <span class="muted">Committed</span><strong>${esc(money(b.amount_committed))}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem">
            <span class="muted">Received so far</span><strong>${esc(money(b.amount_paid))}</strong></div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--danger)">
            <span>Still due</span><strong>${esc(money(due))}</strong></div>
          ${b.bhuvaji_planned_amount > 0 ? `<div class="small muted" style="margin-top:.35rem">
            Bapa agreed to cover ${esc(money(b.bhuvaji_planned_amount))}</div>` : ''}
        </div></div>

        <form id="payForm" novalidate>
          ${/* Who paid comes first now, because it decides whether the
                operator types one amount or two. */''}
          <div class="form-group">
            <label class="form-label">Paid by</label>
            <div class="btn-row">
              <label class="badge pay-payer" style="padding:.5rem .8rem;cursor:pointer">
                <input type="radio" name="payer_type" value="devotee" ${asBapa ? '' : 'checked'} style="width:auto;min-height:0;margin-right:.35rem"> Devotee</label>
              <label class="badge pay-payer" style="padding:.5rem .8rem;cursor:pointer">
                <input type="radio" name="payer_type" value="bhuvaji" ${asBapa ? 'checked' : ''} style="width:auto;min-height:0;margin-right:.35rem"> Bapa</label>
              <label class="badge pay-payer" style="padding:.5rem .8rem;cursor:pointer">
                <input type="radio" name="payer_type" value="both" style="width:auto;min-height:0;margin-right:.35rem"> Both</label>
            </div>
          </div>

          <div class="form-group" id="paySingle">
            <label class="form-label req" for="f_amount">Amount Received</label>
            <input class="form-input" id="f_amount" name="amount" type="number" min="1" step="1" value="${attr(due || '')}" inputmode="numeric">
          </div>

          ${/* Two rows in the ledger, one handover at the counter. The
                totals stay separate because payer_type lives on the row
                — they are never added together and stored. */''}
          <div id="paySplit" hidden>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="f_devotee_amount">From devotee</label>
                <input class="form-input" id="f_devotee_amount" name="devotee_amount" type="number"
                       min="0" step="1" value="${attr(splitDevotee || '')}" inputmode="numeric">
              </div>
              <div class="form-group">
                <label class="form-label" for="f_bhuvaji_amount">From Bapa</label>
                <input class="form-input" id="f_bhuvaji_amount" name="bhuvaji_amount" type="number"
                       min="0" step="1" value="${attr(splitBapa || '')}" inputmode="numeric">
              </div>
            </div>
            <p class="small" id="paySplitTotal" style="margin:-.35rem 0 .9rem"></p>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_payment_date">Date</label>
              <input class="form-input" id="f_payment_date" name="payment_date" type="date" value="${attr(todayISO())}"></div>
            <div class="form-group"><label class="form-label" for="f_receipt_no">Receipt No.</label>
              <input class="form-input" id="f_receipt_no" name="receipt_no"></div>
          </div>
          <div class="form-group"><label class="form-label" for="f_notes">Note</label><input class="form-input" id="f_notes" name="notes" data-translate></div>
          <p class="small muted" style="margin:0">All collections are recorded as cash.</p>
        </form>`,
      footer: `
        <button class="btn btn-outline" data-sheet-close>Cancel</button>
        <button class="btn btn-primary" id="paySave">Save Payment</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);

        const form = document.getElementById('payForm');
        const single = sheet.querySelector('#paySingle');
        const split = sheet.querySelector('#paySplit');
        const splitTotal = sheet.querySelector('#paySplitTotal');
        const payerOf = () => (form.querySelector('[name="payer_type"]:checked') || {}).value || 'devotee';

        /* The split's running total is shown against what is still due,
           because the two halves are typed independently and it is easy
           to leave a gap — or go over — without noticing. */
        function paintTotal() {
          const d = Number(document.getElementById('f_devotee_amount').value || 0);
          const p = Number(document.getElementById('f_bhuvaji_amount').value || 0);
          const total = d + p;
          const over = total - due;
          splitTotal.innerHTML = !total
            ? '<span class="muted">Enter what each side is paying.</span>'
            : `Recording <strong>${esc(money(total))}</strong> in two entries` +
              (over > 0 ? ` — <span style="color:var(--warning)">${esc(money(over))} above what is due</span>`
               : over < 0 ? ` — <span class="muted">${esc(money(-over))} would still be due</span>`
               : ' — <span style="color:var(--success)">settles this seva in full</span>') +
              autoFilledNote(document.getElementById('f_devotee_amount'),
                             document.getElementById('f_bhuvaji_amount'),
                             ["The devotee's share", "Bapa's share"]);
        }

        function applyMode() {
          const both = payerOf() === 'both';
          single.hidden = both;
          split.hidden = !both;
          if (both) paintTotal();
        }
        form.querySelectorAll('[name="payer_type"]').forEach((r) =>
          r.addEventListener('change', applyMode));
        ['f_devotee_amount', 'f_bhuvaji_amount'].forEach((id) =>
          document.getElementById(id).addEventListener('input', paintTotal));
        /* Type either side and the other covers the rest of what is due —
           "he's giving ten lakh, Bapa covers the balance" is the whole
           conversation at the counter. */
        bindSplitBalance(document.getElementById('f_devotee_amount'),
                         document.getElementById('f_bhuvaji_amount'),
                         () => due, paintTotal);
        applyMode();

        sheet.querySelector('#paySave').addEventListener('click', async (e) => {
          clearFieldErrors(form);
          const data = readForm(form);
          const both = data.payer_type === 'both';

          let body;
          let recorded;
          if (both) {
            const d = Number(data.devotee_amount || 0);
            const p = Number(data.bhuvaji_amount || 0);
            if (d < 0 || p < 0) {
              return showFieldError(form, d < 0 ? 'devotee_amount' : 'bhuvaji_amount',
                'An amount cannot be negative');
            }
            if (!(d > 0) && !(p > 0)) {
              return showFieldError(form, 'devotee_amount', 'Enter at least one amount');
            }
            /* payer_type is per ledger row on the server, so it is not
               sent — the two amounts say who paid what. */
            const { payer_type, amount, ...rest } = data;
            body = { booking_id: bookingId, ...rest };
            recorded = d + p;
          } else {
            if (!(Number(data.amount) > 0)) return showFieldError(form, 'amount', 'Enter an amount');
            const { devotee_amount, bhuvaji_amount, ...rest } = data;
            body = { booking_id: bookingId, ...rest };
            recorded = Number(data.amount);
          }

          e.currentTarget.disabled = true;
          e.currentTarget.textContent = 'Saving…';
          try {
            const res = await API.post('/payments', body);
            closeSheet();
            const n = (res.payments || [res.payment]).length;
            toast(`${money(recorded)} recorded${n > 1 ? ' in 2 entries' : ''}` +
                  ` — ${res.booking_status.replace('_', ' ')}`, 'ok');
            if (typeof refreshPage === 'function') refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            e.currentTarget.textContent = 'Save Payment';
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  /* ============================================================
     EDIT SEVARTHI BOOKING — revise the committed amount / Bapa's
     share on an existing booking, or cancel it outright.
     ============================================================ */
  async function editBooking(bookingId) {
    const b = await API.get(`/bookings/${bookingId}`);

    openSheet({
      title: 'Edit Sevarthi',
      body: `
        <div class="card" style="margin-bottom:.8rem"><div class="card-body" style="padding:.7rem .85rem">
          <div class="row-title">${esc(b.full_name)} ${UI.coverageBadges(b)}</div>
          <div class="row-sub">${esc(b.pooja_name)} · ${esc(fmtDate(b.slot_date))}</div>
          <div class="divider" style="margin:.55rem 0"></div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem">
            <span class="muted">Received so far</span><strong>${esc(money(b.amount_paid))}</strong></div>
          <button type="button" class="btn btn-outline mg-btn-xs" data-view-history style="margin-top:.55rem">
            ${icon('history','ico-sm')} Change history</button>
        </div></div>

        <form id="editForm" novalidate>
          <div class="form-group">
            <label class="form-label req" for="f_amount_committed">Total Contribution</label>
            <input class="form-input" id="f_amount_committed" name="amount_committed" type="number" min="0" step="1"
                   value="${attr(b.amount_committed)}" inputmode="numeric">
            <div id="editOverpaidHint">${overpaidHint(b.amount_paid, b.amount_committed)}</div>
          </div>
          ${bhuvajiField(b.bhuvaji_planned_amount)}
          <div class="form-group"><label class="form-label" for="f_notes">Note</label>
            <input class="form-input" id="f_notes" name="notes" data-translate value="${attr(b.notes || '')}"></div>
          ${b.status === 'cancelled' ? '' : paidNowField({ label: 'They are paying now' })}
        </form>`,
      footer: (b.status === 'cancelled' ? '' : `
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-right:auto">
          <button class="btn btn-outline" data-change-seva>Change Seva</button>
          <button class="btn btn-outline" data-cancel-booking style="color:var(--danger);border-color:var(--danger)">Cancel Sevarthi</button>
        </div>`) + `
        <button class="btn btn-outline" data-sheet-close>Close</button>
        <button class="btn btn-primary" id="editSave" ${b.status === 'cancelled' ? 'disabled' : ''}>Save Changes</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        sheet.querySelector('[data-view-history]').addEventListener('click', () => bookingLedger(bookingId));
        const changeSevaBtn = sheet.querySelector('[data-change-seva]');
        if (changeSevaBtn) changeSevaBtn.addEventListener('click', () => reassignBooking(bookingId));
        const cancelBtn = sheet.querySelector('[data-cancel-booking]');
        if (cancelBtn) cancelBtn.addEventListener('click', () => cancelBooking(bookingId, b.full_name));
        const saveBtn = sheet.querySelector('#editSave');
        if (saveBtn.disabled) return;
        const editForm = document.getElementById('editForm');
        bindBhuvajiToggle(editForm);
        /* Raising a commitment and taking the extra there and then is one
           conversation, so the due is read live off the field being
           edited, net of whatever has already come in. */
        bindPaidNow(editForm, () =>
          Math.max(0, Number(editForm.amount_committed.value || 0) - (b.amount_paid || 0)));
        document.getElementById('f_amount_committed').addEventListener('input', () => {
          document.getElementById('editOverpaidHint').innerHTML =
            overpaidHint(b.amount_paid, document.getElementById('f_amount_committed').value);
        });
        saveBtn.addEventListener('click', async (e) => {
          const form = document.getElementById('editForm');
          clearFieldErrors(form);
          const data = readForm(form);
          const total = Number(data.amount_committed || 0);
          const bapa = readBhuvajiAmount(data);
          if (bapa > total) return showFieldError(form, 'bhuvaji_planned_amount', "Bapa's share cannot exceed the total");
          const paid = readPaidNow(data);
          if (paid.error) return showFieldError(form, paid.field, paid.error);

          e.currentTarget.disabled = true;
          e.currentTarget.textContent = 'Saving…';
          try {
            await API.put(`/bookings/${bookingId}`, {
              amount_committed: total, bhuvaji_planned_amount: bapa, notes: data.notes,
            });
            /* The edit lands first: money must never be recorded against
               a commitment the save then failed to raise. */
            if (paid.payment) await API.post('/payments', { booking_id: bookingId, ...paid.payment });
            closeSheet();
            toast('Sevarthi updated' + (paid.payment ? ` — ${money(paid.total)} received` : ''), 'ok');
            if (typeof refreshPage === 'function') refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            e.currentTarget.textContent = 'Save Changes';
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  /** Cancel a booking — releases the seat, keeps the ledger entry (as
      'cancelled') rather than deleting it, so payments already taken
      still show and can be settled/refunded outside the app. */
  function cancelBooking(bookingId, name) {
    UI.confirmSheet({
      title: 'Cancel this sevarthi?',
      message: `${name}'s seat will be released back to the pool. Any payment already received stays on record — settle a refund outside the app if one is owed. This is recorded in the audit trail.`,
      confirmLabel: 'Cancel Sevarthi',
      danger: true,
      onConfirm: async () => {
        await API.post(`/bookings/${bookingId}/cancel`, {});
        toast('Sevarthi cancelled', 'ok');
        if (typeof refreshPage === 'function') refreshPage();
      },
    });
  }

  /* ============================================================
     MOVE A SEVARTHI TO A DIFFERENT SEVA / DAY — re-suggests leftover
     seva by the same date-fit + budget ranking Add Sevarthi uses,
     seeded from what's already committed. The booking (and any
     payment already on it) carries over; only the seat and, if the
     operator changes it, the committed amount move.
     ============================================================ */
  async function reassignBooking(bookingId) {
    const b = await API.get(`/bookings/${bookingId}`);
    const state = { poojaId: null, slotId: null, pooja: null, catFilter: 'all',
                     expDate: undefined, budget: b.amount_committed };
    const host = () => document.getElementById('rsnStep');

    openSheet({
      title: 'Change Seva — ' + b.full_name,
      body: `<div id="rsnStep"></div>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Close</button>`,
      async onMount() { await stepPickSeva(); },
    });

    /* --- re-suggest leftover seva by the new date/amount --- */
    async function stepPickSeva() {
      host().innerHTML = UI.loading(4);
      const allPoojas = await API.poojas();
      const mahotsavStart = allPoojas.map((p) => p.start_date).filter(Boolean).sort()[0] || '';
      const defaultExpDate = state.expDate !== undefined ? state.expDate : mahotsavStart;

      host().innerHTML = `
        <div class="card" style="margin:0 0 .8rem"><div class="card-body" style="padding:.6rem .8rem">
          <div class="row-title">Currently on</div>
          <div class="row-sub">${esc(b.pooja_name)} · ${!b.slot_date ? 'Date TBA' : esc(fmtDate(b.slot_date))}
            · ${esc(money(b.amount_committed))} committed${b.amount_paid > 0 ? ' · ' + esc(money(b.amount_paid)) + ' received' : ''}</div>
        </div></div>
        <form id="rsnForm" novalidate>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_new_date">New expected date</label>
              <input class="form-input" id="f_new_date" name="new_date" type="date" value="${attr(defaultExpDate)}"></div>
            <div class="form-group"><label class="form-label" for="f_new_budget">Amount</label>
              <input class="form-input" id="f_new_budget" name="new_budget" type="number" min="0" step="1" inputmode="numeric" value="${attr(state.budget || '')}"></div>
          </div>
          <div class="form-hint">Defaults to what they already committed — change it if their budget changed too.</div>
        </form>

        <div class="divider"></div>
        <div class="section-title" style="margin-top:0">Leftover seva</div>
        <div class="btn-row" id="catFilterRow" style="margin-bottom:.7rem"></div>
        <div id="rsnResults"></div>`;

      const form = document.getElementById('rsnForm');
      const filterRow = document.getElementById('catFilterRow');
      const paintFilters = () => {
        filterRow.innerHTML = CAT_FILTERS.map(([key, label]) => `
          <button type="button" class="badge ${state.catFilter === key ? 'badge-maroon' : ''}"
                  data-catf="${attr(key)}" style="cursor:pointer;border:1px solid var(--warm-border)">${esc(label)}</button>`
        ).join('');
        filterRow.querySelectorAll('[data-catf]').forEach((btn) =>
          btn.addEventListener('click', () => { state.catFilter = btn.getAttribute('data-catf'); paintFilters(); paintResults(); }));
      };

      const paintResults = () => {
        const expDate = form.new_date.value || '';
        const budget = Number(form.new_budget.value || 0);
        const ranked = rankPoojas(allPoojas, { expDate, budget, catFilter: state.catFilter, keepPoojaId: b.pooja_id });

        const box = document.getElementById('rsnResults');
        box.innerHTML = ranked.length
          ? `<div class="stack">${ranked.map(({ p, dateRank, overBudget }) =>
              sevaCard(p, dateRank, overBudget, p.id === b.pooja_id ? '<span class="badge">Current seva</span>' : '')
            ).join('')}</div>`
          : UI.empty('Nothing else open', 'Every other seva in this filter is full or closed.', 'temple');

        box.querySelectorAll('[data-pooja]').forEach((btn) =>
          btn.addEventListener('click', () => {
            state.expDate = form.new_date.value || null;
            state.budget = Number(form.new_budget.value || 0);
            state.poojaId = btn.getAttribute('data-pooja');
            stepPickDay();
          }));
      };

      paintFilters();
      paintResults();
      form.new_date.addEventListener('change', paintResults);
      form.new_budget.addEventListener('input', debounce(paintResults, 250));
    }

    /* --- which day within the chosen seva --- */
    async function stepPickDay() {
      host().innerHTML = UI.loading(2);
      const pooja = await API.pooja(state.poojaId);
      state.pooja = pooja;
      const whole = pooja.seating_mode === 'whole';
      host().innerHTML = `
        <button class="btn btn-outline mg-btn-xs" data-back>${icon('chevron-left','ico-sm')} Back</button>
        <div class="card" style="margin:.5rem 0"><div class="card-body">
          <div class="row-title">${esc(pooja.name)}</div>
          <div class="row-sub">${esc(pooja.category_label || '')}${pooja.amount ? ' · ' + esc(money(pooja.amount)) + ' suggested' : ''}</div>
        </div></div>
        <div class="form-label">${whole ? 'Confirm the patla' : pooja.start_date ? 'Pick a day' : 'Seating'}</div>
        <div class="slot-grid">
          ${pooja.slots.map((s) => {
            const isCurrentSlot = String(s.id) === String(b.slot_id);
            const disabled = s.is_full && !isCurrentSlot;
            return `
            <button class="slot ${disabled ? 'is-full' : ''} ${isCurrentSlot ? 'is-selected' : ''}" data-slot="${attr(s.id)}" ${disabled ? 'disabled' : ''}>
              <div class="slot-date">${!s.slot_date ? 'Date TBA'
                : whole ? esc(UI.fmtRange(pooja.start_date, pooja.end_date)) : esc(fmtDate(s.slot_date))}</div>
              <div class="slot-count">${s.capacity === null
                ? esc(s.booked_count + ' joined')
                : esc(s.booked_count + '/' + s.capacity) + (disabled ? ' full' : '')}${isCurrentSlot ? ' · current' : ''}</div>
            </button>`;
          }).join('')}
        </div>`;
      host().querySelector('[data-back]').addEventListener('click', () => { state.poojaId = null; stepPickSeva(); });
      host().querySelectorAll('[data-slot]').forEach((btn) =>
        btn.addEventListener('click', () => { state.slotId = btn.getAttribute('data-slot'); stepConfirm(); }));
    }

    /* --- confirm the move (and any amount change) --- */
    async function stepConfirm() {
      const slot = state.pooja.slots.find((s) => String(s.id) === String(state.slotId));
      const sameSlot = String(state.slotId) === String(b.slot_id);
      const suggested = state.pooja.amount || 0;
      const budget = Number(state.budget || 0);
      const committedDefault = budget > 0 ? Math.max(budget, suggested) : (suggested || b.amount_committed);
      const bapaDefault = budget > 0 && budget < suggested ? (suggested - budget) : 0;

      host().innerHTML = `
        <button class="btn btn-outline mg-btn-xs" data-back>${icon('chevron-left','ico-sm')} Back</button>
        <div class="card" style="margin:.5rem 0"><div class="card-body">
          <div class="row-sub">From</div>
          <div class="row-title">${esc(b.pooja_name)} · ${!b.slot_date ? 'Date TBA' : esc(fmtDate(b.slot_date))}</div>
          <div class="divider" style="margin:.5rem 0"></div>
          <div class="row-sub">To</div>
          <div class="row-title">${esc(state.pooja.name)} · ${!slot.slot_date ? 'Date TBA' : esc(fmtDate(slot.slot_date))}</div>
        </div></div>
        ${sameSlot ? `<p class="small muted">That's the day they're already on — nothing to move.</p>` : `
        <form id="rsnConfirmForm" novalidate>
          <div class="form-group">
            <label class="form-label req" for="f_amount_committed">Total Contribution</label>
            <input class="form-input" id="f_amount_committed" name="amount_committed" type="number" min="0" step="1"
                   value="${attr(committedDefault)}" inputmode="numeric">
            <div id="rsnOverpaidHint">${overpaidHint(b.amount_paid, committedDefault)}</div>
          </div>
          ${bhuvajiField(bapaDefault)}
          <div class="form-hint">Any payment already received (${esc(money(b.amount_paid))}) stays on this booking — only the seat and, if changed here, the amount move.</div>
        </form>`}`;

      host().querySelector('[data-back]').addEventListener('click', stepPickDay);
      if (!sameSlot) {
        const confirmForm = document.getElementById('rsnConfirmForm');
        bindBhuvajiToggle(confirmForm);
        document.getElementById('f_amount_committed').addEventListener('input', () => {
          document.getElementById('rsnOverpaidHint').innerHTML =
            overpaidHint(b.amount_paid, document.getElementById('f_amount_committed').value);
        });
      }
      document.getElementById('sheetFoot').innerHTML = `
        <button class="btn btn-outline" data-sheet-close>Cancel</button>
        <button class="btn btn-primary" id="rsnConfirm" ${sameSlot ? 'disabled' : ''}>Move Sevarthi</button>`;
      document.getElementById('sheetFoot').querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
      const confirmBtn = document.getElementById('rsnConfirm');
      if (confirmBtn.disabled) return;
      confirmBtn.addEventListener('click', async (e) => {
        const form = document.getElementById('rsnConfirmForm');
        clearFieldErrors(form);
        const data = readForm(form);
        const total = Number(data.amount_committed || 0);
        const bapa = readBhuvajiAmount(data);
        if (bapa > total) return showFieldError(form, 'bhuvaji_planned_amount', "Bapa's share cannot exceed the total");

        e.currentTarget.disabled = true;
        e.currentTarget.textContent = 'Moving…';
        try {
          await API.post(`/bookings/${bookingId}/reassign`, {
            slot_id: state.slotId, amount_committed: total, bhuvaji_planned_amount: bapa,
          });
          closeSheet();
          toast('Sevarthi moved', 'ok');
          if (typeof refreshPage === 'function') refreshPage();
        } catch (err) {
          e.currentTarget.disabled = false;
          e.currentTarget.textContent = 'Move Sevarthi';
          toast(err.message, 'err');
        }
      });
    }
  }

  /** Read-only timeline of everything that's happened to one booking —
      reassignments (from → to seva), amount edits and cancellation —
      sourced from the same audit_log every other write already logs to. */
  /* The sevarthi's full money record: every payment entry, correctable
     and removable here, then the change history underneath. This is
     where correcting an entry lives now that the Payments page is a
     collections list rather than a cash book — without it, removing
     that view would have taken the only route to a mistyped payment
     with it. */
  async function bookingLedger(bookingId, onChanged) {
    openSheet({
      title: 'Ledger',
      body: `<div id="blBody">${UI.loading(4)}</div>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Close</button>`,
      async onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        await paint();

        async function paint() {
          const box = document.getElementById('blBody');
          if (!box) return;
          box.innerHTML = UI.loading(4);
          try {
            const [b, audit] = await Promise.all([
              API.get('/bookings/' + bookingId),
              API.audit({ entity: 'booking', entity_id: bookingId, limit: 100 }),
            ]);
            document.getElementById('sheetTitle').textContent = 'Ledger — ' + b.full_name;
            const c = UI.coverage(b);

            const line = (label, value, cls) =>
              `<div style="display:flex;justify-content:space-between;font-size:.82rem${cls ? ';color:' + cls : ''}">
                 <span class="muted">${esc(label)}</span><strong>${esc(money(value))}</strong></div>`;

            const ACTION_BADGE = { create: 'badge-confirmed', update: 'badge-maroon', cancel: 'badge-cancelled', payment: 'badge-gold', delete: 'badge-danger' };

            box.innerHTML = `
              <div class="card" style="margin-bottom:.9rem"><div class="card-body" style="padding:.75rem .9rem">
                <div class="row-title">${esc(b.full_name)} ${UI.coverageBadges(b)}</div>
                <div class="row-sub">${esc(b.pooja_name)} · ${esc(fmtDate(b.slot_date))}</div>
                <div class="divider" style="margin:.55rem 0"></div>
                ${line('Contribution', c.committed)}
                ${line('Devotee paid', c.devotee_paid)}
                ${c.bappa_paid ? line("Bapa's support", c.bappa_paid, 'var(--warning)') : ''}
                ${c.outstanding > 0 ? line('Outstanding', c.outstanding, 'var(--danger)')
                  : c.excess > 0 ? line('Excess', c.excess, 'var(--saffron)') : ''}
              </div></div>

              <div class="section-title" style="margin:0 0 .5rem">Payments</div>
              ${b.payments && b.payments.length ? `<div class="card"><div class="card-body" style="padding:0"><div class="list">
                ${b.payments.map((p) => `
                  <div class="row-item" style="cursor:default">
                    <div class="row-main">
                      <div class="row-title">${esc(money(p.amount))}
                        ${p.payer_type === 'bhuvaji' ? '<span class="badge badge-gold">Bapa</span>' : ''}</div>
                      <div class="row-sub">${esc(fmtDate(p.payment_date))}
                        ${p.receipt_no ? ' · #' + esc(p.receipt_no) : ''} · by ${esc(p.recorded_by || '—')}</div>
                      ${p.notes ? `<div class="row-sub">${esc(p.notes)}</div>` : ''}
                    </div>
                    <div class="row-actions">
                      <button class="icon-btn" data-pedit="${attr(p.id)}" title="Correct this entry"
                              style="color:var(--ink-soft)">${icon('edit','ico-sm')}</button>
                      <button class="icon-btn" data-pdel="${attr(p.id)}" title="Remove this entry"
                              style="color:var(--ink-soft)">${icon('trash','ico-sm')}</button>
                    </div>
                  </div>`).join('')}
              </div></div></div>` : `<p class="small muted">Nothing received against this seva yet.</p>`}

              <div class="section-title" style="margin:1.1rem 0 .5rem">Change history</div>
              ${audit.length ? `<div class="card"><div class="card-body" style="padding:0"><div class="list">
                ${audit.map((a) => `
                  <div class="row-item" style="cursor:default;align-items:flex-start">
                    <span class="badge ${ACTION_BADGE[a.action] || ''}">${esc(a.action)}</span>
                    <div class="row-main">
                      <div class="row-title" style="font-weight:500;white-space:normal">${esc(a.summary)}</div>
                      <div class="row-sub">${esc(a.user_name)} · <span title="${attr(a.created_at)}">${esc(UI.ago(a.created_at))}</span></div>
                    </div>
                  </div>`).join('')}
              </div></div></div>` : `<p class="small muted">No changes recorded yet.</p>`}`;

            const refresh = async () => { await paint(); if (typeof onChanged === 'function') onChanged(); };

            box.querySelectorAll('[data-pedit]').forEach((el) =>
              el.addEventListener('click', () => {
                const p = b.payments.find((x) => String(x.id) === el.getAttribute('data-pedit'));
                /* editPayment needs the devotee/pooja names for its header,
                   which the booking row already carries. */
                editPayment(Object.assign({}, p, { full_name: b.full_name, pooja_name: b.pooja_name }),
                  () => bookingLedger(bookingId, onChanged));
              }));

            box.querySelectorAll('[data-pdel]').forEach((el) =>
              el.addEventListener('click', () => {
                UI.confirmSheet({
                  title: 'Remove this payment?',
                  message: 'The entry is deleted and the sevarthi status recalculated from what remains. ' +
                           'The removal is written to the audit trail.',
                  confirmLabel: 'Remove', danger: true,
                  onConfirm: async () => {
                    await API.del('/payments/' + el.getAttribute('data-pdel'));
                    toast('Payment entry removed', 'ok');
                    bookingLedger(bookingId, onChanged);
                  },
                });
              }));
            void refresh;
          } catch (e) {
            box.innerHTML = UI.errorState(e.message);
          }
        }
      },
    });
  }

  async function bookingHistory(bookingId, fullName) {
    openSheet({
      title: 'Change History — ' + fullName,
      body: `<div id="bhBody">${UI.loading(3)}</div>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Close</button>`,
      async onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const box = document.getElementById('bhBody');
        try {
          const rows = await API.audit({ entity: 'booking', entity_id: bookingId, limit: 100 });
          const ACTION_BADGE = { create: 'badge-confirmed', update: 'badge-maroon', cancel: 'badge-cancelled' };
          box.innerHTML = rows.length ? `<div class="list">${rows.map((a) => {
            let details = null;
            try { details = a.details ? JSON.parse(a.details) : null; } catch (e) { /* pre-JSON rows */ }
            const moved = details && details.from_pooja && details.to_pooja;
            return `
            <div class="row-item" style="cursor:default;align-items:flex-start">
              <span class="badge ${ACTION_BADGE[a.action] || ''}">${esc(a.action)}</span>
              <div class="row-main">
                ${moved ? `<div class="row-title" style="white-space:normal">
                    ${esc(details.from_pooja)} (${esc(fmtDate(details.from_slot))})
                    → ${esc(details.to_pooja)} (${esc(fmtDate(details.to_slot))})
                  </div>`
                  : `<div class="row-title" style="font-weight:500;white-space:normal">${esc(a.summary)}</div>`}
                <div class="row-sub">${esc(a.user_name)} · ${esc(a.created_at)}</div>
              </div>
            </div>`;
          }).join('')}</div>` : UI.empty('No changes yet', 'Edits, seva changes and cancellation will show up here.', 'history');
        } catch (e) {
          box.innerHTML = UI.errorState(e.message);
        }
      },
    });
  }

  /* ============================================================
     Simple lookup adders (Samaj / Devotee Category / Donation Cat.)
     ============================================================ */
  function addLookupSheet(type, title) {
    openSheet({
      title,
      body: `
        <form id="lkForm" novalidate>
          <div class="form-group">
            <label class="form-label req" for="f_value">${esc(title.replace(/^(Add|Manage) /, ''))} Name</label>
            <input class="form-input" id="f_value" name="value" autocomplete="off">
          </div>
        </form>
        <div class="section-title">Existing</div>
        <div id="lkList">${UI.loading(2)}</div>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Close</button>
               <button class="btn btn-primary" id="lkSave">Add</button>`,
      async onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const paint = async () => {
          const items = await API.lookups(type);
          /* Renaming in place beats delete-and-re-add: devotees point at
             the row by id, so a corrected spelling fixes every devotee
             at once instead of orphaning them. */
          document.getElementById('lkList').innerHTML = items.length
            ? `<div class="list">${items.map((i) => `
                <div class="row-item" style="cursor:default">
                  <div class="row-main"><input class="form-input lk-rename" data-rename="${attr(i.id)}"
                        value="${attr(i.value)}" aria-label="Rename ${attr(i.value)}"></div>
                  <div class="row-actions">
                    <button class="icon-btn" data-save="${attr(i.id)}" title="Save name" hidden
                            style="color:var(--primary-maroon)">${icon('check','ico-sm')}</button>
                    <button class="icon-btn" data-del="${attr(i.id)}" title="Remove" style="color:var(--ink-soft)">
                      ${icon('trash','ico-sm')}</button>
                  </div>
                </div>`).join('')}</div>`
            : UI.empty('Nothing added yet', '', 'plus');

          const listEl = document.getElementById('lkList');
          listEl.querySelectorAll('[data-rename]').forEach((input) => {
            const id = input.getAttribute('data-rename');
            const original = input.value;
            const saveBtn = listEl.querySelector(`[data-save="${id}"]`);
            const sync = () => { saveBtn.hidden = input.value.trim() === original || !input.value.trim(); };
            input.addEventListener('input', sync);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });
            saveBtn.addEventListener('click', async () => {
              try {
                await API.put('/lookups/' + id, { value: input.value.trim() });
                toast('Renamed', 'ok');
                await paint();
                if (typeof refreshPage === 'function') refreshPage();
              } catch (e) { toast(e.message, 'err'); input.value = original; sync(); }
            });
          });

          listEl.querySelectorAll('[data-del]').forEach((b) =>
            b.addEventListener('click', async () => {
              try { await API.del('/lookups/' + b.getAttribute('data-del')); paint(); toast('Removed', 'ok'); }
              catch (e) { toast(e.message, 'err'); }
            }));
        };
        await paint();

        sheet.querySelector('#lkSave').addEventListener('click', async () => {
          const form = document.getElementById('lkForm');
          clearFieldErrors(form);
          const value = (form.value.value || '').trim();
          if (!value) return showFieldError(form, 'value', 'Please enter a name');
          try {
            await API.addLookup(type, value);
            form.value.value = '';
            toast('Added', 'ok');
            paint();
            if (typeof refreshPage === 'function') refreshPage();
          } catch (e) { toast(e.message, 'err'); }
        });
      },
    });
  }

  /* ============================================================
     Quick-add menu (the + in the tab bar)
     ============================================================ */
  function quickAddMenu() {
    const items = [
      ['Add Seva', 'seat', () => addSevarthi()],
      ['Add Payment', 'rupee', () => addPayment()],
      ['Add Devotee', 'users', () => Pages.devotees.openForm()],
      ['Add Donation', 'gift', () => Pages.donations.openForm()],
      ['Add Padhramni', 'temple', () => Pages.visits.openForm()],
      ['Add Samaj', 'plus', () => addLookupSheet('samaj', 'Add Samaj')],
      ['Add Devotee Category', 'plus', () => addLookupSheet('devotee_category', 'Add Devotee Category')],
    ];
    openSheet({
      title: 'Quick Add',
      body: `<div class="list">${items.map(([label, ic], i) => `
        <button class="row-item" data-qa="${i}">
          <span class="badge-ico" style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--saffron),var(--maroon))">${icon(ic,'ico-sm')}</span>
          <div class="row-main"><div class="row-title">${esc(label)}</div></div>
          ${icon('chevron-right','ico-sm')}
        </button>`).join('')}</div>`,
      onMount(sheet) {
        sheet.querySelectorAll('[data-qa]').forEach((b) =>
          b.addEventListener('click', () => {
            const fn = items[Number(b.getAttribute('data-qa'))][2];
            closeSheet();
            setTimeout(fn, 120);
          }));
      },
    });
  }

  /* ============================================================
     Global search across devotees + bookings
     ============================================================ */
  function globalSearch() {
    openSheet({
      title: 'Search',
      body: `
        <div class="search-bar">${icon('search')}
          <input class="form-input" id="gsInput" placeholder="Name, mobile, samaj, pooja…" autocomplete="off"></div>
        <div id="gsResults">${UI.empty('Start typing', 'Search devotees and sevarthi bookings.', 'search')}</div>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Close</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const run = debounce(async (q) => {
          const box = document.getElementById('gsResults');
          if (!q) { box.innerHTML = UI.empty('Start typing', '', 'search'); return; }
          box.innerHTML = UI.loading(2);
          try {
            const [devotees, bookings] = await Promise.all([
              API.devotees({ search: q }), API.bookings({ search: q }),
            ]);
            if (!devotees.length && !bookings.length) {
              box.innerHTML = UI.empty('No match', 'Try a different name or number.', 'search');
              return;
            }
            box.innerHTML = `
              ${devotees.length ? `<div class="section-title">Devotees</div><div class="list">${devotees.slice(0, 8).map((d) => `
                <button class="row-item" data-dev="${attr(d.id)}">
                  <div class="row-main"><div class="row-title">${esc(d.full_name)}</div>
                    <div class="row-sub">${[d.mobile, d.city, d.samaj].filter(Boolean).map(esc).join(' · ')}</div></div>
                  ${icon('chevron-right','ico-sm')}
                </button>`).join('')}</div>` : ''}
              ${bookings.length ? `<div class="section-title">Sevarthi bookings</div><div class="list">${bookings.slice(0, 8).map((b) => `
                <button class="row-item" data-bk="${attr(b.id)}">
                  <div class="row-main"><div class="row-title">${esc(b.full_name)} ${UI.coverageBadges(b)}</div>
                    <div class="row-sub">${esc(b.pooja_name)} · ${esc(fmtDate(b.slot_date))}</div></div>
                  <div class="row-end"><div class="row-amount">${esc(money(b.amount_paid))}</div>
                    <div class="small muted">of ${esc(money(b.amount_committed))}</div></div>
                </button>`).join('')}</div>` : ''}`;
            box.querySelectorAll('[data-dev]').forEach((b) => b.addEventListener('click', () => {
              closeSheet(); Pages.devotees.openProfile(b.getAttribute('data-dev'));
            }));
            box.querySelectorAll('[data-bk]').forEach((b) => b.addEventListener('click', () => {
              paymentForm(b.getAttribute('data-bk'));
            }));
          } catch (e) { box.innerHTML = UI.errorState(e.message); }
        }, 280);
        const input = sheet.querySelector('#gsInput');
        input.addEventListener('input', (e) => run(e.target.value.trim()));
      },
    });
  }

  /* ============================================================
     Operator switcher (drives the audit trail's "who")
     ============================================================ */
  async function switchUser() {
    const users = await API.users();
    const me = API.currentUser();
    openSheet({
      title: 'Signed in as',
      body: `<div class="list">${users.filter((u) => u.active).map((u) => `
        <button class="row-item" data-user="${attr(u.id)}" data-name="${attr(u.name)}" data-role="${attr(u.role)}">
          <div class="row-main"><div class="row-title">${esc(u.name)}</div>
            <div class="row-sub">${esc(u.role)}</div></div>
          ${String(u.name) === String(me.name) ? icon('check', 'ico-sm') : ''}
        </button>`).join('')}</div>
        <p class="small muted" style="margin-top:.7rem">Every entry you save is recorded against this name in the audit trail.</p>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Close</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        sheet.querySelectorAll('[data-user]').forEach((b) =>
          b.addEventListener('click', () => {
            API.setCurrentUser({
              id: b.getAttribute('data-user'),
              name: b.getAttribute('data-name'),
              role: b.getAttribute('data-role'),
            });
            paintUser();
            closeSheet();
            toast('Now working as ' + b.getAttribute('data-name'), 'ok');
          }));
      },
    });
  }

  global.Forms = {
    addSevarthi, addPayment, paymentForm, editPayment, editBooking, cancelBooking, reassignBooking,
    bookingHistory, bookingLedger,
    addLookupSheet, quickAddMenu, globalSearch, switchUser,
  };
})(window);
