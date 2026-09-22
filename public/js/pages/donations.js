/* Donations — separate from sevarthi contributions. */
(function (global) {
  'use strict';
  const { esc, attr, money, num, icon, fmtDate, monthISO, todayISO, debounce, MONTHS,
          openSheet, closeSheet, readForm, clearFieldErrors, showFieldError, toast,
          lookupSelect, bindLookupAdders } = UI;

  /* `rows`/`totals` are kept here, not just rendered, so the export can
     take the whole fetched month rather than scraping the DOM. */
  const state = { month: monthISO(), search: '', page: 1, rows: [], totals: { total: 0, count: 0 } };

  const EXPORT_COLUMNS = [
    { key: 'date',     label: 'Date', type: 'date', value: (d) => d.donation_date || '' },
    { key: 'name',     label: 'Donor',    value: (d) => d.donor_name || '' },
    { key: 'mobile',   label: 'Mobile', nowrap: true, value: (d) => d.mobile || '' },
    { key: 'category', label: 'Category', value: (d) => d.category || '' },
    { key: 'amount',   label: 'Amount',   type: 'money', value: (d) => d.amount || 0 },
    { key: 'inkind',   label: 'In kind',  value: (d) => d.in_kind_item || '' },
    { key: 'receipt',  label: 'Receipt no.', value: (d) => d.receipt_no || '' },
    { key: 'by',       label: 'Recorded by', value: (d) => d.recorded_by || '' },
    { key: 'notes',    label: 'Note',     value: (d) => d.notes || '' },
    /* No City column: the `donations` table has none, and the list
       endpoint does not join the devotee, so it exported an always-empty
       column — a header promising something the file can never carry. */
  ];

  function exportSpec() {
    const [y, m] = state.month.split('-').map(Number);
    const monthName = `${MONTHS[m - 1]} ${y}`;
    return {
      filename: 'Donations-' + state.month,
      title: 'Donations — ' + monthName,
      subtitle: 'Shri Vihat Meldi Dham (Sanand) · offerings recorded outside the Mahotsav seva',
      columns: EXPORT_COLUMNS,
      rows: state.rows,
      meta: [
        ['Month', monthName],
        ...(state.search ? [['Search', state.search]] : []),
        ['Entries', UI.num(state.rows.length)],
        ['Total', money(state.totals.total || 0)],
        ['Taken', new Date().toLocaleString()],
      ],
      totals: {
        date: 'Total (' + UI.num(state.rows.length) + ')',
        amount: state.rows.reduce((a, d) => a + (d.amount || 0), 0),
      },
    };
  }

  async function render(host) {
    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Donation</h1>
          <p class="mg-page-sub">Offerings recorded outside the Mahotsav seva</p>
        </div>
        <div class="mg-page-actions">
          ${Export.toolbar('donExport')}
          <button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} Donation</button>
        </div>
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
    Export.bindToolbar(host, exportSpec);
    host.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', () => {
        const [y, m] = state.month.split('-').map(Number);
        const d = new Date(y, m - 1 + Number(b.getAttribute('data-nav')), 1);
        state.month = d.toLocaleDateString('en-CA').slice(0, 7);
        state.page = 1;
        load();
      }));
    host.querySelector('#donSearch').addEventListener('input',
      debounce((e) => { state.search = e.target.value.trim(); state.page = 1; load(); }, 280));
    await load();
  }

  /* Collapsed: who gave, what kind of offering, and how much — the
     three things you scan a month's donations for. Receipt number,
     in-kind item, note and who recorded it open underneath; the note in
     particular used to exist only in the export. */
  function rowFor(d) {
    const summary = `
      <div class="row-main">
        <div class="row-title">${esc(d.donor_name)}
          ${d.category ? `<span class="badge badge-gold">${esc(d.category)}</span>` : ''}
          ${d.in_kind_item ? '<span class="badge">In kind</span>' : ''}</div>
        <div class="collect-meta">
          <span>${esc(fmtDate(d.donation_date))}</span>
          ${d.mobile ? `<span class="is-phone">${icon('phone','ico-sm')} ${esc(d.mobile)}</span>` : ''}
          ${d.receipt_no ? `<span>#${esc(d.receipt_no)}</span>`
                         : '<span class="is-missing">No receipt</span>'}
        </div>
      </div>
      <div class="row-end collect-lead">
        <div class="lead-fig">
          <span class="lead-k">${d.amount ? 'Amount' : 'In kind'}</span>
          <span class="lead-v">${d.amount ? esc(money(d.amount)) : '—'}</span>
        </div>
      </div>`;

    const detail = `
      <div class="vis-detail">
        <div class="vis-line">${icon('calendar','ico-sm')}
          <span>${esc(UI.fmtDateLong(d.donation_date))}</span></div>
        ${d.in_kind_item ? `<div class="vis-line">${icon('gift','ico-sm')}
          <span>In kind: ${esc(d.in_kind_item)}</span></div>` : ''}
        <div class="vis-line">${icon('book','ico-sm')}
          <span>${d.receipt_no ? 'Receipt #' + esc(d.receipt_no)
            : '<span class="muted">No receipt number recorded</span>'}</span></div>
        ${d.notes ? `<div class="vis-line">${icon('edit','ico-sm')}
          <span>${esc(d.notes)}</span></div>` : ''}
        <div class="vis-line">${icon('clock','ico-sm')}
          <span>Recorded by ${esc(d.recorded_by || '—')}
            on ${esc(String(d.created_at || '').slice(0, 10))}</span></div>
      </div>
      <div class="more-actions">
        <button class="btn btn-outline mg-btn-xs" data-edit="${attr(d.id)}">
          ${icon('edit','ico-sm')} Edit donation</button>
        <button class="btn btn-outline mg-btn-xs btn-danger" data-del="${attr(d.id)}">
          ${icon('trash','ico-sm')} Delete</button>
      </div>`;

    return UI.expandableRow(summary, detail,
      { itemClass: 'donation-row', label: 'Receipt, note and actions' });
  }

  async function load() {
    const [y, m] = state.month.split('-').map(Number);
    document.getElementById('donMonth').textContent = `${MONTHS[m - 1]} ${y}`;
    const body = document.getElementById('donBody');
    body.innerHTML = UI.loading(3);
    try {
      const { donations, totals } = await API.donations({ month: state.month, search: state.search });
      state.rows = donations; state.totals = totals;

      /* An in-kind offering has no money against it, so a total alone
         under-reports the month. Count the two kinds separately, and
         surface entries recorded without a receipt — that is the thing
         an accountant comes to this page to find. */
      const t = donations.reduce((a, d) => {
        if (d.in_kind_item) a.inKind++;
        if (d.amount > 0) a.cash++;
        if (!d.receipt_no) a.noReceipt++;
        if ((d.amount || 0) > (a.largest.amount || 0)) a.largest = d;
        return a;
      }, { inKind: 0, cash: 0, noReceipt: 0, largest: { amount: 0 } });

      body.innerHTML = `
        <div class="stats-grid">
          <div class="stat"><div class="stat-text">
            <div class="stat-card-title">This month</div>
            <div class="stat-card-value">${esc(money(totals.total))}</div>
            <div class="mg-muted-xs">${esc(num(t.cash))} cash offering${t.cash === 1 ? '' : 's'}</div></div>
            <span class="stat-ico rupee">${icon('rupee')}</span></div>
          <div class="stat"><div class="stat-text">
            <div class="stat-card-title">Entries</div>
            <div class="stat-card-value">${esc(num(totals.count))}</div>
            <div class="mg-muted-xs">${t.inKind ? esc(num(t.inKind)) + ' in kind' : 'all in cash'}</div></div>
            <span class="stat-ico grace">${icon('gift')}</span></div>
          <div class="stat"><div class="stat-text">
            <div class="stat-card-title">Largest</div>
            <div class="stat-card-value">${esc(money(t.largest.amount || 0))}</div>
            <div class="mg-muted-xs">${t.largest.donor_name ? esc(t.largest.donor_name) : 'nothing yet'}</div></div>
            <span class="stat-ico people">${icon('trending-up')}</span></div>
          <div class="stat"><div class="stat-text">
            <div class="stat-card-title">No receipt</div>
            <div class="stat-card-value" ${t.noReceipt ? 'style="color:var(--warning)"' : ''}>${esc(num(t.noReceipt))}</div>
            <div class="mg-muted-xs">of ${esc(num(totals.count))} entries</div></div>
            <span class="stat-ico due">${icon('book')}</span></div>
        </div>`;

      if (!donations.length) {
        body.insertAdjacentHTML('beforeend', UI.empty('No donations',
          state.search ? 'Nothing matches that search this month.'
                       : 'Nothing recorded for this month.', 'gift'));
        return;
      }

      const pg = UI.paginate(donations, state.page);
      state.page = pg.page;

      body.insertAdjacentHTML('beforeend', `
        <div class="card">
          <div class="card-header"><h2>${esc(num(donations.length))} donation${donations.length === 1 ? '' : 's'}</h2>
            <span class="small muted">${esc(MONTHS[m - 1])} ${esc(String(y))}</span></div>
          <div class="card-body" style="padding:0"><div class="list">
            ${pg.slice.map(rowFor).join('')}
          </div></div>
          ${UI.pager(pg, 'donations')}
        </div>`);

      UI.bindExpanders(body);
      UI.bindPager(body, (delta) => { state.page = pg.page + delta; load(); });

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
          ${/* A walk-in donation is three answers — who, how much, what
                for. Mobile, city, in-kind and receipt are things the
                trust records when it has them, and at a busy counter it
                usually does not. They stay one line away rather than
                standing between the donor and the entry. */''}
          <div class="form-row">
            <div class="form-group"><label class="form-label req" for="f_donor_name">Donor Name</label>
              <input class="form-input" id="f_donor_name" name="donor_name" autocomplete="name"
                     enterkeyhint="next" value="${attr(d.donor_name || '')}" required></div>
            <div class="form-group"><label class="form-label" for="f_amount">Amount</label>
              <input class="form-input" id="f_amount" name="amount" type="number" min="0" step="1"
                     inputmode="numeric" enterkeyhint="next" value="${attr(d.amount ?? '')}"></div>
          </div>
          <div class="form-row">
            ${catField}
            <div class="form-group"><label class="form-label" for="f_donation_date">Date</label>
              <input class="form-input" id="f_donation_date" name="donation_date" type="date"
                     value="${attr(d.donation_date || todayISO())}"></div>
          </div>
          ${UI.moreFields('Donor contact', `
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_mobile">Mobile</label>
                <input class="form-input" id="f_mobile" name="mobile" inputmode="tel" autocomplete="tel" value="${attr(d.mobile || '')}"></div>
              <div class="form-group"><label class="form-label" for="f_city">City</label>
                <input class="form-input" id="f_city" name="city" autocomplete="address-level2" value="${attr(d.city || '')}"></div>
            </div>`,
            { open: !!(d.mobile || d.city), count: 'optional' })}
          ${UI.moreFields('In-kind, receipt & note', `
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_in_kind_item">In-kind item</label>
                <input class="form-input" id="f_in_kind_item" name="in_kind_item"
                       placeholder="If given as goods instead of cash" value="${attr(d.in_kind_item || '')}"></div>
              <div class="form-group"><label class="form-label" for="f_receipt_no">Receipt No.</label>
                <input class="form-input" id="f_receipt_no" name="receipt_no" value="${attr(d.receipt_no || '')}"></div>
            </div>
            <div class="form-group"><label class="form-label" for="f_notes">Note</label>
              <input class="form-input" id="f_notes" name="notes" data-translate value="${attr(d.notes || '')}"></div>`,
            { open: !!(d.in_kind_item || d.receipt_no || d.notes), count: 'optional' })}
          ${editing ? '' : `
          <label class="small" style="display:flex;align-items:center;gap:.45rem;font-weight:500;margin-bottom:.6rem">
            <input type="checkbox" name="save_as_devotee" checked style="width:auto;min-height:0">
            Also add this donor to the devotee register</label>`}
        </form>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               <button class="btn btn-primary" id="donSave">${editing ? 'Save changes' : 'Add Donation'}</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const form = document.getElementById('donForm');
        bindLookupAdders(form); UI.bindTranslate(form);
        UI.bindEnterFlow(form, () => sheet.querySelector('#donSave').click());
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
