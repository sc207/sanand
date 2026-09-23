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
  /* ------------------------------------------------------------
     HOW THIS SEVA IS FUNDED
     ------------------------------------------------------------
     Three answers, not a checkbox. It used to be one tick — "Bapa is
     covering part of this" — with an amount underneath, and the trust
     then asked for a fourth thing the tick could not say: a seva given
     outright by Bhuvaji Suresh Bapa. Typing the full contribution into
     the "part" box would have stored the same numbers, but it is not
     the same statement: a gift means nothing is ever asked of the
     sevarthi, and the form has to stop offering to take it.

     Three mutually exclusive options is exactly what a radio group is
     for, and at three the guidance is to show them all rather than
     hide them in a select — the choice is the point of this step.

       sevarthi  the sevarthi gives the whole contribution
       part      Bapa covers a share of it, the sevarthi the rest
       gift      Bapa gives the whole seva

     The two fields the server actually reads — bhuvaji_enabled and
     bhuvaji_planned_amount — are kept exactly as they were, so every
     existing caller and every existing check still works; `is_gift`
     rides alongside. A gift sets the share from the contribution
     rather than asking for it twice.
     ------------------------------------------------------------ */
  const FUND_MODES = [
    ['sevarthi', 'Sevarthi gives it', 'The full contribution comes from the sevarthi.'],
    ['part', 'Bapa covers part', 'Bapa covers a share; the sevarthi gives the rest.'],
    ['gift', 'Gift from Bapa', 'Bhuvaji Suresh Bapa gives the whole seva. Nothing is collected from the sevarthi.'],
  ];

  const fundModeOf = (amount, isGift) =>
    (isGift ? 'gift' : Number(amount || 0) > 0 ? 'part' : 'sevarthi');

  function bhuvajiField(amount, opts) {
    const o = opts || {};
    const mode = fundModeOf(amount, o.isGift);
    /* Two things on this form mention Bapa, and they are not the same
       thing: this is what Bapa has *agreed to cover* — a promise, no
       money moved — and the block below is cash actually handed over
       today. The wording here names it as an agreement, the wording
       there names it as a handover, and bindPaidNow derives the second
       from the first so they cannot quietly disagree. */
    return `
      <div class="form-group entry-block" data-block="agreement">
        <div class="fund-modes" role="radiogroup" aria-label="How this seva is funded">
          ${FUND_MODES.map(([key, label, hint]) => `
            <label class="fund-mode ${mode === key ? 'is-on' : ''}${key === 'gift' ? ' is-gift' : ''}">
              <input type="radio" name="fund_mode" value="${attr(key)}" ${mode === key ? 'checked' : ''}
                     ${o.giftBlocked && key === 'gift' ? 'disabled' : ''}>
              <span class="fund-mode-t">
                <span class="fund-mode-k">${key === 'gift' ? icon('diya', 'ico-sm') : ''}${esc(label)}</span>
                <span class="fund-mode-h">${esc(hint)}</span>
              </span>
            </label>`).join('')}
        </div>
        ${o.giftBlocked ? `<div class="form-hint" style="color:var(--warning)">
          ${icon('alert','ico-sm')} ${esc(o.giftBlocked)}</div>` : ''}

        ${/* The server reads these two. The radio above only decides
              what they hold and whether they are asked for. */''}
        <input type="hidden" name="bhuvaji_enabled" id="f_bhuvaji_enabled" value="${mode === 'sevarthi' ? '' : '1'}">
        <div id="bhuvajiAmountWrap" style="margin-top:.7rem${mode === 'part' ? '' : ';display:none'}">
          <label class="form-label" for="f_bhuvaji_planned_amount">Bapa's agreed share</label>
          <input class="form-input" id="f_bhuvaji_planned_amount" name="bhuvaji_planned_amount" type="number" min="0" step="1"
                 value="${attr(Number(amount || 0))}" inputmode="numeric">
          <div class="form-hint">What was promised, not what has been handed over — record that below.</div>
          ${/* The other half of the arithmetic. Entering Bapa's share
                without seeing what that leaves the sevarthi made the
                operator work the subtraction out in their head. */''}
          <div class="form-hint" id="bhuvajiShareSplit" style="margin-top:.35rem"></div>
        </div>
        <div class="form-hint" id="giftNote" style="margin-top:.6rem${mode === 'gift' ? '' : ';display:none'}"></div>
      </div>`;
  }

  /** Wire the choice. Keeps the hidden `bhuvaji_enabled` flag and the
      share in step with it, so a figure left behind by a mode the
      operator moved away from can never be read back. */
  function bindBhuvajiToggle(form) {
    const split = form.querySelector('#bhuvajiShareSplit');
    const wrap = form.querySelector('#bhuvajiAmountWrap');
    const giftNote = form.querySelector('#giftNote');
    const modes = [...form.querySelectorAll('[name="fund_mode"]')];
    if (!modes.length) return { paintShare() {} };
    const modeOf = () => (form.querySelector('[name="fund_mode"]:checked') || {}).value || 'sevarthi';
    const totalOf = () => Number((form.amount_committed || {}).value || 0);

    /* Contribution = the sevarthi's share + Bapa's. Only one of the two
       is ever typed, so show the other rather than leaving the operator
       to subtract. */
    function paintShare() {
      const mode = modeOf();
      const total = totalOf();
      if (split) {
        const bapa = Number(form.bhuvaji_planned_amount.value || 0);
        split.innerHTML = (mode !== 'part' || !total) ? ''
          : bapa > total
            ? `<span style="color:var(--warning)">That is more than the ${esc(money(total))} contribution.</span>`
            : `Bapa covers <strong>${esc(money(bapa))}</strong>, the sevarthi gives
               <strong>${esc(money(total - bapa))}</strong>.`;
      }
      if (giftNote) {
        giftNote.innerHTML = mode !== 'gift' ? ''
          : total
            ? `Bapa gives the whole <strong>${esc(money(total))}</strong>.
               Nothing is collected from the sevarthi.`
            : `<span style="color:var(--warning)">Enter the contribution above — a gift covers the whole of it.</span>`;
      }
    }

    function apply() {
      const mode = modeOf();
      form.querySelectorAll('.fund-mode').forEach((el) =>
        el.classList.toggle('is-on', el.querySelector('input').checked));
      if (wrap) wrap.style.display = mode === 'part' ? '' : 'none';
      if (giftNote) giftNote.style.display = mode === 'gift' ? '' : 'none';
      form.bhuvaji_enabled.value = mode === 'sevarthi' ? '' : '1';
      /* A gift is the whole contribution, so the share is never typed —
         it follows the total. Leaving a stale part-share behind would
         send the server a gift that does not cover its own seva. */
      if (mode === 'gift') form.bhuvaji_planned_amount.value = String(totalOf() || 0);
      if (mode === 'sevarthi') form.bhuvaji_planned_amount.value = '0';
      paintShare();
    }

    modes.forEach((r) => r.addEventListener('change', () => {
      apply();
      if (modeOf() === 'part') form.bhuvaji_planned_amount.focus();
      form.dispatchEvent(new CustomEvent('fundmode', { detail: { mode: modeOf() } }));
    }));
    form.bhuvaji_planned_amount.addEventListener('input', paintShare);
    if (form.amount_committed) form.amount_committed.addEventListener('input', () => {
      if (modeOf() === 'gift') form.bhuvaji_planned_amount.value = String(totalOf() || 0);
      paintShare();
      form.dispatchEvent(new CustomEvent('fundmode', { detail: { mode: modeOf() } }));
    });
    apply();
    return { paintShare, modeOf };
  }

  /** What the form is claiming about funding, in the two shapes the
      API takes. */
  const readFundMode = (data) => (data.fund_mode || (data.bhuvaji_enabled ? 'part' : 'sevarthi'));
  const isGiftMode = (data) => readFundMode(data) === 'gift';

  /** The amount only counts when Bapa is involved — reading the number
      field directly would let a stale value slip through while it's
      hidden and supposedly off. A gift is always the whole
      contribution, whatever the field happens to hold. */
  const readBhuvajiAmount = (data) => {
    const mode = readFundMode(data);
    if (mode === 'gift') return Number(data.amount_committed || 0);
    return mode === 'part' ? Number(data.bhuvaji_planned_amount || 0) : 0;
  };

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
      <div class="form-group entry-block" data-block="handover">
        <label class="small" style="display:flex;align-items:center;gap:.45rem;font-weight:500">
          <input type="checkbox" name="paid_now" id="f_paid_now" style="width:auto;min-height:0">
          <span id="paidNowLabel">${esc(o.label || 'Money received now')}</span>
        </label>
        <div id="paidNowWrap" hidden style="margin-top:.6rem">
          ${/* The agreement above already says who is funding this seva,
                so asking "who handed it over" again is only a question
                when the answer could differ — which is exactly when
                Bapa is covering PART of it. On the other two it has one
                possible answer and the row is a second, contradictory
                way to say what was already said. The trust read it as
                a duplicate, twice, and it was one.

                So the row appears only for a shared contribution, and
                the block's own label carries the answer in the other
                two cases: "They are paying now" for the sevarthi,
                "Bapa is handing it over now" for a gift. Nobody is
                trapped — changing who pays means changing the
                agreement, which is the honest edit anyway. */''}
          <div id="paidNowPayer">
          <div class="form-label">Who handed it over</div>
          <div class="btn-row" style="margin:.35rem 0 .7rem">
            <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
              <input type="radio" name="paid_payer" value="devotee" checked style="width:auto;min-height:0;margin-right:.35rem"> Devotee</label>
            <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
              <input type="radio" name="paid_payer" value="bhuvaji" style="width:auto;min-height:0;margin-right:.35rem"> Bapa</label>
            <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
              <input type="radio" name="paid_payer" value="both" style="width:auto;min-height:0;margin-right:.35rem"> Both</label>
          </div>
          </div>
          <div class="form-hint" id="paidNowAgreed" style="margin:-.45rem 0 .7rem"></div>
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
            <div></div>
          </div>
          ${/* The receipt number is issued by the app now, so the
                counter never has to keep the book in its head. The
                box stays, folded away, because a trust carrying a
                paper pad across still needs to write that number in
                — it is simply no longer a question anyone is asked. */''}
          ${UI.moreFields('Receipt number', `
            <div class="form-group"><label class="form-label" for="f_paid_receipt">Receipt No.</label>
              <input class="form-input" id="f_paid_receipt" name="paid_receipt" placeholder="Issued automatically">
              <div class="form-hint">Leave this alone unless you are copying a number from a paper receipt book.</div></div>`,
            { count: 'issued automatically' })}
          <p class="small" id="paidNowHint" style="margin:0"></p>
        </div>
      </div>`;
  }

  /** Wire it up. `dueOf()` returns what is outstanding right now, so the
      hint can say whether what is being entered settles the seva — in
      Add Sevarthi that is the contribution field, which the operator is
      still typing into. */
  function bindPaidNow(form, dueOf, opts) {
    const wrap = form.querySelector('#paidNowWrap');
    if (!wrap) return;
    const o = opts || {};
    /* The caller's wording for this block lives in the markup, not in
       these options — paidNowField put it there. Read it once so the
       gift wording can be swapped in and back out again. */
    const baseLabel = (form.querySelector('#paidNowLabel') || {}).textContent || 'Money received now';
    const single = form.querySelector('#paidNowSingle');
    const split = form.querySelector('#paidNowSplit');
    const hint = form.querySelector('#paidNowHint');
    const agreedLine = form.querySelector('#paidNowAgreed');
    const payerOf = () => (form.querySelector('[name="paid_payer"]:checked') || {}).value || 'devotee';
    const setPayer = (v) => {
      const r = form.querySelector(`[name="paid_payer"][value="${v}"]`);
      if (r) r.checked = true;
    };

    /* How much of Bapa's promise is still unpaid. The promise lives on
       the form (the operator may be editing it this second); anything
       Bapa has already given is passed in, because that is history and
       is not on this form at all. */
    /* How this seva is funded, read live off the choice above. */
    const fundMode = () =>
      (form.querySelector('[name="fund_mode"]:checked') || {}).value
      || (form.bhuvaji_enabled && form.bhuvaji_enabled.value ? 'part' : 'sevarthi');

    const bapaOwes = () => {
      /* `bhuvaji_enabled` used to be the tick the operator clicked and
         is now a hidden field the funding choice writes, so `.checked`
         is undefined on it — reading that made every agreement look
         like nothing was promised, and the split stopped prefilling. */
      const mode = fundMode();
      if (mode === 'sevarthi') return 0;
      const planned = mode === 'gift'
        ? Number((form.amount_committed || {}).value || 0)
        : Number((form.bhuvaji_planned_amount || {}).value || 0);
      return Math.max(0, planned - Number(o.bapaPaid || 0));
    };

    /* The bug the trust spotted: this form states an agreement ("Bapa
       is covering ₹31,000 of ₹31,000") and then, one line below, asks
       who is handing money over — and defaulted that to the devotee,
       contradicting what had just been agreed. Record Payment had
       always derived its payer from Bapa's promised share; this inline
       block never did, so the same two facts were entered two
       different ways depending on which screen you were on.

       So it derives, exactly the way Record Payment does. And it stops
       the moment the operator picks a payer themselves — an agreement
       is a plan, and the whole point of the question is that what
       actually happened at the counter may differ. */
    let payerTouched = false;

    /* A gift is Bapa's, end to end, so "who handed it over" has one
       answer and the server refuses any other. Rather than let the
       operator pick Devotee and be told no on save, the choice is made
       for them and the other two are put out of reach — with a line
       saying why, because a disabled control that does not explain
       itself is worse than one that argues. */
    const giftModeOn = () =>
      (form.querySelector('[name="fund_mode"]:checked') || {}).value === 'gift';

    /* Only a shared contribution leaves a real question about who
       handed the money over. The other two answer it themselves, so
       the row goes and the block's label says who it is. */
    function applyGiftLock() {
      const mode = fundMode();
      const row = form.querySelector('#paidNowPayer');
      const label = form.querySelector('#paidNowLabel');
      if (row) row.hidden = mode !== 'part';
      if (mode === 'gift') { setPayer('bhuvaji'); payerTouched = false; }
      if (mode === 'sevarthi') { setPayer('devotee'); payerTouched = false; }
      if (label) {
        label.textContent = mode === 'gift' ? 'Bapa is handing it over now' : baseLabel;
      }
    }

    function derivePayer() {
      const mode = fundMode();
      if (mode === 'gift') { setPayer('bhuvaji'); return; }
      if (mode === 'sevarthi') { setPayer('devotee'); return; }
      if (payerTouched) return;
      const due = Number(dueOf() || 0);
      const owed = Math.min(bapaOwes(), due);
      if (owed <= 0) { setPayer('devotee'); return; }
      if (owed >= due) { setPayer('bhuvaji'); return; }
      setPayer('both');
      /* Prefilled from the agreement, and flagged as autofilled so the
         hint owns up to it — the same treatment bindSplitBalance gives
         a side it filled in. */
      form.paid_bapa.value = owed || '';
      form.paid_devotee.value = Math.max(0, due - owed) || '';
      form.paid_bapa.dataset.autofilled = '1';
      form.paid_devotee.dataset.autofilled = '1';
    }

    /** Names the disagreement rather than silently allowing or blocking
        it: Bapa promising the whole amount and the devotee handing it
        over is possible, and is usually a mistake. */
    function agreementNote() {
      const mode = fundMode();
      if (mode === 'gift') {
        return `<span class="muted">Recorded as Bapa's, because this seva is his gift.</span>`;
      }
      if (mode === 'sevarthi') return '';
      const owed = bapaOwes();
      if (!owed) return '';
      const payer = payerOf();
      const fromBapa = payer === 'bhuvaji' ? Number(form.paid_amount.value || 0)
        : payer === 'both' ? Number(form.paid_bapa.value || 0) : 0;
      const agreed = `Bapa agreed to cover ${money(owed)} of this.`;
      if (payer === 'devotee') {
        return `<span style="color:var(--warning)">${esc(agreed)}
          This records the sevarthi handing the money over, not Bapa — pick Bapa or Both if that is wrong.</span>`;
      }
      if (fromBapa > owed) {
        return `<span style="color:var(--warning)">${esc(agreed)}
          ${esc(money(fromBapa - owed))} more than that is being recorded from Bapa.</span>`;
      }
      return `<span class="muted">${esc(agreed)}</span>`;
    }

    function paint() {
      const both = payerOf() === 'both';
      single.hidden = both;
      split.hidden = !both;
      const total = both
        ? Number(form.paid_devotee.value || 0) + Number(form.paid_bapa.value || 0)
        : Number(form.paid_amount.value || 0);
      const due = Number(dueOf() || 0);
      if (agreedLine) agreedLine.innerHTML = agreementNote();
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
      if (e.target.checked) {
        applyGiftLock();
        derivePayer();
        paint();
        (payerOf() === 'both' ? form.paid_devotee : form.paid_amount).focus();
      }
    });
    form.querySelectorAll('[name="paid_payer"]').forEach((r) =>
      r.addEventListener('change', () => { payerTouched = true; paint(); }));
    ['paid_amount', 'paid_devotee', 'paid_bapa'].forEach((n) =>
      form[n].addEventListener('input', paint));

    /* Change the agreement and the handover follows it, until the
       operator overrules it. `fundmode` is fired by bindBhuvajiToggle
       whenever the choice or the contribution moves. */
    form.addEventListener('fundmode', () => { applyGiftLock(); derivePayer(); paint(); });
    if (form.bhuvaji_planned_amount) {
      form.bhuvaji_planned_amount.addEventListener('input', () => { derivePayer(); paint(); });
    }
    applyGiftLock();

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

  /** What to do once a booking flow has saved. Callers reached from a
      list want the page behind the sheet repainted; callers reached
      from a sheet of their own — the devotee's profile — want to be
      put back there instead of left looking at whatever page happened
      to be underneath. `onSaved` says which. */
  function afterBookingChange(opts) {
    const done = opts && opts.onSaved;
    /* `done` puts something else in the sheet, so the dialog must stay
       open — closing and reopening it flashes the page behind. */
    if (typeof done === 'function') return done();
    closeSheet();
    if (typeof refreshPage === 'function') refreshPage();
    return undefined;
  }

  /** The block's own fields never belong in the parent payload. */
  function stripPaidNow(data) {
    const { paid_now, paid_payer, paid_amount, paid_devotee, paid_bapa,
            paid_date, paid_receipt, ...rest } = data;
    return rest;
  }

  /* ============================================================
     ADD SEVA — who → which seva → what they give
     ------------------------------------------------------------
     This flow was four steps and asked the same eight devotee fields
     on two of them; the operator filled a whole register entry, chose
     a seva, chose a day, and then filled the register entry again. It
     is three steps now, each devotee field asked exactly once, and the
     day is part of choosing the seva rather than a screen of its own —
     most seva have a single (undated) slot, so that screen was usually
     one button on an otherwise empty page.

     What holds the three together is the rule the rest of the app's
     sheets now follow: the header says which step you are on, the body
     asks only that step's questions, and the footer carries the one
     action that moves you forward. The previous version put "Continue"
     nowhere and left "Close" as the only button, so the real next step
     — a seva card below the fold — was invisible until you scrolled.
     ============================================================ */
  const SEVA_STEPS = ['Sevarthi', 'Seva', 'Contribution'];

  async function addSevarthi(preset) {
    const state = { category: null, poojaId: null, slotId: null, pooja: null, inquiry: null, ...(preset || {}) };
    const host = () => document.getElementById('sevStep');
    /* Opened from a pooja page the seva is already decided, so there is
       no seva step to show and numbering it would be a lie. */
    const fromPooja = !!(preset && preset.poojaId);
    const stepList = fromPooja ? ['Sevarthi', 'Contribution'] : SEVA_STEPS;

    const stepHead = (i) => UI.steps(stepList, fromPooja ? Math.min(i, 1) : i);

    openSheet({
      title: 'Add Seva',
      body: `<div id="sevStep"></div>`,
      footer: '',
      async onMount() {
        if (state.poojaId) { await loadPooja(); }
        await stepWho();
      },
    });

    function goStep(i) {
      if (i === 0) return stepWho();
      if (i === 1 && !fromPooja) return stepSeva();
      return stepAmount();
    }

    async function loadPooja() {
      state.pooja = await API.pooja(state.poojaId);
      const open = state.pooja.slots.filter((s) => !s.is_full);
      /* One open slot is not a choice, it is an answer. Making the
         operator confirm it was a whole screen that said nothing. */
      if (open.length === 1) state.slotId = open[0].id;
    }

    /* ---------- step 1: who is taking the seva ---------- */
    async function stepWho() {
      host().innerHTML = UI.loading(4);
      const inq = state.inquiry || {};
      const [samajField, catField, allPoojas] = await Promise.all([
        lookupSelect('samaj', 'samaj_id', inq.samaj_id, 'Samaj'),
        lookupSelect('devotee_category', 'category_id', inq.category_id, 'Devotee Category'),
        API.poojas(),
      ]);
      // Pin the date picker to the Mahotsav itself, not today's month, so the
      // operator isn't clicking "next" repeatedly to reach Feb 2027. Only on
      // first visit — an explicit clear (null) later is respected as-is.
      const mahotsavStart = allPoojas.map((p) => p.start_date).filter(Boolean).sort()[0] || '';
      const defaultExpectedDate = inq.expected_date !== undefined ? inq.expected_date : mahotsavStart;
      state.allPoojas = allPoojas;

      /* An optional block that already holds an answer opens itself:
         a value folded out of sight is a value the operator cannot
         check, and picking someone off the register fills four of
         these. */
      const hasDetail = !!(inq.city || inq.mul_vatan || inq.samaj_id || inq.category_id ||
                           (inq.state && inq.state !== 'Gujarat'));
      const hasPref = !!(inq.budget || (inq.expected_date !== undefined && inq.expected_date !== mahotsavStart));

      host().innerHTML = `
        ${stepHead(0)}
        <form id="sevForm" novalidate>
          ${existingDevoteeSearch()}
          <div class="form-row">
            <div class="form-group"><label class="form-label req" for="f_full_name">Full Name</label>
              <input class="form-input" id="f_full_name" name="full_name" autocomplete="name"
                     enterkeyhint="next" value="${attr(inq.full_name || '')}"></div>
            <div class="form-group"><label class="form-label req" for="f_mobile">Mobile No.</label>
              <input class="form-input" id="f_mobile" name="mobile" inputmode="tel" autocomplete="tel"
                     enterkeyhint="next" value="${attr(inq.mobile || '')}">
              <div class="form-hint" id="dupHint"></div></div>
          </div>

          ${UI.moreFields('Address & samaj', `
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_city">City</label>
                <input class="form-input" id="f_city" name="city" autocomplete="address-level2" value="${attr(inq.city || '')}"></div>
              <div class="form-group"><label class="form-label" for="f_state">State</label>
                <input class="form-input" id="f_state" name="state" autocomplete="address-level1" value="${attr(inq.state || 'Gujarat')}"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_mul_vatan">Mul Vatan</label>
                <input class="form-input" id="f_mul_vatan" name="mul_vatan" value="${attr(inq.mul_vatan || '')}"></div>
              <div></div>
            </div>
            <div class="form-row">${samajField}${catField}</div>`,
            { open: hasDetail, count: 'optional' })}

          ${fromPooja ? '' : UI.moreFields('What are they hoping for?', `
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_expected_date">Expected date</label>
                <input class="form-input" id="f_expected_date" name="expected_date" type="date" value="${attr(defaultExpectedDate)}"></div>
              <div class="form-group"><label class="form-label" for="f_budget">Their budget</label>
                <input class="form-input" id="f_budget" name="budget" type="number" min="0" step="1" inputmode="numeric" value="${attr(inq.budget || '')}"></div>
            </div>
            <div class="form-hint">Only used to rank the seva list on the next step. Either can be blank.</div>`,
            { open: hasPref, count: 'helps pick a seva' })}
        </form>`;

      const form = document.getElementById('sevForm');
      bindLookupAdders(form);
      bindExistingDevotee(form);
      bindDupHint(form);
      UI.bindEnterFlow(form, next);
      UI.bindSteps(host(), goStep);

      UI.sheetFooter(`
        <button class="btn btn-outline" data-sheet-close>Cancel</button>
        <button class="btn btn-primary" id="sevNext">${fromPooja ? 'Continue' : 'Choose seva'}
          ${icon('chevron-right', 'ico-sm')}</button>`,
        { '#sevNext': next });

      function next() {
        if (!captureWho(form)) return;
        if (fromPooja) return stepAmount();
        stepSeva();
      }
    }

    /** Validates and stores step one. The two checks are here rather
        than at the end because the server refuses a booking without a
        mobile, and finding that out after choosing a seva means doing
        the whole flow again. */
    function captureWho(form) {
      clearFieldErrors(form);
      const data = readForm(form);
      if (!data.full_name) {
        showFieldError(form, 'full_name', 'Please enter the name');
        form.full_name.focus();
        return false;
      }
      const mobileMsg = UI.mobileError(data.mobile);
      if (mobileMsg) {
        showFieldError(form, 'mobile', mobileMsg);
        form.mobile.focus();
        return false;
      }
      state.inquiry = data;
      return true;
    }

    /** Warn — never block — when the number is already on the register,
        and fill in what the trust already knows about them. */
    function bindDupHint(form) {
      const mobileInput = form.querySelector('[name=mobile]');
      if (!mobileInput) return;
      mobileInput.addEventListener('blur', async () => {
        const v = mobileInput.value.trim();
        const hint = document.getElementById('dupHint');
        if (!hint) return;
        if (v.length < 6) { hint.textContent = ''; return; }
        try {
          const found = await API.devotees({ search: v });
          const match = found.find((d) => (d.mobile || '') === v);
          if (!match) { hint.textContent = ''; return; }
          hint.textContent = `${match.full_name} already has this number — their record will be updated, not duplicated.`;
          if (!form.full_name.value) form.full_name.value = match.full_name;
          let filled = false;
          const fill = (name, v2) => {
            if (!form[name] || form[name].value || !v2) return;
            form[name].value = v2; filled = true;
          };
          fill('city', match.city); fill('mul_vatan', match.mul_vatan);
          if (form.samaj_id && !form.samaj_id.value && match.samaj_id) { form.samaj_id.value = match.samaj_id; filled = true; }
          if (form.category_id && !form.category_id.value && match.category_id) { form.category_id.value = match.category_id; filled = true; }
          if (filled) openMoreFieldsAround(form.city);
        } catch (e) { /* non-blocking */ }
      });
    }

    /* ---------- step 2: which seva ---------- */
    async function stepSeva() {
      const inq = state.inquiry || {};
      let catFilter = state.catFilter || 'all';
      const allPoojas = state.allPoojas || await API.poojas();

      host().innerHTML = `
        ${stepHead(1)}
        ${UI.contextCard({
          title: inq.full_name,
          sub: [inq.mobile, inq.city].filter(Boolean).join(' · '),
        })}
        <div class="btn-row" id="catFilterRow" style="margin-bottom:.7rem"></div>
        <div id="sevResults"></div>`;

      UI.bindSteps(host(), goStep);
      UI.sheetFooter(`
        <button class="btn btn-outline" id="sevBack">${icon('chevron-left', 'ico-sm')} Back</button>
        <button class="btn btn-outline" data-sheet-close>Cancel</button>`,
        { '#sevBack': stepWho });

      const filterRow = document.getElementById('catFilterRow');
      const paintFilters = () => {
        /* Same active-filter look as every other filter row in the app
           (Payments, Padhramni): solid maroon for the one in force,
           outline for the rest. A pill whose selected state was another
           pill of nearly the same colour read as four identical chips. */
        filterRow.innerHTML = CAT_FILTERS.map(([key, label]) => `
          <button type="button" class="btn mg-btn-xs ${catFilter === key ? 'btn-primary' : 'btn-outline'}"
                  data-catf="${attr(key)}">${esc(label)}</button>`
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
         form's own fields under a wall of cards; now that this step
         carries nothing but the list it can afford more than five, and
         the rest are still one tap away. */
      const SEVA_PREVIEW = 8;
      let showAllSeva = false;

      const paintResults = () => {
        const budget = Number(inq.budget || 0);
        const expDate = inq.expected_date || '';
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
          b.addEventListener('click', async () => {
            state.poojaId = b.getAttribute('data-pooja');
            state.slotId = null;
            await loadPooja();
            /* A single open slot was already taken by loadPooja; only a
               real choice of days gets a screen. */
            if (state.slotId) return stepAmount();
            stepDay();
          }));
      };

      paintFilters();
      paintResults();
    }

    /* ---------- step 2b: which day, only when there is a choice ---------- */
    function stepDay() {
      const pooja = state.pooja;
      const open = pooja.slots.filter((s) => !s.is_full);
      const whole = pooja.seating_mode === 'whole';
      host().innerHTML = `
        ${stepHead(1)}
        ${UI.contextCard({
          title: pooja.name,
          sub: `${pooja.category_label || ''}${pooja.amount ? ' · ' + money(pooja.amount) + ' suggested' : ''}`,
        })}
        <div class="form-label">${whole ? 'Confirm the patla' : 'Pick a day'}</div>
        ${whole && pooja.start_date ? `<p class="small muted">This patla is held for the whole yagna.</p>` : ''}
        ${open.length ? '' : `<p class="small" style="color:var(--danger)">This seva is fully booked. Go back and pick a different one.</p>`}
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
      UI.bindSteps(host(), goStep);
      UI.sheetFooter(`
        <button class="btn btn-outline" id="sevBack">${icon('chevron-left', 'ico-sm')} Back</button>
        <button class="btn btn-outline" data-sheet-close>Cancel</button>`,
        { '#sevBack': () => { state.poojaId = null; state.pooja = null;
                              if (fromPooja) return closeSheet(); stepSeva(); } });
      host().querySelectorAll('[data-slot]').forEach((b) =>
        b.addEventListener('click', () => { state.slotId = b.getAttribute('data-slot'); stepAmount(); }));
    }

    /* ---------- step 3: what they are giving ---------- */
    async function stepAmount() {
      if (!state.pooja) await loadPooja();
      if (!state.slotId) return stepDay();
      const slot = state.pooja.slots.find((s) => String(s.id) === String(state.slotId));
      const inq = state.inquiry || {};

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
        ${stepHead(2)}
        ${UI.contextCard({
          title: inq.full_name,
          sub: [inq.mobile, inq.city].filter(Boolean).join(' · '),
          rows: [
            ['Seva', state.pooja.name],
            [state.pooja.seating_mode === 'whole' ? 'Dates' : 'Day',
             state.pooja.seating_mode === 'whole'
               ? UI.fmtRange(state.pooja.start_date, state.pooja.end_date)
               : (slot.slot_date ? fmtDate(slot.slot_date) : UI.TBD)],
            ['Seating', slot.capacity === null ? 'Open' : `${slot.booked_count}/${slot.capacity} booked`],
          ],
        })}

        <form id="sevForm" novalidate>
          <div class="form-group">
            <label class="form-label req" for="f_amount_committed">Total Contribution</label>
            <input class="form-input" id="f_amount_committed" name="amount_committed" type="number" min="0" step="1"
                   value="${attr(committedDefault)}" inputmode="numeric">
            <div class="form-hint">${esc(amountHint)}</div>
          </div>
          ${bhuvajiField(bapaDefault)}
          ${paidNowField({ label: 'They are paying now' })}
          ${UI.moreFields('Note', `
            <div class="form-group"><label class="form-label" for="f_notes">Anything to record</label>
              <input class="form-input" id="f_notes" name="notes" data-translate></div>`,
            { count: 'optional' })}
        </form>`;

      const form = document.getElementById('sevForm');
      UI.bindTranslate(form); bindBhuvajiToggle(form);
      // Nothing is paid yet, so the whole contribution is what is due.
      bindPaidNow(form, () => Number(form.amount_committed.value || 0));
      UI.bindSteps(host(), goStep);

      UI.sheetFooter(`
        <button class="btn btn-outline" id="sevBack">${icon('chevron-left', 'ico-sm')} Back</button>
        <button class="btn btn-outline" data-sheet-close>Cancel</button>
        <button class="btn btn-primary" id="sevSave">Save Sevarthi</button>`,
        { '#sevBack': () => {
            state.slotId = null;
            if (state.pooja.slots.filter((s) => !s.is_full).length > 1) return stepDay();
            state.poojaId = null; state.pooja = null;
            if (fromPooja) return closeSheet();
            stepSeva();
          },
          '#sevSave': save });

      async function save(e) {
        const btn = e.currentTarget;
        clearFieldErrors(form);
        const data = readForm(form);
        const who = state.inquiry || {};

        const total = Number(data.amount_committed || 0);
        const bapa = readBhuvajiAmount(data);
        const gift = isGiftMode(data);
        if (bapa > total) return showFieldError(form, 'bhuvaji_planned_amount', "Bapa's share cannot exceed the total");
        if (gift && !total) return showFieldError(form, 'amount_committed',
          'Enter the contribution — a gift from Bapa covers the whole of it');

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
            full_name: who.full_name,
            mobile: who.mobile,
            city: who.city,
            state: who.state,
            mul_vatan: who.mul_vatan,
            samaj_id: who.samaj_id,
            category_id: who.category_id,
            amount_committed: total,
            bhuvaji_planned_amount: bapa,
            is_gift: gift ? 1 : 0,
            notes: data.notes,
            payment: paid.payment || undefined,
          });
          closeSheet();
          toast(`${res.full_name} added as sevarthi` +
                (gift ? ' — a gift from Bapa' : '') +
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

  /** Opens the folded block a field lives in, so a value written into
      it by the app is never hidden from the operator who has to check
      it. */
  function openMoreFieldsAround(field) {
    if (!field) return;
    const box = field.closest('.more-fields');
    if (box) box.open = true;
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
        ${UI.contextCard({ title: p.full_name,
          sub: `${p.pooja_name} · recorded by ${p.recorded_by || '—'}` })}
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
    const opts = preset || {};
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
        ${/* This card is why Record Payment was the one sheet nobody
              got lost in: it says who, what for, and where the money
              stands before asking for a rupee. It is UI.contextCard
              now, and every entry sheet in the app opens with one. */''}
        ${UI.contextCard({
          title: b.full_name,
          badge: UI.coverageBadges(b),
          sub: `${b.pooja_name} · ${fmtDate(b.slot_date)}`,
          rows: [
            ['Committed', money(b.amount_committed)],
            ['Received so far', money(b.amount_paid)],
            ['Still due', money(due), 'is-due'],
          ].concat(b.bhuvaji_planned_amount > 0
            ? [['Bapa agreed to cover', money(b.bhuvaji_planned_amount)]] : []),
        })}

        <form id="payForm" novalidate>
          ${/* Who paid comes first now, because it decides whether the
                operator types one amount or two. */''}
          <div class="form-group">
            <label class="form-label">Paid by</label>
            <div class="btn-row">
              <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
                <input type="radio" name="payer_type" value="devotee" ${asBapa ? '' : 'checked'} style="width:auto;min-height:0;margin-right:.35rem"> Devotee</label>
              <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
                <input type="radio" name="payer_type" value="bhuvaji" ${asBapa ? 'checked' : ''} style="width:auto;min-height:0;margin-right:.35rem"> Bapa</label>
              <label class="badge" style="padding:.5rem .8rem;cursor:pointer">
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
            <div></div>
          </div>
          <div class="form-group"><label class="form-label" for="f_notes">Note</label><input class="form-input" id="f_notes" name="notes" data-translate></div>
          ${/* The receipt number is issued by the app now, so the
                counter never has to keep the book in its head. The
                box stays, folded away, because a trust carrying a
                paper pad across still needs to write that number in
                — it is simply no longer a question anyone is asked. */''}
          ${UI.moreFields('Receipt number', `
            <div class="form-group"><label class="form-label" for="f_receipt_no">Receipt No.</label>
              <input class="form-input" id="f_receipt_no" name="receipt_no" placeholder="Issued automatically">
              <div class="form-hint">Leave this alone unless you are copying a number from a paper receipt book.</div></div>`,
            { count: 'issued automatically' })}
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
            const rows = res.payments || [res.payment];
            /* The number is issued now, so the operator is told what it
               is rather than having to open the ledger to find out —
               that is the whole of "so we don't have to worry about
               it": not asked for, but never hidden either. */
            const nos = rows.map((r) => r.receipt_no).filter(Boolean);
            toast(`${money(recorded)} recorded${rows.length > 1 ? ' in 2 entries' : ''}` +
                  (nos.length ? ` — receipt ${nos.join(' & ')}` : '') +
                  ` — ${res.booking_status.replace('_', ' ')}`, 'ok');
            afterBookingChange(opts);
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
  async function editBooking(bookingId, opts) {
    const b = await API.get(`/bookings/${bookingId}`);

    openSheet({
      title: 'Edit Sevarthi',
      body: `
        ${UI.contextCard({ title: b.full_name, badge: UI.coverageBadges(b),
          sub: `${b.pooja_name} · ${fmtDate(b.slot_date)}`,
          rows: [['Received so far', money(b.amount_paid)]] })}
        <button type="button" class="btn btn-outline mg-btn-xs" data-view-history style="margin:-.5rem 0 1rem">
          ${icon('history','ico-sm')} Change history</button>

        <form id="editForm" novalidate>
          <div class="form-group">
            <label class="form-label req" for="f_amount_committed">Total Contribution</label>
            <input class="form-input" id="f_amount_committed" name="amount_committed" type="number" min="0" step="1"
                   value="${attr(b.amount_committed)}" inputmode="numeric">
            <div id="editOverpaidHint">${overpaidHint(b.amount_paid, b.amount_committed)}</div>
          </div>
          ${/* A sevarthi who has already put money in can never be
                turned into a gift — the trust's rule, and the server
                refuses it. Saying so here, with the figure, beats
                letting the operator pick it and be told no on save. */''}
          ${bhuvajiField(b.bhuvaji_planned_amount, { isGift: b.is_gift,
            giftBlocked: b.devotee_paid > 0
              ? `${b.full_name} has already given ${money(b.devotee_paid)}, so this seva cannot be recorded as a gift. Remove that payment from the ledger first.`
              : '' })}
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
        if (changeSevaBtn) changeSevaBtn.addEventListener('click', () => reassignBooking(bookingId, opts));
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
          Math.max(0, Number(editForm.amount_committed.value || 0) - (b.amount_paid || 0)),
          { bapaPaid: b.bappa_paid || 0 });
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
          const gift = isGiftMode(data);
          if (bapa > total) return showFieldError(form, 'bhuvaji_planned_amount', "Bapa's share cannot exceed the total");
          const paid = readPaidNow(data);
          if (paid.error) return showFieldError(form, paid.field, paid.error);

          e.currentTarget.disabled = true;
          e.currentTarget.textContent = 'Saving…';
          try {
            await API.put(`/bookings/${bookingId}`, {
              amount_committed: total, bhuvaji_planned_amount: bapa,
              is_gift: gift ? 1 : 0, notes: data.notes,
            });
            /* The edit lands first: money must never be recorded against
               a commitment the save then failed to raise. */
            if (paid.payment) await API.post('/payments', { booking_id: bookingId, ...paid.payment });
            toast('Sevarthi updated' + (paid.payment ? ` — ${money(paid.total)} received` : ''), 'ok');
            afterBookingChange(opts);
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
  async function reassignBooking(bookingId, opts) {
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
        ${UI.contextCard({ title: b.full_name,
          sub: 'Currently on ' + b.pooja_name + ' · ' + (!b.slot_date ? 'Date TBA' : fmtDate(b.slot_date)),
          rows: [['Committed', money(b.amount_committed)]]
            .concat(b.amount_paid > 0 ? [['Received so far', money(b.amount_paid)]] : []) })}
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
          <button type="button" class="btn mg-btn-xs ${state.catFilter === key ? 'btn-primary' : 'btn-outline'}"
                  data-catf="${attr(key)}">${esc(label)}</button>`
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
        ${UI.contextCard({ title: pooja.name,
          sub: `${pooja.category_label || ''}${pooja.amount ? ' · ' + money(pooja.amount) + ' suggested' : ''}` })}
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

      /* Bapa's promised share must not evaporate because the sevarthi
         changed seva. The API keeps it when the caller says nothing,
         but this form always says something — it posts whatever its own
         field holds — so defaulting that field to 0 silently cancelled
         the promise on every move. Bapa's *payments* survived (they are
         ledger rows), which is what made it easy to miss: only the
         agreed share disappeared, and with it the Bapa-support prefill
         that is calculated from it.

         An explicit new signal still wins: if the operator has typed a
         budget below what this seva suggests, the gap is what Bapa is
         being asked to cover now. Otherwise carry the existing promise,
         clamped to the new contribution so the form never opens in a
         state the server would refuse. */
      const gap = budget > 0 && budget < suggested ? (suggested - budget) : 0;
      const carried = Math.min(Number(b.bhuvaji_planned_amount) || 0, committedDefault);
      const bapaDefault = gap || carried;

      host().innerHTML = `
        <button class="btn btn-outline mg-btn-xs" data-back>${icon('chevron-left','ico-sm')} Back</button>
        ${UI.contextCard({ title: b.full_name,
          rows: [
            ['From', b.pooja_name + ' · ' + (!b.slot_date ? 'Date TBA' : fmtDate(b.slot_date))],
            ['To', state.pooja.name + ' · ' + (!slot.slot_date ? 'Date TBA' : fmtDate(slot.slot_date))],
          ] })}
        ${sameSlot ? `<p class="small muted">That's the day they're already on — nothing to move.</p>` : `
        <form id="rsnConfirmForm" novalidate>
          <div class="form-group">
            <label class="form-label req" for="f_amount_committed">Total Contribution</label>
            <input class="form-input" id="f_amount_committed" name="amount_committed" type="number" min="0" step="1"
                   value="${attr(committedDefault)}" inputmode="numeric">
            <div id="rsnOverpaidHint">${overpaidHint(b.amount_paid, committedDefault)}</div>
          </div>
          ${bhuvajiField(bapaDefault, { isGift: b.is_gift,
            giftBlocked: b.devotee_paid > 0
              ? `${b.full_name} has already given ${money(b.devotee_paid)}, so this seva cannot be recorded as a gift.`
              : '' })}
          ${carried > 0 && !gap && !b.is_gift ? `<div class="form-hint">
            Bapa's agreed share of ${esc(money(b.bhuvaji_planned_amount))} has been carried over.
            Change the choice above if Bapa is no longer covering part of this seva.</div>` : ''}
          ${b.is_gift ? `<div class="form-hint">
            This seva is a gift from Bapa, and stays one after the move.</div>` : ''}
          <div class="form-hint" data-rsn-keeps>Any payment already received
            (${esc(money(b.amount_paid))}${b.bappa_paid > 0
              ? ', of which ' + esc(money(b.bappa_paid)) + ' from Bapa' : ''})
            stays on this booking — only the seat and, if changed here, the amount move.</div>
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
        const gift = isGiftMode(data);
        if (bapa > total) return showFieldError(form, 'bhuvaji_planned_amount', "Bapa's share cannot exceed the total");

        e.currentTarget.disabled = true;
        e.currentTarget.textContent = 'Moving…';
        try {
          await API.post(`/bookings/${bookingId}/reassign`, {
            slot_id: state.slotId, amount_committed: total, bhuvaji_planned_amount: bapa,
            is_gift: gift ? 1 : 0,
          });
          toast('Sevarthi moved', 'ok');
          afterBookingChange(opts);
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

            const ACTION_BADGE = { create: 'badge-confirmed', update: 'badge-maroon', cancel: 'badge-cancelled', payment: 'badge-gold', delete: 'badge-danger' };

            box.innerHTML = `
              ${UI.contextCard({ title: b.full_name, badge: UI.coverageBadges(b),
                sub: `${b.pooja_name} · ${fmtDate(b.slot_date)}`,
                rows: [['Contribution', money(c.committed)], ['Devotee paid', money(c.devotee_paid)]]
                  .concat(c.bappa_paid ? [["Bapa's support", money(c.bappa_paid)]] : [])
                  .concat(c.outstanding > 0 ? [['Outstanding', money(c.outstanding), 'is-due']]
                        : c.excess > 0 ? [['Excess', money(c.excess)]] : []) })}

              <div class="section-title" style="margin:0 0 .5rem">Payments</div>
              ${b.payments && b.payments.length ? `<div class="card"><div class="card-body" style="padding:0"><div class="list">
                ${b.payments.map((p) => `
                  <div class="row-item" style="cursor:default">
                    <div class="row-main">
                      <div class="row-title">${esc(money(p.amount))}
                        ${p.payer_type === 'bhuvaji' ? '<span class="badge badge-gold">Bapa</span>' : ''}</div>
                      <div class="row-sub">${esc(fmtDate(p.payment_date))}
                        ${p.receipt_no ? ` · <span class="rcpt">${esc(p.receipt_no)}</span>` : ''}
                        · by ${esc(p.recorded_by || '—')}</div>
                      ${p.notes ? `<div class="row-sub">${esc(p.notes)}</div>` : ''}
                    </div>
                    ${/* Correcting or removing money already recorded is kept
                          for the accountant and above. The server refuses it
                          either way; not offering the button means nobody
                          meets that refusal at a counter with someone
                          waiting. */''}
                    ${UI.can('accountant') ? `<div class="row-actions">
                      <button class="icon-btn" data-pedit="${attr(p.id)}" title="Correct this entry"
                              style="color:var(--ink-soft)">${icon('edit','ico-sm')}</button>
                      <button class="icon-btn" data-pdel="${attr(p.id)}" title="Remove this entry"
                              style="color:var(--ink-soft)">${icon('trash','ico-sm')}</button>
                    </div>` : ''}
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
              ${/* Two ways out of a search hit, because the reason for
                    looking someone up is not always the same one: take
                    their money, or change what they are down for. The
                    row used to go straight to Record Payment, which
                    left Change Seva unreachable from here entirely —
                    it lives on Edit Sevarthi, and nothing on this
                    screen opened that. */''}
              ${bookings.length ? `<div class="section-title">Sevarthi bookings</div><div class="list">${bookings.slice(0, 8).map((b) => `
                <div class="row-item gs-booking" style="cursor:default">
                  <div class="row-main"><div class="row-title">${esc(b.full_name)} ${UI.coverageBadges(b)}</div>
                    <div class="row-sub">${esc(b.pooja_name)} · ${esc(fmtDate(b.slot_date))}</div></div>
                  <div class="row-end">
                    <div class="row-amount">${esc(money(b.amount_paid))}</div>
                    <div class="small muted">of ${esc(money(b.amount_committed))}</div>
                    <div class="btn-row" style="margin-top:.4rem;justify-content:flex-end">
                      ${b.status !== 'cancelled' && b.amount_paid < b.amount_committed
                        ? `<button class="btn btn-primary mg-btn-xs" data-bk="${attr(b.id)}">Collect</button>` : ''}
                      <button class="btn btn-outline mg-btn-xs" data-bkedit="${attr(b.id)}">
                        ${icon('edit','ico-sm')} Edit / Change Seva</button>
                    </div>
                  </div>
                </div>`).join('')}</div>` : ''}`;
            box.querySelectorAll('[data-dev]').forEach((b) => b.addEventListener('click', () => {
              closeSheet(); Pages.devotees.openProfile(b.getAttribute('data-dev'));
            }));
            box.querySelectorAll('[data-bk]').forEach((b) => b.addEventListener('click', () => {
              paymentForm(b.getAttribute('data-bk'));
            }));
            box.querySelectorAll('[data-bkedit]').forEach((b) => b.addEventListener('click', () => {
              editBooking(b.getAttribute('data-bkedit'));
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
