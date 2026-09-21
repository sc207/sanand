/* ============================================================
   BAPPA / BHUVAJI VISITS
   ------------------------------------------------------------
   A "padhramani" — the deity's murti (or the Bhuvaji, the
   temple's oracle/medium who channels Maa) visits a devotee's
   new home, shop or a family function to bless it. Each visit
   needs a date/time, the full address, and an ESCORT — either
   a Management TEAM (the volunteers who carry the palki/murti,
   manage the aarti thali, crowd and the return journey safely)
   OR one-or-more individual Devotees picked from the central
   registry, never both (escortMode 'team' | 'individual'; see
   server/routes/visits.js for the visit_escort_devotees roster).
   Single-file module, renders into #visitsRoot, uses the
   generic openSheet() for its add/edit form.
   ============================================================ */

if (typeof window !== 'undefined' && typeof window.t !== 'function') {
  window.t = function (k, f) { return f != null ? f : k; };
  window.onLanguageChange = function () {};
}

const VISITS = {
  today: (typeof mgRealDate === 'function') ? mgRealDate() : '2026-09-06',
  filterStatus: 'all',
  search: '',
  editingId: null,

  purposes: ['home_inauguration', 'shop_opening', 'wedding_blessing', 'health_blessing', 'business_puja', 'festival_padhramani', 'other'],
  teams: [],

  list: []
};

function visToday() { return (typeof MG !== 'undefined' && MG.today) ? MG.today : VISITS.today; }
function visToast(m) { if (typeof showToast === 'function') showToast(m); }
const visitById = id => VISITS.list.find(v => v.id === id);

function visitPurposeLabel(p) { return window.t('vis_p_' + p, (p || '').replace(/_/g, ' ')); }
function visitStatusLabel(s) { return window.t('vis_s_' + s, (s || '').charAt(0).toUpperCase() + (s || '').slice(1)); }
const VIS_STATUS_BADGE = { requested:'badge-pending', scheduled:'badge-pending', confirmed:'badge-confirmed', completed:'badge-maroon', cancelled:'badge-cancelled' };

function renderVisits() {
  const root = document.getElementById('visitsRoot');
  if (!root) return;
  const q = (VISITS.search || '').toLowerCase();
  const list = VISITS.list.filter(v => {
    if (VISITS.filterStatus !== 'all' && v.status !== VISITS.filterStatus) return false;
    if (q && [v.devoteeName, v.mobile, v.address, v.city, visitPurposeLabel(v.purpose)].join(' ').toLowerCase().indexOf(q) === -1) return false;
    return true;
  }).slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  const nowKey = visToday();
  const upcoming = VISITS.list.filter(v => v.date >= nowKey && v.status !== 'cancelled' && v.status !== 'completed').length;
  const pending = VISITS.list.filter(v => v.status === 'requested').length;

  root.innerHTML = `
  <div class="flex justify-between items-center mg-page-head">
    <div>
      <h1 class="banner-title mg-page-title">🙏 ${window.t('vis_title', 'Bappa / Bhuvaji Visits')}</h1>
      <p class="mg-page-sub">${window.t('vis_sub', 'Padhramani to homes, shops and family functions — with an escort team')}</p>
    </div>
    <button class="btn btn-primary" onclick="openAddVisit()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      ${window.t('vis_add', 'Add Visit')}
    </button>
  </div>

  <div class="stats-grid">
    ${kpiCard(window.t('vis_kpi_total', 'Total Visits'), VISITS.list.length, '', '🙏')}
    ${kpiCard(window.t('vis_kpi_upcoming', 'Upcoming'), upcoming, window.t('vis_kpi_upcoming_meta', 'Scheduled / confirmed'), '📅')}
    ${kpiCard(window.t('vis_kpi_pending', 'Awaiting Approval'), pending, window.t('vis_kpi_pending_meta', 'New requests'), '⏳')}
    ${kpiCard(window.t('vis_kpi_teams', 'Escort Teams'), VISITS.teams.length, window.t('vis_kpi_teams_meta', 'On the roster'), '👷')}
  </div>

  <div class="card mg-mt">
    <div class="card-header flex justify-between items-center" style="flex-wrap:wrap; gap:0.5rem;">
      <div class="card-title">${window.t('vis_register', 'Visit Register')}</div>
      <div class="flex gap-2" style="flex-wrap:wrap;">
        ${typeof exportBar === 'function' ? exportBar('mod-visits') : ''}
        <select class="form-select mg-inline-select" onchange="VISITS.filterStatus=this.value; renderVisits()">
          <option value="all" ${VISITS.filterStatus === 'all' ? 'selected' : ''}>${window.t('all')} ${window.t('status')}</option>
          ${['requested', 'scheduled', 'confirmed', 'completed', 'cancelled'].map(s => `<option value="${s}" ${VISITS.filterStatus === s ? 'selected' : ''}>${esc(visitStatusLabel(s))}</option>`).join('')}
        </select>
        <input class="form-input mg-inline-search" placeholder="${window.t('search')}…" value="${esc(VISITS.search)}" oninput="VISITS.search=this.value; renderVisits()">
      </div>
    </div>
    <div class="card-body" style="padding:0;">
      <div class="mg-table-scroll">
        <table class="custom-table" style="min-width:900px;">
          <thead><tr>
            <th>${window.t('vis_devotee', 'Devotee')}</th><th>${window.t('vis_purpose', 'Purpose')}</th>
            <th>${window.t('vis_address', 'Address')}</th><th>${window.t('vis_datetime', 'Date & Time')}</th>
            <th>${window.t('vis_escort', 'Escort')}</th><th>${window.t('status')}</th><th>${window.t('actions')}</th>
          </tr></thead>
          <tbody>${list.length ? list.map(v => `
            <tr>
              <td><strong>${esc(v.devoteeName)}</strong>${v.mobile ? `<div class="mg-muted-xs">${esc(v.mobile)}</div>` : ''}</td>
              <td><span class="badge badge-maroon">${esc(visitPurposeLabel(v.purpose))}</span></td>
              <td>${esc(v.address || '')}${v.city ? `<div class="mg-muted-xs">${esc(v.city)}${v.state ? ', ' + esc(v.state) : ''}</div>` : ''}</td>
              <td>${(typeof fmtDate === 'function') ? fmtDate(v.date) : v.date}${v.time ? `<div class="mg-muted-xs">${(typeof fmtTime === 'function') ? fmtTime(v.time) : v.time}</div>` : ''}</td>
              <td>${visitEscortCell(v)}</td>
              <td><span class="badge ${VIS_STATUS_BADGE[v.status] || 'badge-pending'}">${esc(visitStatusLabel(v.status))}</span></td>
              <td><div class="flex gap-1">
                ${v.mobile ? `<a class="btn btn-outline mg-btn-xs" href="tel:${esc(v.mobile)}">📞</a>` : ''}
                <button class="btn btn-outline mg-btn-xs" onclick="openEditVisit('${v.id}')">${window.t('edit')}</button>
                <button class="btn btn-outline mg-btn-xs mg-btn-danger" onclick="confirmDeleteVisit('${v.id}')">${window.t('delete')}</button>
              </div></td>
            </tr>`).join('') : `<tr><td colspan="7" class="mg-empty-cell">${window.t('vis_none', 'No visits match.')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="mg-advice mg-mt-sm">
    ${window.t('vis_explain', 'A padhramani is when Maa\'s murti or the Bhuvaji (the temple oracle) is taken to a devotee\'s home / shop for a blessing. The escort team is the volunteer group that carries the palki, manages the aarti thali and crowd, and brings everything back safely.')}
  </div>`;
}

/* <select> of Management teams (value = team code) for the escort field. */
function visEscortOptions(v) {
  v = v || {};
  const teams = (typeof MG !== 'undefined' && Array.isArray(MG.managements)) ? MG.managements : [];
  const cur = v.escortTeamId || '';
  let opts = `<option value="">— ${window.t('vis_no_escort', 'none / to be assigned')} —</option>`;
  opts += teams.map(t => {
    const code = t.code || t.id;
    const on = cur && String(code) === String(cur);
    return `<option value="${esc(code)}" ${on ? 'selected' : ''}>${esc((typeof tData === 'function' ? tData(t.name) : t.name) || code)}</option>`;
  }).join('');
  return opts;
}

/* Table-cell display for whichever escort mode a visit is in — individual
   mode can have more than one escort (visit_escort_devotees roster). */
function visitEscortCell(v) {
  if (v.escortMode === 'individual') {
    const devs = v.escortDevotees || [];
    if (!devs.length) return '—';
    return devs.map(d => `<span class="badge badge-confirmed">${esc(d.name)}</span>`).join(' ');
  }
  return v.escortTeam ? esc(v.escortTeam) : '—';
}

function visitFormBody(v) {
  v = v || {};
  const pOpts = VISITS.purposes.map(p => `<option value="${p}" ${v.purpose === p ? 'selected' : ''}>${esc(visitPurposeLabel(p))}</option>`).join('');
  const sOpts = ['requested', 'scheduled', 'confirmed', 'completed', 'cancelled'].map(s => `<option value="${s}" ${v.status === s ? 'selected' : ''}>${esc(visitStatusLabel(s))}</option>`).join('');
  const personField = (typeof devoteeLinkField === 'function')
    ? devoteeLinkField({
        selId: 'visDevSel', label: window.t('vis_devotee', 'Devotee'), required: true,
        selectedId: (v.devoteeId && /^DEV-/i.test(v.devoteeId)) ? v.devoteeId : '',
        selectedLabel: v.devoteeName || '',
        hint: window.t('vis_devotee_hint', 'Pick from the register, or add a new devotee — their contact details come from that record.')
      })
    : '';
  return `
  <form id="formVisit" onsubmit="handleSaveVisit(event)">
    ${personField}
    <div class="grid mg-2col-form">
      <div class="form-group"><label class="form-label" for="visPurpose">${window.t('vis_purpose', 'Purpose')}</label><select class="form-select" id="visPurpose">${pOpts}</select></div>
      <div class="form-group"><label class="form-label" for="visStatus">${window.t('status')}</label><select class="form-select" id="visStatus">${sOpts}</select></div>
    </div>
    <div class="form-group"><label class="form-label" for="visAddress">${window.t('vis_address', 'Full Address')}</label><input class="form-input" id="visAddress" value="${esc(v.address || '')}" placeholder="House / shop no., society, landmark"></div>
    <div class="grid mg-2col-form">
      <div class="form-group"><label class="form-label" for="visDate">${window.t('date')} *</label><input type="date" class="form-input" id="visDate" value="${esc(v.date || visToday())}" required></div>
      <div class="form-group"><label class="form-label" for="visTime">${window.t('time')}</label><input type="time" class="form-input" id="visTime" value="${esc(v.time || '11:00')}"></div>
    </div>
    <div class="form-group">
      <label class="form-label">${window.t('vis_escort', 'Escort')}</label>
      <div class="flex gap-2" style="margin-bottom:.5rem">
        <label class="flex items-center gap-1" style="font-weight:normal">
          <input type="radio" name="visEscortMode" value="team" ${(v.escortMode || 'team') === 'team' ? 'checked' : ''} onchange="visSetEscortMode('team')">
          ${window.t('vis_escort_team', 'Escort Team')}
        </label>
        <label class="flex items-center gap-1" style="font-weight:normal">
          <input type="radio" name="visEscortMode" value="individual" ${v.escortMode === 'individual' ? 'checked' : ''} onchange="visSetEscortMode('individual')">
          ${window.t('vis_escort_individual', 'Individual Devotee')}
        </label>
      </div>
      <div id="visEscortTeamWrap" ${v.escortMode === 'individual' ? 'hidden' : ''}>
        <select class="form-select" id="visEscortSel">${visEscortOptions(v)}</select>
      </div>
      <div id="visEscortDevWrap" ${v.escortMode === 'individual' ? '' : 'hidden'}>
        <div class="mg-muted-xs" style="margin-bottom:.4rem">${window.t('vis_escort_dev_hint', 'Pick one or more people leading/escorting this visit — not the sevarthi being visited.')}</div>
        <button type="button" class="btn-add-devotee" onclick="visAddEscortPerson()">+ ${window.t('vis_escort_add_person', 'Add new devotee')}</button>
        <div id="visEscortDevPicker" class="mg-mt-sm">${
          (typeof personCheckList === 'function' && typeof allPeople === 'function')
            ? personCheckList(allPeople(), (v.escortDevotees || []).map(d => d.id), 'vis-esc-check')
            : ''
        }</div>
      </div>
    </div>
    <div class="form-group"><label class="form-label" for="visNotes">${window.t('notes')}</label><textarea class="form-input mg-textarea" id="visNotes" rows="2">${esc(v.notes || '')}</textarea></div>
  </form>`;
}

function visSetEscortMode(mode) {
  const teamWrap = document.getElementById('visEscortTeamWrap');
  const devWrap = document.getElementById('visEscortDevWrap');
  if (teamWrap) teamWrap.hidden = mode === 'individual';
  if (devWrap) devWrap.hidden = mode !== 'individual';
}
/* "+ Add new devotee" from inside the escort picker — keeps whatever's
   already ticked, then re-renders the checklist with the new person added
   and pre-ticked (same pattern as mgAddMemberPerson in management-forms.js). */
function visAddEscortPerson() {
  const keep = (typeof checkedIds === 'function') ? checkedIds('visEscortDevPicker', 'vis-esc-check') : [];
  if (typeof openDevoteeSheet !== 'function') return;
  openDevoteeSheet({
    title: window.t('vis_escort_add_title', 'Add a new devotee'),
    onSaved: function (dev) {
      const box = document.getElementById('visEscortDevPicker');
      if (box && typeof personCheckList === 'function' && typeof allPeople === 'function') {
        box.innerHTML = personCheckList(allPeople(), keep.concat([dev.id]), 'vis-esc-check');
      }
    }
  });
}

function openAddVisit() {
  VISITS.editingId = null;
  openSheet({
    title: window.t('vis_add', 'Add Visit'),
    body: visitFormBody(null),
    footer: `<button class="btn btn-outline" onclick="closeSheet()">${window.t('cancel')}</button>
             <button class="btn btn-primary" type="submit" form="formVisit">${window.t('save')}</button>`
  });
}
function openEditVisit(id) {
  const v = visitById(id); if (!v) return;
  VISITS.editingId = id;
  openSheet({
    title: window.t('vis_edit', 'Edit Visit'),
    body: visitFormBody(v),
    footer: `<button class="btn btn-outline" onclick="closeSheet()">${window.t('cancel')}</button>
             <button class="btn btn-primary" type="submit" form="formVisit">${window.t('save')}</button>`
  });
}
function handleSaveVisit(e) {
  e.preventDefault();
  const g = id => document.getElementById(id);
  const person = (typeof devoteeLinkValue === 'function') ? devoteeLinkValue('visDevSel') : null;
  if (!person || !person.id) { visToast(window.t('vis_need_name', 'Pick a devotee, or add a new one.')); return; }
  const devoteeId = person.id;
  const name = person.name;
  const date = g('visDate').value;
  if (!date) { visToast(window.t('vis_need_date', 'Date is required.')); return; }
  const escortModeEl = document.querySelector('input[name="visEscortMode"]:checked');
  const escortMode = escortModeEl ? escortModeEl.value : 'team';
  const escortTeamId = g('visEscortSel') ? g('visEscortSel').value : '';
  const escortName = escortTeamId && typeof MG !== 'undefined' && Array.isArray(MG.managements)
    ? ((MG.managements.find(t => String(t.code || t.id) === String(escortTeamId)) || {}).name || '')
    : '';
  const escortDevIds = (escortMode === 'individual' && typeof checkedIds === 'function') ? checkedIds('visEscortDevPicker', 'vis-esc-check') : [];
  const allP = (escortMode === 'individual' && typeof allPeople === 'function') ? allPeople() : [];
  const escortDevs = escortDevIds.map(id => {
    const p = allP.find(x => String(x.id) === String(id));
    return { id: id, name: p ? p.name : id, mobile: p ? p.mobile || '' : '', city: p ? p.city || '' : '' };
  });
  const fields = {
    devoteeId: devoteeId, devoteeName: name,
    mobile: person.mobile || '', city: person.city || '', state: person.state || 'Gujarat',
    purpose: g('visPurpose').value, status: g('visStatus').value,
    address: g('visAddress').value.trim(),
    date, time: g('visTime').value,
    escortMode: escortMode,
    escortTeamId: escortMode === 'team' ? (escortTeamId || '') : '',
    escortTeam: escortMode === 'team' ? escortName : '',
    escortDevotees: escortMode === 'individual' ? escortDevs : [],
    notes: g('visNotes').value.trim()
  };
  const online = !!(window.API && window.API.online);
  const body = {
    devoteeId: /^DEV-/i.test(devoteeId) ? devoteeId : undefined,
    devoteeName: name, address: fields.address, purpose: fields.purpose, status: fields.status,
    date: fields.date, time: fields.time,
    escortMode: escortMode,
    escortTeamId: escortMode === 'team' ? (escortTeamId || undefined) : undefined,
    escortTeam: escortMode === 'team' ? escortName : undefined,
    escortDevoteeIds: escortMode === 'individual' ? escortDevIds : undefined,
    notes: fields.notes
  };
  if (VISITS.editingId) {
    const v = visitById(VISITS.editingId);
    Object.assign(v, fields);
    visToast(name + ' — ' + window.t('save') + ' ✓');
    if (online && !!v.code) {
      window.API.patch('/visits/' + (v.code || v.id), body)
        .then(function () { return window.__rehydrate && window.__rehydrate('visits'); })
        .catch(function (err) { visToast((err && err.message) || 'Saved locally — sync failed'); });
    }
  } else {
    let max = 0;
    VISITS.list.forEach(x => { const n = parseInt(String(x.id).replace(/\D/g, ''), 10); if (n > max) max = n; });
    const local = Object.assign({ id: 'VIS-' + String(max + 1).padStart(3, '0') }, fields);
    VISITS.list.push(local);
    visToast(window.t('vis_added', 'Visit added.'));
    if (online) {
      window.API.post('/visits', body)
        .then(function (dto) { if (dto && (dto.code || dto.id)) local.id = dto.code || dto.id; return window.__rehydrate && window.__rehydrate('visits'); })
        .catch(function (err) { visToast((err && err.message) || 'Saved locally — sync failed'); });
    }
  }
  VISITS.editingId = null;
  if (typeof closeSheet === 'function') closeSheet();
  renderVisits();
  if (typeof renderUnifiedCalendar === 'function') renderUnifiedCalendar();
}
function confirmDeleteVisit(id) {
  const v = visitById(id); if (!v) return;
  openConfirm({
    title: window.t('vis_delete', 'Delete Visit'), danger: true,
    body: `<p><strong>${esc(v.devoteeName)}</strong> — ${esc(visitPurposeLabel(v.purpose))}</p>`,
    confirmLabel: window.t('delete'),
    onConfirm: () => {
      const wasSynced = !!v.code;
      VISITS.list = VISITS.list.filter(x => x.id !== id);
      visToast(window.t('vis_deleted', 'Visit deleted.'));
      renderVisits();
      if (window.API && window.API.online && wasSynced) window.API.del('/visits/' + (v.code || v.id)).catch(function (err) { visToast((err && err.message) || 'Delete failed to sync'); });
    }
  });
}

function visitsExport() {
  return {
    filename: 'bhuvaji-visits',
    title: window.t('vis_title', 'Bappa / Bhuvaji Visits'),
    subtitle: window.t('vis_sub', 'Padhramani register with escort teams'),
    columns: ['Devotee', 'Mobile', 'Purpose', 'Address', 'City', 'State', 'Date', 'Time', 'Escort Type', 'Escort', 'Status'],
    rows: VISITS.list.map(v => [v.devoteeName || '', v.mobile || '', visitPurposeLabel(v.purpose),
      v.address || '', v.city || '', v.state || '', v.date || '', v.time || '',
      v.escortMode === 'individual' ? 'Individual' : 'Team',
      v.escortMode === 'individual' ? (v.escortDevotees || []).map(d => d.name).join(', ') : (v.escortTeam || ''),
      visitStatusLabel(v.status)])
  };
}
if (typeof registerExport === 'function') registerExport('mod-visits', visitsExport);

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('visitsRoot')) return;
  renderVisits();
  if (typeof onLanguageChange === 'function') onLanguageChange(() => renderVisits());
});
