/* Bappa / Bhuvaji Padhramni — home and shop visits.
   The person visited and the escort both go through the devotee
   register (search existing, or add new inline) rather than free text. */
(function (global) {
  'use strict';
  const { esc, attr, icon, fmtDate, fmtDateLong, debounce, statusBadge, todayISO,
          openSheet, closeSheet, readForm, clearFieldErrors, showFieldError, toast,
          devoteeField, devoteeMultiField, bindDevotees, multiIds } = UI;

  const state = { search: '', filter: 'upcoming' };
  const STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'];

  async function render(host) {
    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Bappa / Bhuvaji Padhramni</h1>
          <p class="mg-page-sub">Visits to devotees' homes and shops</p>
        </div>
        <button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} Visit</button>
      </div>
      <div class="btn-row" style="margin-bottom:.7rem">
        ${['upcoming', 'all', 'requested', 'confirmed', 'completed'].map((f) => `
          <button class="btn btn-sm ${state.filter === f ? '' : 'btn-outline'}" data-filter="${attr(f)}">
            ${esc(f.charAt(0).toUpperCase() + f.slice(1))}</button>`).join('')}
      </div>
      <div class="search-bar">${icon('search')}
        <input class="form-input" id="visSearch" placeholder="Search name, mobile, city" value="${attr(state.search)}" autocomplete="off"></div>
      <div id="visBody">${UI.loading(3)}</div>`;

    host.querySelector('[data-add]').addEventListener('click', () => openForm());
    host.querySelectorAll('[data-filter]').forEach((b) =>
      b.addEventListener('click', () => { state.filter = b.getAttribute('data-filter'); render(host); }));
    host.querySelector('#visSearch').addEventListener('input',
      debounce((e) => { state.search = e.target.value.trim(); load(); }, 280));
    await load();
  }

  async function load() {
    const body = document.getElementById('visBody');
    body.innerHTML = UI.loading(3);
    try {
      const params = { search: state.search };
      if (state.filter === 'upcoming') params.upcoming = '1';
      else if (state.filter !== 'all') params.status = state.filter;

      const rows = await API.visits(params);
      if (!rows.length) {
        body.innerHTML = UI.empty('No padhramni', 'Add one to get started.', 'temple');
        return;
      }
      body.innerHTML = `<div class="card"><div class="card-body" style="padding:0"><div class="list">
        ${rows.map((v) => `
          <button class="row-item" data-visit="${attr(v.id)}">
            <div class="row-main">
              <div class="row-title">${esc(v.devotee_name)} ${statusBadge(v.status)}</div>
              <div class="row-sub">${esc(fmtDateLong(v.visit_date))}${v.visit_time ? ' · ' + esc(v.visit_time) : ''}
                ${v.city ? ' · ' + esc(v.city) : ''}</div>
              ${v.purpose ? `<div class="row-sub">${esc(v.purpose)}</div>` : ''}
              ${v.escorts && v.escorts.length ? `<div class="row-sub">Escort: ${v.escorts.map((e) => esc(e.full_name)).join(', ')}</div>` : ''}
            </div>
            ${icon('chevron-right','ico-sm')}
          </button>`).join('')}
      </div></div></div>`;

      body.querySelectorAll('[data-visit]').forEach((b) =>
        b.addEventListener('click', async () => {
          const full = await API.get('/visits/' + b.getAttribute('data-visit'));
          openForm(full);
        }));
    } catch (e) {
      body.innerHTML = UI.errorState(e.message);
    }
  }

  function openForm(existing) {
    const v = existing || {};
    const mainDevotee = v.devotee_id ? { id: v.devotee_id, full_name: v.devotee_name } : null;

    openSheet({
      title: v.id ? 'Padhramni' : 'Add Padhramni',
      body: `
        <form id="visForm" novalidate>
          ${devoteeField('visitor', 'Devotee Being Visited', mainDevotee)}
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_mobile">Mobile</label>
              <input class="form-input" id="f_mobile" name="mobile" value="${attr(v.mobile || '')}" inputmode="tel"></div>
            <div class="form-group"><label class="form-label" for="f_city">City</label>
              <input class="form-input" id="f_city" name="city" value="${attr(v.city || '')}"></div>
          </div>
          <div class="form-group"><label class="form-label" for="f_address">Address</label>
            <textarea class="form-textarea" id="f_address" name="address" data-translate rows="2">${esc(v.address || '')}</textarea></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label req" for="f_visit_date">Date</label>
              <input class="form-input" id="f_visit_date" name="visit_date" type="date" value="${attr(v.visit_date || todayISO())}"></div>
            <div class="form-group"><label class="form-label" for="f_visit_time">Time</label>
              <input class="form-input" id="f_visit_time" name="visit_time" type="time" value="${attr(v.visit_time || '')}"></div>
          </div>
          <div class="form-group"><label class="form-label" for="f_purpose">Purpose</label>
            <input class="form-input" id="f_purpose" name="purpose" data-translate value="${attr(v.purpose || '')}" placeholder="Griha shanti, new shop, …"></div>
          <div class="form-group"><label class="form-label" for="f_status">Status</label>
            <select class="form-select" id="f_status" name="status">
              ${STATUSES.map((s) => `<option value="${attr(s)}"${(v.status || 'requested') === s ? ' selected' : ''}>
                ${esc(s.charAt(0).toUpperCase() + s.slice(1))}</option>`).join('')}
            </select></div>
          ${devoteeMultiField('escort', 'Escort — devotees leading this visit', v.escorts || [])}
          <div class="form-group"><label class="form-label" for="f_notes">Note</label>
            <input class="form-input" id="f_notes" name="notes" data-translate value="${attr(v.notes || '')}"></div>
        </form>`,
      footer: `
        ${v.id ? '<button class="btn btn-outline btn-danger" data-del style="color:#fff;background:var(--danger);border:0">Delete</button>' : ''}
        <button class="btn btn-outline" data-sheet-close>Cancel</button>
        <button class="btn btn-primary" id="visSave">${v.id ? 'Save' : 'Add'}</button>`,
      onMount(sheet) {
        bindDevotees(sheet);
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        const del = sheet.querySelector('[data-del]');
        if (del) del.addEventListener('click', () => {
          UI.confirmSheet({
            title: 'Delete this padhramni?', message: 'This cannot be undone.',
            confirmLabel: 'Delete', danger: true,
            onConfirm: async () => { await API.del('/visits/' + v.id); toast('Deleted', 'ok'); refreshPage(); },
          });
        });
        sheet.querySelector('#visSave').addEventListener('click', async (e) => {
          const form = document.getElementById('visForm');
          clearFieldErrors(form);
          const data = readForm(form);
          const devoteeId = form.querySelector('[name="visitor_id"]').value || null;
          data.devotee_id = devoteeId;
          data.devotee_name = form.querySelector('#f_visitor_q').value.trim();
          data.escort_ids = multiIds(form, 'escort');
          delete data.visitor_id; delete data['escort[]'];

          if (!devoteeId && !data.devotee_name) return showFieldError(form, 'visitor_id', 'Search or add the devotee');
          if (!data.visit_date) return showFieldError(form, 'visit_date', 'Pick a date');

          e.currentTarget.disabled = true;
          try {
            if (v.id) await API.put('/visits/' + v.id, data);
            else await API.post('/visits', data);
            closeSheet(); toast(v.id ? 'Updated' : 'Padhramni added', 'ok'); refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.visits = { render, openForm };
})(window);
