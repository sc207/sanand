/* Murti Pran Pratishtha Mahotsav — categories → poojas → one pooja
   with its day-wise seating and its FIFO sevarthi ledger. */
(function (global) {
  'use strict';
  const { esc, attr, money, num, icon, fmtDate, fmtRange, TBD, progressBar, statusBadge,
          openSheet, closeSheet, readForm, clearFieldErrors, showFieldError, toast } = UI;

  const CAT_LABEL = {
    maha_yagna: 'Maha Yagna',
    mandir_pooja: 'Mandir ni Pooja',
    bhagvat_katha: 'Bhagvat Saptah — Katha',
  };

  /* Every page you can go *into* gets an explicit way back, sitting
     above the title alongside the trail. The trail says where you are
     (the names alone — "Anya Mukhya Patla" — don't say which category
     they belong to); the button is the one-tap way out, which is what
     an operator reaches for rather than the browser chrome. Back goes
     to the nearest ancestor with a target, so it works at any depth. */
  function crumbs(trail) {
    const parent = [...trail].reverse().find((c) => c.to);
    return `<div class="crumb-bar">
      ${parent ? `<button type="button" class="btn btn-outline mg-btn-xs crumb-back" data-crumb="${attr(parent.to)}">
        ${icon('chevron-left', 'ico-sm')} Back</button>` : ''}
      <nav class="crumbs" aria-label="Breadcrumb">${trail.map((c, i) => {
        const last = i === trail.length - 1;
        const sep = i ? '<span class="crumb-sep" aria-hidden="true">/</span>' : '';
        return sep + (last || !c.to
          ? `<span class="crumb-current"${last ? ' aria-current="page"' : ''}>${esc(c.label)}</span>`
          : `<button type="button" data-crumb="${attr(c.to)}">${esc(c.label)}</button>`);
      }).join('')}</nav>
    </div>`;
  }

  function bindCrumbs(host) {
    host.querySelectorAll('[data-crumb]').forEach((b) =>
      b.addEventListener('click', () => {
        const to = b.getAttribute('data-crumb');
        navigate.apply(null, to.split('/'));
      }));
  }

  /* "Not decided" and "unlimited" both take sevarthi without limit, but
     the app must not claim the trust chose unlimited when it simply has
     not decided — so they read differently even though they behave the
     same. Only 'limited' ever shows an x / y. */
  function capacityText(p) {
    if (p.capacity_mode === 'limited' && p.total_seats !== null) {
      return `${num(p.booked_seats)} / ${num(p.total_seats)} registered`;
    }
    const n = `${num(p.booked_seats)} registered`;
    return p.capacity_mode === 'unlimited' ? `${n} · unlimited` : `${n} · capacity not decided`;
  }

  async function render(host, params) {
    const [a, b] = params || [];
    if (a === 'pooja' && b) return renderPooja(host, b);
    if (a && CAT_LABEL[a]) return renderCategory(host, a);
    return renderOverview(host);
  }

  /* ---------- level 1: the three categories ---------- */
  async function renderOverview(host) {
    const cats = await API.categories();
    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Murti Pran Pratishtha Mahotsav</h1>
          <p class="mg-page-sub">Sevarthi seating and contributions across all three sevas</p>
        </div>
        <button class="btn btn-primary mg-btn-xs" data-add-sevarthi>${icon('plus','ico-sm')} Sevarthi</button>
      </div>

      <div class="seva-grid">
      ${cats.map((c) => {
        const seatText = c.seats_left === null
          ? `${num(c.booked_seats)} registered` +
            (c.not_decided_count ? ` · ${num(c.not_decided_count)} awaiting a capacity decision` : ' · open seating')
          : `${num(c.booked_seats)} of ${num(c.total_seats)} patla booked · ${num(c.seats_left)} still open`;
        return `
        <button class="card cat-card" data-cat="${attr(c.key)}">
          <div class="card-body">
            <div class="cat-top">
              <span class="cat-ico">${icon(c.icon)}</span>
              <span style="flex:1;min-width:0">
                <span class="cat-name">${esc(c.label)}</span>
                <span class="cat-meta" style="display:block">${esc(c.pooja_count)} pooja${c.pooja_count === 1 ? '' : 's'}</span>
              </span>
              ${icon('chevron-right','ico-sm')}
            </div>
            <div class="progress-row"><span>${esc(seatText)}</span></div>
            ${progressBar(c.booked_seats, c.total_seats)}
            <div class="progress-row" style="margin-top:.5rem">
              <span>${esc(money(c.received))} received</span>
              <span>${c.target_amount ? 'target ' + esc(money(c.target_amount)) : ''}</span>
            </div>
            ${/* Same rule as the dashboard: no target, no bar. */
              c.target_amount > 0 ? progressBar(c.received, c.target_amount, true) : ''}
          </div>
        </button>`;
      }).join('')}
      </div>`;

    host.querySelector('[data-add-sevarthi]').addEventListener('click', () => Forms.addSevarthi());
    host.querySelectorAll('[data-cat]').forEach((el) =>
      el.addEventListener('click', () => navigate('mahotsav', el.getAttribute('data-cat'))));
  }

  /* ---------- level 2: poojas inside a category ---------- */
  // Highest contribution first by default — that's what a trust operator
  // scans for — with a toggle to flip it. Sorting is client-side (the list
  // is already fetched in full), so switching direction is instant.
  const catSort = { dir: 'desc' };

  /* Which page of a pooja's sevarthi ledger is showing. Reset whenever
     a different pooja is opened, or page 3 of a long yagna would carry
     over to a pooja with four sevarthi. */
  let ledgerPage = 1;
  let ledgerPoojaId = null;

  async function renderCategory(host, category) {
    const poojas = await API.poojas(category);
    paint();

    function paint() {
      const sorted = [...poojas].sort((a, b) =>
        catSort.dir === 'desc' ? b.amount - a.amount || a.name.localeCompare(b.name)
                                : a.amount - b.amount || a.name.localeCompare(b.name));

      host.innerHTML = `
        ${crumbs([{ label: 'Mahotsav', to: 'mahotsav' }, { label: CAT_LABEL[category] }])}
        <div class="flex justify-between items-center mg-page-head">
          <div>
            <h1 class="banner-title mg-page-title">${esc(CAT_LABEL[category])}</h1>
            <p class="mg-page-sub">${poojas.length} pooja${poojas.length === 1 ? '' : 's'} in this seva</p>
          </div>
          <button class="btn btn-primary mg-btn-xs" data-new-pooja>${icon('plus','ico-sm')} New</button>
        </div>

        <div class="sort-row">
          <span class="sort-label">Sort:</span>
          <button type="button" class="btn ${catSort.dir === 'desc' ? 'btn-primary' : 'btn-outline'} mg-btn-xs" data-sort="desc">Highest amount first</button>
          <button type="button" class="btn ${catSort.dir === 'asc' ? 'btn-primary' : 'btn-outline'} mg-btn-xs" data-sort="asc">Lowest amount first</button>
        </div>

        ${sorted.length ? `<div class="seva-grid">${sorted.map((p) => `
          <button class="card cat-card" data-pooja="${attr(p.id)}">
            <div class="card-body">
              <div class="seva-head">
                <span class="item-name">${esc(p.name)}</span>
                ${icon('chevron-right','ico-sm')}
              </div>
              <div class="seva-card-meta">${p.start_date
                ? esc(fmtRange(p.start_date, p.end_date)) + ' · ' + esc(p.day_count) + ' day' + (p.day_count === 1 ? '' : 's')
                : esc(TBD)}${p.amount ? ' · ' + esc(money(p.amount)) + ' per sevarthi' : ''}</div>
              <div class="seva-card-state ${p.is_full ? 'is-full' : ''}">${p.is_full
                ? 'Full · ' + esc(capacityText(p))
                : esc(p.status === 'closed' ? 'Closed' : 'Open') + ' · ' + esc(capacityText(p))}</div>
              ${progressBar(p.booked_seats, p.total_seats)}
            </div>
          </button>`).join('')}</div>`
          : UI.empty('No pooja added yet', 'Add the first one to start taking sevarthi.', 'temple')}`;

      bindCrumbs(host);
      host.querySelector('[data-new-pooja]').addEventListener('click', () => poojaForm(category));
      host.querySelectorAll('[data-sort]').forEach((b) =>
        b.addEventListener('click', () => { catSort.dir = b.getAttribute('data-sort'); paint(); }));
      host.querySelectorAll('[data-pooja]').forEach((el) =>
        el.addEventListener('click', () => navigate('mahotsav', 'pooja', el.getAttribute('data-pooja'))));
    }
  }

  /* ---------- level 3: one pooja — seating + ledger ---------- */
  async function renderPooja(host, id) {
    if (String(ledgerPoojaId) !== String(id)) { ledgerPage = 1; ledgerPoojaId = id; }
    const p = await API.pooja(id);
    const received = p.received || 0;
    const whole = p.seating_mode === 'whole';
    const ledgerPg = UI.paginate(p.ledger, ledgerPage);

    host.innerHTML = `
      ${crumbs([
        { label: 'Mahotsav', to: 'mahotsav' },
        { label: p.category_label || 'Seva', to: 'mahotsav/' + p.category },
        { label: p.name },
      ])}
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">${esc(p.name)}</h1>
          <p class="mg-page-sub">${esc(fmtRange(p.start_date, p.end_date))}${p.amount ? ' · ' + esc(money(p.amount)) + ' per sevarthi' : ''}</p>
        </div>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-outline mg-btn-xs" data-edit-pooja>${icon('edit','ico-sm')} Edit</button>
          <button class="btn btn-primary mg-btn-xs" data-add-sevarthi>${icon('plus','ico-sm')} Sevarthi</button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat">
          <div class="stat-text"><div class="stat-card-title">Registered</div>
            <div class="stat-card-value">${p.total_seats === null ? esc(num(p.booked_seats)) : esc(num(p.booked_seats) + '/' + num(p.total_seats))}</div>
            <div class="mg-muted-xs">${p.capacity_mode === 'limited'
              ? esc(num(p.seats_left)) + ' left'
              : p.capacity_mode === 'unlimited' ? 'unlimited' : 'capacity not decided'}</div></div>
          <span class="stat-ico people">${icon('user-check')}</span>
        </div>
        <div class="stat">
          <div class="stat-text"><div class="stat-card-title">Received</div>
            <div class="stat-card-value">${esc(money(received))}</div>
            <div class="mg-muted-xs">${p.target_amount ? 'of ' + esc(money(p.target_amount)) : 'no target set'}</div></div>
          <span class="stat-ico rupee">${icon('wallet')}</span>
        </div>
        <div class="stat">
          <div class="stat-text"><div class="stat-card-title">Committed</div>
            <div class="stat-card-value">${esc(money(p.committed))}</div>
            <div class="mg-muted-xs">by ${esc(num(p.ledger.filter((l) => l.status !== 'cancelled').length))} sevarthi</div></div>
          <span class="stat-ico grace">${icon('target')}</span>
        </div>
        <div class="stat">
          <div class="stat-text"><div class="stat-card-title">Outstanding</div>
            <div class="stat-card-value" style="color:var(--warning)">${esc(money(p.outstanding))}</div>
            <div class="mg-muted-xs">${p.excess > 0 ? esc(money(p.excess)) + ' given over' : 'still to collect'}</div></div>
          <span class="stat-ico due">${icon('clock')}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>${whole ? 'Patla' : 'Day-wise seating (patla)'}</h2>
          <div class="card-head-actions">
            ${p.start_date ? '<span class="small muted">tap a day to change its count</span>' : ''}
            <button class="btn btn-outline mg-btn-xs" data-set-dates>
              ${icon('calendar','ico-sm')} ${p.start_date ? 'Change dates' : 'Set dates'}</button>
          </div></div>
        <div class="card-body">
          ${p.total_seats !== null && p.amount > 0 ? `<p class="small muted" style="margin-bottom:.7rem">
            ${esc(num(p.total_seats))} patla × ${esc(money(p.amount))} = <strong>${esc(money(p.total_seats * p.amount))}</strong> at full seating
            ${p.target_amount && p.target_amount !== p.total_seats * p.amount ? ` — target is set to ${esc(money(p.target_amount))}` : ''}</p>` : ''}
          ${p.start_date ? '' : `<p class="small muted" style="margin-bottom:.7rem">
            The date for this pooja has not been fixed yet. Sevarthi can still be added now —
            set the date when the trust decides, and the bookings carry over.</p>`}
          ${whole && p.start_date ? `<p class="small muted" style="margin-bottom:.7rem">
            One sevarthi holds this patla for the whole yagna, so the count is the total —
            not a number per day.</p>` : ''}
          <div class="slot-grid">
            ${p.slots.map((s) => `
              <button class="slot ${s.is_full ? 'is-full' : ''}" data-slot="${attr(s.id)}">
                <div class="slot-date">${!s.slot_date ? 'Date TBA'
                  : whole ? esc(fmtRange(p.start_date, p.end_date)) : esc(fmtDate(s.slot_date))}</div>
                <div class="slot-count">${s.capacity === null
                  ? esc(num(s.booked_count)) + ' joined'
                  : esc(num(s.booked_count) + '/' + num(s.capacity))}${s.is_full ? ' full' : ''}</div>
              </button>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Sevarthi ledger</h2>
          <span class="small muted">in order of joining</span></div>
        <div class="card-body" style="padding:0">
          ${ledgerPg.slice.length ? ledgerPg.slice.map((l) => {
            const c = UI.coverage(l);
            /* The row carries the headline figure; the full split still
               travels with it as a tooltip so nothing is actually lost
               by not printing five lines per sevarthi. */
            const detail = [
              `Committed ${money(c.committed)}`,
              c.devotee_paid ? `Devotee paid ${money(c.devotee_paid)}` : null,
              c.bappa_paid ? `Bapa paid ${money(c.bappa_paid)}` : null,
              c.bappa_planned ? `Bapa agreed to cover ${money(c.bappa_planned)}` : null,
              c.outstanding ? `Outstanding ${money(c.outstanding)}` : null,
              c.excess ? `Excess ${money(c.excess)}` : null,
            ].filter(Boolean).join(' · ');
            return `
            <div class="ledger-item">
              <span class="ledger-avatar" aria-hidden="true">${icon('users')}</span>
              <div class="row-main">
                <div class="row-title">${esc(l.full_name)} ${UI.coverageBadges(l)}</div>
                <div class="row-sub">${esc(fmtDate(l.slot_date))}
                  ${l.samaj ? ' · ' + esc(l.samaj) : ''}${l.mobile ? ' · ' + esc(l.mobile) : ''}</div>
              </div>
              <div class="row-end ledger-row-end">
                <div class="ledger-money" title="${attr(detail)}">
                  <div class="amt">${esc(money(l.amount_paid))}</div>
                  <div class="sub ${c.outstanding > 0 && l.status !== 'cancelled' ? 'is-due' : ''}">${
                    l.status === 'cancelled' ? 'Cancelled'
                      : c.outstanding > 0 ? esc(money(c.outstanding)) + ' outstanding'
                      : c.excess > 0 ? esc(money(c.excess)) + ' over'
                      : 'Fully covered'}</div>
                </div>
                ${l.status !== 'cancelled' ? `
                <div class="row-actions">
                  ${c.outstanding > 0 ? `<button class="icon-btn" data-pay="${attr(l.booking_id)}"
                    title="Collect payment" style="color:var(--ink-soft)">${icon('rupee','ico-sm')}</button>` : ''}
                  <button class="icon-btn" data-edit-booking="${attr(l.booking_id)}"
                    title="Edit registration" style="color:var(--ink-soft)">${icon('edit','ico-sm')}</button>
                </div>` : ''}
              </div>
            </div>`;
          }).join('')
          : UI.empty('No sevarthi yet', 'Add the first sevarthi for this pooja.', 'seat')}
        </div>
        ${UI.pager(ledgerPg, 'sevarthi')}
      </div>`;

    /* A popular patla tier can carry hundreds of sevarthi, so the
       ledger pages like every other long list. The page lives on the
       module, not in the template, so paging does not refetch. */
    UI.bindPager(host, (d) => { ledgerPage = ledgerPg.page + d; renderPooja(host, id); });

    bindCrumbs(host);
    host.querySelector('[data-edit-pooja]').addEventListener('click', () => poojaForm(p.category, p));
    host.querySelector('[data-add-sevarthi]').addEventListener('click', () =>
      Forms.addSevarthi({ category: p.category, poojaId: p.id }));
    host.querySelectorAll('[data-pay]').forEach((b) =>
      b.addEventListener('click', () => Forms.paymentForm(b.getAttribute('data-pay'))));
    host.querySelectorAll('[data-edit-booking]').forEach((b) =>
      b.addEventListener('click', () => Forms.editBooking(b.getAttribute('data-edit-booking'))));
    host.querySelectorAll('[data-slot]').forEach((b) =>
      b.addEventListener('click', () => {
        const s = p.slots.find((x) => String(x.id) === b.getAttribute('data-slot'));
        slotForm(p, s);
      }));
    const setDates = host.querySelector('[data-set-dates]');
    if (setDates) setDates.addEventListener('click', () => datesForm(p));
  }

  /* ---------- fix the dates on a pooja that had none ---------- */
  function datesForm(p) {
    const dated = !!p.start_date;
    const seated = p.slots.reduce((a, s) => a + s.booked_count, 0);

    openSheet({
      title: (dated ? 'Change dates — ' : 'Set dates — ') + p.name,
      body: `
        <p class="small muted">${dated
          ? `Days move by position: the first day of the pooja becomes the first day of the new
             range, the second becomes the second, and so on${seated
               ? ` — so the ${num(seated)} sevarthi already seated travel with their day.`
               : '.'}`
          : 'Any sevarthi already booked moves to the first day.'}</p>
        <form id="datesForm" novalidate>
          <div class="form-row">
            <div class="form-group"><label class="form-label req" for="f_start_date">Start date</label>
              <input class="form-input" id="f_start_date" name="start_date" type="date"
                     value="${attr(p.start_date || '')}" required></div>
            <div class="form-group"><label class="form-label req" for="f_end_date">End date</label>
              <input class="form-input" id="f_end_date" name="end_date" type="date"
                     value="${attr(p.end_date || '')}" required></div>
          </div>
          <div class="form-hint">For a one-day pooja, use the same date in both.</div>
          ${dated && p.seating_mode !== 'whole' ? `<div class="form-hint">
            Shortening the range is refused if sevarthi are booked on the days that would be
            dropped — move them first.</div>` : ''}
        </form>
        ${dated ? `<div class="divider"></div>
          <button type="button" class="btn btn-outline btn-block" id="datesClear">
            ${icon('close','ico-sm')} Clear the dates — back to "not decided yet"</button>
          <div class="form-hint">The pooja keeps taking sevarthi; it just leaves the calendar
            until a new date is fixed.</div>` : ''}`,
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               <button class="btn btn-primary" id="datesSave">${dated ? 'Save new dates' : 'Save dates'}</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);

        const clearBtn = sheet.querySelector('#datesClear');
        if (clearBtn) clearBtn.addEventListener('click', () => {
          UI.confirmSheet({
            title: 'Clear the dates?',
            message: `${p.name} goes back to "date not decided". Sevarthi already booked are kept ` +
                     `and pooled onto one undated slot.`,
            confirmLabel: 'Clear dates',
            async onConfirm() {
              try {
                await API.put(`/poojas/${p.id}/dates/clear`);
                closeSheet(); toast('Dates cleared', 'ok'); refreshPage();
              } catch (err) { toast(err.message, 'err'); }
            },
          });
        });

        sheet.querySelector('#datesSave').addEventListener('click', async (e) => {
          const form = document.getElementById('datesForm');
          clearFieldErrors(form);
          const data = readForm(form);
          if (!data.start_date) return showFieldError(form, 'start_date', 'Pick a start date');
          if (!data.end_date) return showFieldError(form, 'end_date', 'Pick an end date');
          if (data.end_date < data.start_date) return showFieldError(form, 'end_date', 'End must be after start');
          e.currentTarget.disabled = true;
          try {
            await API.put(`/poojas/${p.id}/dates`, data);
            closeSheet(); toast(dated ? 'Dates updated' : 'Dates set', 'ok'); refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  /* ---------- edit one day's patla count ---------- */
  function slotForm(p, s) {
    // When this is the pooja's only slot, its capacity IS the pooja's
    // total seat count, so patla × amount is a real target suggestion —
    // offered, never applied automatically (the trust may have deliberately
    // set a different target).
    const singleSlot = p.slots.length === 1;

    openSheet({
      title: 'Seats for this day',
      body: `
        <form id="slotForm" novalidate>
          <div class="form-group">
            <label class="form-label" for="f_capacity">Patla count (seats)</label>
            <input class="form-input" id="f_capacity" name="capacity" type="number" min="${attr(s.booked_count)}" step="1"
                   value="${attr(s.capacity === null ? '' : s.capacity)}" inputmode="numeric" placeholder="Leave blank for open seating">
            <div class="form-hint">${esc(s.booked_count)} already booked — cannot go below that. Blank = no limit.</div>
          </div>
        </form>
        ${singleSlot && p.amount > 0 ? '<div id="capTargetHint" class="form-hint"></div>' : ''}`,
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               <button class="btn btn-primary" id="slotSave">Save</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const form = document.getElementById('slotForm');
        const hint = document.getElementById('capTargetHint');

        const paintHint = () => {
          if (!hint) return;
          const raw = form.capacity.value.trim();
          if (raw === '') { hint.innerHTML = 'No limit — patla × amount has no target to suggest.'; return; }
          const newCap = Number(raw);
          const suggested = newCap * p.amount;
          if (suggested === p.target_amount) {
            hint.innerHTML = `Matches the current target (${esc(money(suggested))}).`;
            return;
          }
          hint.innerHTML = `That's ${esc(num(newCap))} × ${esc(money(p.amount))} =
            <strong>${esc(money(suggested))}</strong>
            <button type="button" class="btn btn-outline mg-btn-xs" data-use-target style="margin-left:.4rem">Set as target</button>`;
          hint.querySelector('[data-use-target]').addEventListener('click', async () => {
            try {
              await API.put('/poojas/' + p.id, { target_amount: suggested });
              p.target_amount = suggested;
              toast('Target updated', 'ok');
              paintHint();
            } catch (err) { toast(err.message, 'err'); }
          });
        };
        if (hint) { paintHint(); form.capacity.addEventListener('input', paintHint); }

        sheet.querySelector('#slotSave').addEventListener('click', async (e) => {
          const raw = form.capacity.value.trim();
          e.currentTarget.disabled = true;
          try {
            await API.put(`/poojas/slots/${s.id}`, { capacity: raw === '' ? null : Number(raw) });
            closeSheet(); toast('Seats updated', 'ok'); refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            showFieldError(form, 'capacity', err.message);
          }
        });
      },
    });
  }

  /* ---------- create / edit a pooja ----------
     Name, description, contribution amount, target amount and status can
     always be changed. Dates and the patla/seating structure are fixed
     once the pooja exists — its slots are already built from them, and
     changing them here would leave the slots out of sync. Those are
     edited from the pooja page instead: "Set dates" (before a date is
     fixed) and tapping a day (its seat count). */
  function poojaForm(category, existing) {
    const p = existing || {};
    const editing = !!p.id;
    const noun = category === 'maha_yagna' ? 'yagna' : category === 'bhagvat_katha' ? 'katha' : 'pooja';
    /* A new pooja starts as "not decided" rather than inventing a cap of
       100: a limit the trust has not set is exactly the blocker Phase 1
       is meant to avoid. The operator picks Limited when there is a
       real number. */
    const capMode = p.capacity_mode || 'not_decided';

    openSheet({
      title: editing ? 'Edit ' + p.name : 'New ' + (CAT_LABEL[category] || 'Pooja'),
      body: `
        <form id="poojaForm" novalidate>
          <div class="form-group">
            <label class="form-label req" for="f_name">Full name of the ${noun}</label>
            <input class="form-input" id="f_name" name="name" autocomplete="off" value="${attr(p.name || '')}">
          </div>
          ${editing ? '' : `
          <div class="form-group">
            <label class="small" style="display:flex;align-items:center;gap:.45rem;font-weight:500">
              <input type="checkbox" name="dates_known" checked style="width:auto;min-height:0">
              The date is already decided
            </label>
          </div>
          <div class="field-row" id="datesFields">
            <div class="form-group"><label class="form-label req" for="f_start_date">Start date</label>
              <input class="form-input" id="f_start_date" name="start_date" type="date"></div>
            <div class="form-group"><label class="form-label req" for="f_end_date">End date</label>
              <input class="form-input" id="f_end_date" name="end_date" type="date"></div>
          </div>
          `}
          <div class="form-group">
            <label class="form-label" for="f_seating_mode">The count is</label>
            <select class="form-select" id="f_seating_mode" name="seating_mode">
              <option value="per_day" ${p.seating_mode !== 'whole' ? 'selected' : ''}>per day — people come each day</option>
              <option value="whole" ${p.seating_mode === 'whole' ? 'selected' : ''}>the total — one sevarthi holds a patla for the whole event</option>
            </select>
            ${editing ? `<div class="form-hint">Changing this rebuilds the day slots, so it is only
              possible while no sevarthi are seated.</div>` : ''}
          </div>
          <div class="form-group">
            <label class="form-label" for="f_capacity_mode">Registration capacity</label>
            <select class="form-select" id="f_capacity_mode" name="capacity_mode">
              <option value="not_decided" ${capMode === 'not_decided' ? 'selected' : ''}>Not decided yet</option>
              <option value="limited" ${capMode === 'limited' ? 'selected' : ''}>Limited — a maximum number</option>
              <option value="unlimited" ${capMode === 'unlimited' ? 'selected' : ''}>Unlimited — no cap</option>
            </select>
            <div class="form-hint">Not decided still takes sevarthi — nothing is blocked until a limit is actually set.</div>
          </div>
          <div class="form-group" id="seatsField" style="${capMode === 'limited' ? '' : 'display:none'}">
            <label class="form-label req" for="f_seats_per_day">Maximum registrations</label>
            <input class="form-input" id="f_seats_per_day" name="seats_per_day" type="number" min="1" step="1"
                   value="${attr(p.seats_per_day ?? 100)}" inputmode="numeric">
            <div class="form-hint" id="seatsHint"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_amount">Contribution per sevarthi</label>
              <input class="form-input" id="f_amount" name="amount" type="number" min="0" step="1" value="${attr(p.amount ?? 0)}" inputmode="numeric"></div>
            <div class="form-group"><label class="form-label" for="f_target_amount">Overall target</label>
              <input class="form-input" id="f_target_amount" name="target_amount" type="number" min="0" step="1" value="${attr(p.target_amount ?? 0)}" inputmode="numeric">
              <div class="form-hint" id="targetHint"></div></div>
          </div>
          ${editing ? `
          <div class="form-group">
            <label class="form-label" for="f_status">Status</label>
            <select class="form-select" id="f_status" name="status">
              <option value="open" ${p.status !== 'closed' ? 'selected' : ''}>Open — taking sevarthi</option>
              <option value="closed" ${p.status === 'closed' ? 'selected' : ''}>Closed — no new sevarthi</option>
            </select>
          </div>` : ''}
          <div class="form-group"><label class="form-label" for="f_description">Note</label>
            <textarea class="form-textarea" id="f_description" name="description" data-translate rows="2">${esc(p.description || '')}</textarea></div>
          ${editing ? `<div class="divider"></div>
            <div class="form-hint">The dates are changed with <strong>Change dates</strong> on the pooja
              page, and one day's count by tapping that day.</div>
            <button type="button" class="btn btn-outline btn-block mg-danger-ghost" id="poojaDelete">
              ${icon('trash','ico-sm')} Delete this ${noun}</button>
            <div class="form-hint">Only possible while no sevarthi are recorded against it. Otherwise
              close it instead, which keeps the history.</div>` : ''}
        </form>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               <button class="btn btn-primary" id="poojaSave">${editing ? 'Save' : 'Create'}</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const form = document.getElementById('poojaForm');

        /* The count only means something for a 'limited' pooja, and what
           it counts depends on how this pooja is seated. */
        const seatingModeOf = () => form.seating_mode.value;
        function paintSeatsField() {
          const limited = form.capacity_mode.value === 'limited';
          document.getElementById('seatsField').style.display = limited ? '' : 'none';
          document.getElementById('seatsHint').textContent = seatingModeOf() === 'whole'
            ? 'The total number of this patla for the whole event.'
            : 'The most sevarthi that can be registered for one day.';
        }
        form.capacity_mode.addEventListener('change', () => { paintSeatsField(); paintTargetHint(); });
        form.seats_per_day.addEventListener('input', paintTargetHint);
        paintSeatsField();

        form.seating_mode.addEventListener('change', () => { paintSeatsField(); paintTargetHint(); });

        const delBtn = sheet.querySelector('#poojaDelete');
        if (delBtn) delBtn.addEventListener('click', () => {
          UI.confirmSheet({
            title: 'Delete ' + p.name + '?',
            message: 'This removes the seva and its day slots. It cannot be undone.',
            confirmLabel: 'Delete',
            danger: true,
            async onConfirm() {
              await API.del('/poojas/' + p.id);
              toast('Pooja deleted', 'ok');
              navigate('mahotsav', p.category);
            },
          });
        });

        if (!editing) {
          form.dates_known.addEventListener('change', (e) => {
            document.getElementById('datesFields').style.display = e.target.checked ? '' : 'none';
            paintTargetHint();
          });
          form.start_date.addEventListener('change', paintTargetHint);
          form.end_date.addEventListener('change', paintTargetHint);
        }

        /* Patla × contribution is the natural target. In a new pooja it's
           kept in sync live until the operator types their own figure; on
           an existing one (seats aren't editable here) it's only ever
           offered — a deliberately higher (or lower) target is normal and
           never overwritten without an explicit click. Overflowing the
           target with real contributions is expected and never blocked. */
        let targetTouched = false;
        const targetHint = document.getElementById('targetHint');
        function daysCount(start, end) {
          if (!start || !end) return 1;
          const d = new Date(start + 'T00:00:00');
          const last = new Date(end + 'T00:00:00');
          let n = 0;
          while (d <= last) { n++; d.setDate(d.getDate() + 1); }
          return Math.max(1, n);
        }
        function computeSuggested() {
          const amount = Number(form.amount.value || 0);
          if (!amount) return null;
          /* Capacity is editable in both modes now, so the live figure
             always comes from the form; only the dates and the seating
             mode are fixed once the pooja exists. */
          const limited = form.capacity_mode.value === 'limited';
          const seats = Number(form.seats_per_day.value || 0);
          const mode = seatingModeOf();
          const start = editing ? p.start_date : (form.dates_known.checked ? form.start_date.value : null);
          const end = editing ? p.end_date : (form.dates_known.checked ? form.end_date.value : null);
          if (!limited || !seats) return null;
          const days = mode === 'whole' ? 1 : daysCount(start, end);
          return { seats, amount, days, total: seats * amount * days };
        }
        function paintTargetHint() {
          const s = computeSuggested();
          if (!s) { targetHint.innerHTML = ''; return; }
          if (!editing && !targetTouched) form.target_amount.value = s.total;
          const current = Number(form.target_amount.value || 0);
          const math = `${num(s.seats)} patla × ${money(s.amount)}${s.days > 1 ? ' × ' + num(s.days) + ' days' : ''}`;
          if (current === s.total) {
            targetHint.textContent = `${math} = ${money(s.total)}.`;
          } else {
            targetHint.innerHTML = `${esc(math)} = ${esc(money(s.total))} —
              <button type="button" class="btn btn-outline mg-btn-xs" data-use-target>Use this</button>`;
            targetHint.querySelector('[data-use-target]').addEventListener('click', () => {
              form.target_amount.value = s.total;
              paintTargetHint();
            });
          }
        }
        form.amount.addEventListener('input', paintTargetHint);
        form.target_amount.addEventListener('input', () => { targetTouched = true; paintTargetHint(); });
        paintTargetHint();

        sheet.querySelector('#poojaSave').addEventListener('click', async (e) => {
          clearFieldErrors(form);
          const data = readForm(form);
          if (!data.name) return showFieldError(form, 'name', 'Please enter a name');
          if (!editing) {
            if (data.dates_known) {
              if (!data.start_date) return showFieldError(form, 'start_date', 'Pick a start date');
              if (!data.end_date) return showFieldError(form, 'end_date', 'Pick an end date');
              if (data.end_date < data.start_date) return showFieldError(form, 'end_date', 'End must be after start');
            } else {
              data.start_date = null;
              data.end_date = null;
            }
          }
          if (data.capacity_mode === 'limited' && !(Number(data.seats_per_day) > 0)) {
            return showFieldError(form, 'seats_per_day', 'Enter the maximum number of registrations');
          }
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = editing ? 'Saving…' : 'Creating…';
          try {
            if (editing) await API.put('/poojas/' + p.id, data);
            else await API.post('/poojas', { ...data, category });
            closeSheet(); toast(editing ? 'Pooja updated' : 'Pooja created', 'ok'); refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            e.currentTarget.textContent = editing ? 'Save' : 'Create';
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.mahotsav = { render, poojaForm };
})(window);
