/* Payment Received — day-wise and month-wise money in. */
(function (global) {
  'use strict';
  const { esc, attr, money, num, icon, fmtDate, fmtDateLong, monthISO, todayISO,
          debounce, statusBadge, MONTHS } = UI;

  const state = { month: monthISO(), date: null, search: '' };

  async function render(host) {
    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Payment Received</h1>
          <p class="mg-page-sub">Every rupee received, day by day</p>
        </div>
        <button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} Payment</button>
      </div>

      <div class="card"><div class="card-body" style="padding:.7rem .8rem">
        <div class="cal-head" style="margin:0">
          <button class="icon-btn" data-nav="-1" aria-label="Previous month" style="color:var(--ink-soft)">
            ${icon('chevron-left','ico-sm')}</button>
          <span class="cal-month" id="payMonth"></span>
          <button class="icon-btn" data-nav="1" aria-label="Next month" style="color:var(--ink-soft)">
            ${icon('chevron-right','ico-sm')}</button>
        </div>
      </div></div>

      <div id="paySummary"></div>

      <div class="search-bar">${icon('search')}
        <input class="form-input" id="payFilter" placeholder="Filter by name, mobile, samaj, receipt…"
               value="${attr(state.search)}" autocomplete="off"></div>

      <div id="payBody">${UI.loading(3)}</div>`;

    host.querySelector('[data-add]').addEventListener('click', () => Forms.addPayment());
    host.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => {
        const [y, m] = state.month.split('-').map(Number);
        const d = new Date(y, m - 1 + Number(b.getAttribute('data-nav')), 1);
        state.month = d.toLocaleDateString('en-CA').slice(0, 7);
        state.date = null;
        load();
      }));
    host.querySelector('#payFilter').addEventListener('input',
      debounce((e) => { state.search = e.target.value.trim(); load(); }, 280));

    await load();
  }

  async function load() {
    const [y, m] = state.month.split('-').map(Number);
    document.getElementById('payMonth').textContent = `${MONTHS[m - 1]} ${y}`;

    const body = document.getElementById('payBody');
    const summary = document.getElementById('paySummary');
    body.innerHTML = UI.loading(3);

    try {
      const [byDay, list] = await Promise.all([
        API.paymentsByDay(state.month),
        API.payments({ month: state.date ? undefined : state.month, date: state.date, search: state.search }),
      ]);

      const monthTotal = byDay.reduce((a, d) => a + d.total, 0);
      const bhuvajiTotal = byDay.reduce((a, d) => a + d.bhuvaji_total, 0);

      summary.innerHTML = `
        <div class="stats-grid">
          <div class="stat"><div class="stat-card-title">This month</div>
            <div class="stat-card-value">${esc(money(monthTotal))}</div>
            <div class="mg-muted-xs">${esc(num(byDay.reduce((a, d) => a + d.entries, 0)))} entries</div></div>
          <div class="stat"><div class="stat-card-title">Bapa's share</div>
            <div class="stat-card-value">${esc(money(bhuvajiTotal))}</div>
            <div class="mg-muted-xs">of this month</div></div>
        </div>`;

      const dayList = byDay.length ? `
        <div class="card">
          <div class="card-header"><h2>Day-wise</h2>
            ${state.date ? `<button class="btn btn-outline mg-btn-xs" data-clear-day>Show whole month</button>` : ''}
          </div>
          <div class="card-body" style="padding:0"><div class="list">
            ${byDay.map((d) => `
              <button class="row-item ${state.date === d.payment_date ? 'is-active' : ''}"
                      data-day="${attr(d.payment_date)}"
                      style="${state.date === d.payment_date ? 'background:var(--ivory)' : ''}">
                <div class="row-main">
                  <div class="row-title">${esc(fmtDateLong(d.payment_date))}</div>
                  <div class="row-sub">${esc(num(d.entries))} payment${d.entries === 1 ? '' : 's'}
                    ${d.bhuvaji_total ? ' · Bapa ' + esc(money(d.bhuvaji_total)) : ''}</div>
                </div>
                <div class="row-end"><div class="row-amount">${esc(money(d.total))}</div></div>
              </button>`).join('')}
          </div></div>
        </div>` : '';

      const rows = list.payments;
      const entries = `
        <div class="card">
          <div class="card-header">
            <h2>${state.date ? esc(fmtDateLong(state.date)) : 'All entries this month'}</h2>
            <span class="badge">${esc(money(list.totals.total))}</span>
          </div>
          <div class="card-body" style="padding:0">
            ${rows.length ? `<div class="list">${rows.map((p) => `
              <div class="row-item" style="cursor:default">
                <div class="row-main">
                  <div class="row-title">${esc(p.full_name)}
                    ${p.payer_type === 'bhuvaji' ? '<span class="badge badge-gold">Bapa</span>' : ''}</div>
                  <div class="row-sub">${esc(p.pooja_name)} · ${esc(fmtDate(p.slot_date))}
                    ${p.receipt_no ? ' · #' + esc(p.receipt_no) : ''}</div>
                  <div class="row-sub">${esc(fmtDate(p.payment_date))}
                    ${p.samaj ? ' · ' + esc(p.samaj) : ''} · by ${esc(p.recorded_by || '—')}</div>
                </div>
                <div class="row-end">
                  <div class="row-amount">${esc(money(p.amount))}</div>
                  <button class="icon-btn" data-del="${attr(p.id)}" title="Remove entry"
                          style="color:var(--ink-soft)">${icon('trash','ico-sm')}</button>
                </div>
              </div>`).join('')}</div>`
            : UI.empty('No payments', state.search ? 'No match for that search.' : 'Nothing recorded for this period.', 'rupee')}
          </div>
        </div>`;

      body.innerHTML = dayList + entries;

      body.querySelectorAll('[data-day]').forEach((b) =>
        b.addEventListener('click', () => {
          const d = b.getAttribute('data-day');
          state.date = state.date === d ? null : d;
          load();
        }));
      const clear = body.querySelector('[data-clear-day]');
      if (clear) clear.addEventListener('click', () => { state.date = null; load(); });

      body.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          UI.confirmSheet({
            title: 'Remove this payment?',
            message: 'The entry will be deleted and the sevarthi status recalculated. This is recorded in the audit trail.',
            confirmLabel: 'Remove', danger: true,
            onConfirm: async () => {
              await API.del('/payments/' + b.getAttribute('data-del'));
              UI.toast('Payment entry removed', 'ok');
              load();
            },
          });
        }));
    } catch (e) {
      body.innerHTML = UI.errorState(e.message);
    }
  }

  global.Pages = global.Pages || {};
  global.Pages.payments = { render };
})(window);
