/* Donations — separate from sevarthi contributions. */
(function (global) {
  'use strict';
  const { esc, attr, money, num, icon, fmtDate, monthISO, todayISO, debounce, MONTHS,
          openSheet, closeSheet, readForm, clearFieldErrors, showFieldError, toast,
          lookupSelect, bindLookupAdders } = UI;

  const state = { month: monthISO(), search: '' };

  async function render(host) {
    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Donation</h1>
          <p class="mg-page-sub">Offerings recorded outside the Mahotsav seva</p>
        </div>
        <button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} Donation</button>
      </div>
      <div class="card"><div class="card-body" style="padding:.7rem .8rem">
        <div class="cal-head" style="margin:0">
          <button class="icon-btn" data-nav="-1" aria-label="Previous month" style="color:var(--ink-soft)">
            ${icon('chevron-left','ico-sm')}</button>
          <span class="cal-month" id="donMonth"></span>
          <button class="icon-btn" data-nav="1" aria-label="Next month" style="color:var(--ink-soft)">
            ${icon('chevron-right','ico-sm')}</button>
        </div>
      </div></div>
      <div class="search-bar">${icon('search')}
        <input class="form-input" id="donSearch" placeholder="Search donor, mobile, category, receipt"
               value="${attr(state.search)}" autocomplete="off"></div>
      <div id="donBody">${UI.loading(3)}</div>`;

    host.querySelector('[data-add]').addEventListener('click', () => openForm());
    host.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => {
        const [y, m] = state.month.split('-').map(Number);
        const d = new Date(y, m - 1 + Number(b.getAttribute('data-nav')), 1);
        state.month = d.toLocaleDateString('en-CA').slice(0, 7);
        load();
      }));
    host.querySelector('#donSearch').addEventListener('input',
      debounce((e) => { state.search = e.target.value.trim(); load(); }, 280));
    await load();
  }

  async function load() {
    const [y, m] = state.month.split('-').map(Number);
    document.getElementById('donMonth').textContent = `${MONTHS[m - 1]} ${y}`;
    const body = document.getElementById('donBody');
    body.innerHTML = UI.loading(3);
    try {
      const { donations, totals } = await API.donations({ month: state.month, search: state.search });
      body.innerHTML = `
        <div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">
          <div class="stat"><div class="stat-card-title">This month</div>
            <div class="stat-card-value">${esc(money(totals.total))}</div>
            <div class="mg-muted-xs">${esc(num(totals.count))} entries</div></div>
        </div>
        <div class="card"><div class="card-body" style="padding:0">
          ${donations.length ? `<div class="list">${donations.map((d) => `
            <div class="row-item" style="cursor:default">
              <div class="row-main">
                <div class="row-title">${esc(d.donor_name)}
                  ${d.category ? `<span class="badge">${esc(d.category)}</span>` : ''}</div>
                <div class="row-sub">${esc(fmtDate(d.donation_date))}
                  ${d.mobile ? ' · ' + esc(d.mobile) : ''}
                  ${d.receipt_no ? ' · #' + esc(d.receipt_no) : ''}</div>
                ${d.in_kind_item ? `<div class="row-sub">In kind: ${esc(d.in_kind_item)}</div>` : ''}
              </div>
              <div class="row-end">
                <div class="row-amount">${d.amount ? esc(money(d.amount)) : '—'}</div>
                <div class="row-actions">
                  <button class="icon-btn" data-edit="${attr(d.id)}" title="Edit"
                          style="color:var(--ink-soft)">${icon('edit','ico-sm')}</button>
                  <button class="icon-btn" data-del="${attr(d.id)}" title="Delete"
                          style="color:var(--ink-soft)">${icon('trash','ico-sm')}</button>
                </div>
              </div>
            </div>`).join('')}</div>`
            : UI.empty('No donations', 'Nothing recorded for this month.', 'gift')}
        </div></div>`;

      body.querySelectorAll('[data-edit]').forEach((b) =>
        b.addEventListener('click', () => {
          const row = donations.find((x) => String(x.id) === b.getAttribute('data-edit'));
          openForm(row);
        }));

      body.querySelectorAll('[data-del]').forEach((b) =>
        b.addEventListener('click', () => {
          UI.confirmSheet({
            title: 'Delete this donation?', message: 'This cannot be undone.',
            confirmLabel: 'Delete', danger: true,
            onConfirm: async () => {
              await API.del('/donations/' + b.getAttribute('data-del'));
              toast('Deleted', 'ok'); load();
            },
          });
        }));
    } catch (e) {
      body.innerHTML = UI.errorState(e.message);
    }
  }

  async function openForm(existing) {
    const d = existing || {};
    const editing = !!d.id;
    const catField = await lookupSelect('donation_category', 'category_id', d.category_id || null, 'Donation Category');

    openSheet({
      title: editing ? 'Edit Donation' : 'Add Donation',
      body: `
        <form id="donForm" novalidate>
          <div class="form-group"><label class="form-label req" for="f_donor_name">Donor Name</label>
            <input class="form-input" id="f_donor_name" name="donor_name" autocomplete="name"
                   value="${attr(d.donor_name || '')}" required></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_mobile">Mobile</label>
              <input class="form-input" id="f_mobile" name="mobile" inputmode="tel" value="${attr(d.mobile || '')}"></div>
            <div class="form-group"><label class="form-label" for="f_city">City</label>
              <input class="form-input" id="f_city" name="city" value="${attr(d.city || '')}"></div>
          </div>
          ${catField}
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_amount">Amount</label>
              <input class="form-input" id="f_amount" name="amount" type="number" min="0" step="1"
                     inputmode="numeric" value="${attr(d.amount ?? '')}"></div>
            <div class="form-group"><label class="form-label" for="f_donation_date">Date</label>
              <input class="form-input" id="f_donation_date" name="donation_date" type="date"
                     value="${attr(d.donation_date || todayISO())}"></div>
          </div>
          <div class="form-group"><label class="form-label" for="f_in_kind_item">In-kind item</label>
            <input class="form-input" id="f_in_kind_item" name="in_kind_item"
                   placeholder="If given as goods instead of cash" value="${attr(d.in_kind_item || '')}"></div>
          <div class="form-group"><label class="form-label" for="f_receipt_no">Receipt No.</label>
            <input class="form-input" id="f_receipt_no" name="receipt_no" value="${attr(d.receipt_no || '')}"></div>
          ${editing ? '' : `
          <label class="small" style="display:flex;align-items:center;gap:.45rem;font-weight:500;margin-bottom:.6rem">
            <input type="checkbox" name="save_as_devotee" checked style="width:auto;min-height:0">
            Also add this donor to the devotee register</label>`}
          <div class="form-group"><label class="form-label" for="f_notes">Note</label>
            <input class="form-input" id="f_notes" name="notes" data-translate value="${attr(d.notes || '')}"></div>
        </form>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               <button class="btn btn-primary" id="donSave">${editing ? 'Save changes' : 'Add Donation'}</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const form = document.getElementById('donForm');
        bindLookupAdders(form); UI.bindTranslate(form);
        sheet.querySelector('#donSave').addEventListener('click', async (e) => {
          clearFieldErrors(form);
          const data = readForm(form);
          if (!data.donor_name) return showFieldError(form, 'donor_name', 'Please enter the donor name');
          if (!data.amount && !data.in_kind_item) {
            return showFieldError(form, 'amount', 'Enter an amount or an in-kind item');
          }
          e.currentTarget.disabled = true;
          try {
            if (editing) await API.put('/donations/' + d.id, data);
            else await API.post('/donations', data);
            closeSheet(); toast(editing ? 'Donation updated' : 'Donation recorded', 'ok'); refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.donations = { render, openForm };
})(window);
