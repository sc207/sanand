/* Devotee register + 360° profile. */
(function (global) {
  'use strict';
  const { esc, attr, money, num, icon, fmtDate, debounce, statusBadge,
          openSheet, closeSheet, readForm, clearFieldErrors, showFieldError,
          toast, lookupSelect, bindLookupAdders } = UI;

  const state = { search: '' };

  async function render(host) {
    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Devotee</h1>
          <p class="mg-page-sub">The temple's permanent register</p>
        </div>
        <button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} Devotee</button>
      </div>
      <div class="search-bar">${icon('search')}
        <input class="form-input" id="devSearch" placeholder="Search name, mobile, city, samaj, category"
               value="${attr(state.search)}" autocomplete="off"></div>
      <div id="devBody">${UI.loading(4)}</div>`;

    host.querySelector('[data-add]').addEventListener('click', () => openForm());
    host.querySelector('#devSearch').addEventListener('input',
      debounce((e) => { state.search = e.target.value.trim(); load(); }, 280));
    await load();
  }

  async function load() {
    const body = document.getElementById('devBody');
    body.innerHTML = UI.loading(3);
    try {
      const rows = await API.devotees({ search: state.search });
      if (!rows.length) {
        body.innerHTML = UI.empty(
          state.search ? 'No devotee found' : 'Register is empty',
          state.search ? 'Try another name or number.' : 'Add the first devotee to begin.', 'users');
        return;
      }
      body.innerHTML = `
        <div class="card"><div class="card-header">
          <h2>${esc(num(rows.length))} devotee${rows.length === 1 ? '' : 's'}</h2></div>
          <div class="card-body" style="padding:0"><div class="list">
          ${rows.map((d) => `
            <button class="row-item" data-dev="${attr(d.id)}">
              <div class="row-main">
                <div class="row-title">${esc(d.full_name)}
                  ${d.category ? `<span class="badge">${esc(d.category)}</span>` : ''}</div>
                <div class="row-sub">${[d.mobile, d.city, d.samaj].filter(Boolean).map(esc).join(' · ') || '—'}</div>
              </div>
              <div class="row-end">
                ${d.booking_count ? `<div class="small muted">${esc(num(d.booking_count))} seva</div>` : ''}
                ${d.total_paid ? `<div class="row-amount">${esc(money(d.total_paid))}</div>` : ''}
              </div>
            </button>`).join('')}
          </div></div>
        </div>`;
      body.querySelectorAll('[data-dev]').forEach((b) =>
        b.addEventListener('click', () => openProfile(b.getAttribute('data-dev'))));
    } catch (e) {
      body.innerHTML = UI.errorState(e.message);
    }
  }

  /* ---------- 360° profile ---------- */
  async function openProfile(id) {
    const d = await API.devotee(id);
    const totalCommitted = d.bookings.filter((b) => b.status !== 'cancelled')
      .reduce((a, b) => a + b.amount_committed, 0);

    openSheet({
      title: d.full_name,
      body: `
        <div class="card" style="margin-bottom:.8rem"><div class="card-body">
          <div class="row-sub">${[d.mobile, d.city, d.state].filter(Boolean).map(esc).join(' · ') || '—'}</div>
          <div class="row-sub">${d.mul_vatan ? 'Mul vatan: ' + esc(d.mul_vatan) : ''}</div>
          <div style="margin-top:.4rem;display:flex;gap:.35rem;flex-wrap:wrap">
            ${d.samaj ? `<span class="badge badge-maroon">${esc(d.samaj)}</span>` : ''}
            ${d.category ? `<span class="badge badge-gold">${esc(d.category)}</span>` : ''}
          </div>
        </div></div>

        <div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">
          <div class="stat"><div class="stat-card-title">Contributed</div>
            <div class="stat-card-value">${esc(money(d.total_paid))}</div>
            <div class="mg-muted-xs">of ${esc(money(totalCommitted))} committed</div></div>
          <div class="stat"><div class="stat-card-title">Seva</div>
            <div class="stat-card-value">${esc(num(d.booking_count))}</div>
            <div class="mg-muted-xs">bookings</div></div>
        </div>

        <div class="section-title">Sevarthi bookings</div>
        ${d.bookings.length ? `<div class="card"><div class="card-body" style="padding:0"><div class="list">
          ${d.bookings.map((b) => `
            <div class="row-item" style="cursor:default">
              <div class="row-main">
                <div class="row-title">${esc(b.pooja_name)} ${statusBadge(b.status)}</div>
                <div class="row-sub">${esc(fmtDate(b.slot_date))}</div>
              </div>
              <div class="row-end">
                <div class="row-amount">${esc(money(b.amount_paid))}</div>
                <div class="small muted">of ${esc(money(b.amount_committed))}</div>
              </div>
            </div>`).join('')}
        </div></div></div>` : `<p class="small muted">No seva booked yet.</p>`}

        ${d.donations.length ? `<div class="section-title">Donations</div>
          <div class="card"><div class="card-body" style="padding:0"><div class="list">
          ${d.donations.map((x) => `
            <div class="row-item" style="cursor:default">
              <div class="row-main"><div class="row-title">${esc(x.category || 'Donation')}</div>
                <div class="row-sub">${esc(fmtDate(x.donation_date))}</div></div>
              <div class="row-end"><div class="row-amount">${esc(money(x.amount))}</div></div>
            </div>`).join('')}
        </div></div></div>` : ''}`,
      footer: `
        <button class="btn btn-outline" data-edit>Edit</button>
        <button class="btn btn-primary" data-seva>Add Seva</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-edit]').addEventListener('click', () => openForm(d));
        sheet.querySelector('[data-seva]').addEventListener('click', () => { closeSheet(); Forms.addSevarthi(); });
      },
    });
  }

  /* ---------- add / edit form ---------- */
  async function openForm(existing) {
    const d = existing || {};
    const [samajField, catField] = await Promise.all([
      lookupSelect('samaj', 'samaj_id', d.samaj_id, 'Samaj'),
      lookupSelect('devotee_category', 'category_id', d.category_id, 'Devotee Category'),
    ]);

    openSheet({
      title: d.id ? 'Edit Devotee' : 'Add Devotee',
      body: `
        <form id="devForm" novalidate>
          <div class="form-group"><label class="form-label req" for="f_full_name">Full Name</label>
            <input class="form-input" id="f_full_name" name="full_name" value="${attr(d.full_name || '')}" autocomplete="name"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_mobile">Mobile No.</label>
              <input class="form-input" id="f_mobile" name="mobile" value="${attr(d.mobile || '')}" inputmode="tel"></div>
            <div class="form-group"><label class="form-label" for="f_city">City</label>
              <input class="form-input" id="f_city" name="city" value="${attr(d.city || '')}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_state">State</label>
              <input class="form-input" id="f_state" name="state" value="${attr(d.state || 'Gujarat')}"></div>
            <div class="form-group"><label class="form-label" for="f_mul_vatan">Mul Vatan</label>
              <input class="form-input" id="f_mul_vatan" name="mul_vatan" value="${attr(d.mul_vatan || '')}"></div>
          </div>
          ${samajField}
          ${catField}
          <div class="form-group"><label class="form-label" for="f_notes">Note</label>
            <input class="form-input" id="f_notes" name="notes" data-translate value="${attr(d.notes || '')}"></div>
        </form>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               <button class="btn btn-primary" id="devSave">${d.id ? 'Save' : 'Add Devotee'}</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const form = document.getElementById('devForm');
        bindLookupAdders(form); UI.bindTranslate(form);
        sheet.querySelector('#devSave').addEventListener('click', async (e) => {
          clearFieldErrors(form);
          const data = readForm(form);
          if (!data.full_name) return showFieldError(form, 'full_name', 'Please enter the name');
          e.currentTarget.disabled = true;
          try {
            if (d.id) await API.put('/devotees/' + d.id, data);
            else await API.post('/devotees', data);
            closeSheet();
            toast(d.id ? 'Devotee updated' : 'Devotee added', 'ok');
            refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.devotees = { render, openForm, openProfile };
})(window);
