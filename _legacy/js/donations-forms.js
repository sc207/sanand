/* ---- Donations: modal markup moved out of index.html (injected at load) ---- */
(function () {
  if (typeof document === 'undefined' || document.getElementById('modalDonation')) return;
  document.body.insertAdjacentHTML('beforeend', `
<!-- Record / Edit Donation -->
<div class="modal-overlay" id="modalDonation">
  <div class="modal-box" style="max-width: 720px;">
    <div class="modal-header">
      <div>
        <div class="modal-title" id="donationFormTitle">Record Donation</div>
        <span class="mg-muted-xs">Cash or in-kind offering to the mandir</span>
      </div>
      <button class="modal-close-btn" onclick="closeModal('modalDonation')">&times;</button>
    </div>
    <div class="modal-body">
      <form id="formDonation" onsubmit="handleSaveDonation(event)">
        <div class="form-group">
          <label class="form-label" for="donFieldCategory">Donation Category *</label>
          <select class="form-select" id="donFieldCategory" onchange="onDonationCategoryChange()"></select>
        </div>

        <div class="form-group">
          <label class="form-label" for="donFieldDonor">Donor *</label>
          <div class="flex gap-2">
            <select class="form-select" id="donFieldDonor" onchange="onDonorSelectChange()"></select>
            <button class="btn btn-outline" type="button" onclick="openAddDonor('donationForm')">+ New Donor</button>
          </div>
          <div class="mg-muted-xs" id="donDonorHint" style="margin-top:0.35rem;"></div>
        </div>

        <!-- CASH fields -->
        <div id="donCashFields" class="grid mg-2col-form">
          <div class="form-group">
            <label class="form-label" for="donFieldAmount">Amount (₹) *</label>
            <input type="number" class="form-input" id="donFieldAmount" min="1" placeholder="e.g. 11000">
          </div>
          <div class="form-group">
            <label class="form-label" for="donFieldMode">Payment Mode *</label>
            <select class="form-select" id="donFieldMode">
              <option value="Cash">Cash</option>
              <option value="UPI">UPI / GPay</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
        </div>

        <!-- IN-KIND fields -->
        <div id="donKindFields" hidden>
          <div class="form-group">
            <label class="form-label" for="donFieldItem">Item / Article Donated *</label>
            <input type="text" class="form-input" id="donFieldItem" placeholder="e.g. Diamond ring — 3.2 ct, VVS1, 18k gold band">
          </div>
          <div class="grid mg-2col-form">
            <div class="form-group">
              <label class="form-label" for="donFieldQty">Quantity</label>
              <input type="text" class="form-input" id="donFieldQty" placeholder="e.g. 1 pc / 2 kg / 1 cow">
            </div>
            <div class="form-group">
              <label class="form-label" for="donFieldValuation">Estimated Value (₹) *</label>
              <input type="number" class="form-input" id="donFieldValuation" min="0" placeholder="e.g. 20000000">
            </div>
          </div>
        </div>

        <div class="grid mg-2col-form">
          <div class="form-group">
            <label class="form-label" for="donFieldDate">Date *</label>
            <input type="date" class="form-input" id="donFieldDate" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="donFieldStatus">Status</label>
            <select class="form-select" id="donFieldStatus">
              <option value="received">Received</option>
              <option value="pledged">Pledged</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="donFieldPurpose">Purpose / Earmark</label>
          <input type="text" class="form-input" id="donFieldPurpose" placeholder="e.g. Sabha Mandap flooring">
        </div>

        <div class="form-group">
          <label class="form-label" for="donFieldNotes">Notes</label>
          <textarea class="form-input mg-textarea" id="donFieldNotes" rows="2" placeholder="Condition, hallmark, cheque no., anything to record"></textarea>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modalDonation')">Cancel</button>
      <button class="btn btn-primary" type="submit" form="formDonation" id="donationFormSubmitBtn">Save &amp; Issue Receipt</button>
    </div>
  </div>
</div>

<!-- Add / Edit Donor (individual, organization or trust) -->
<div class="modal-overlay" id="modalDonor">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title" id="donorFormTitle">Add Donor</div>
      <button class="modal-close-btn" onclick="closeModal('modalDonor')">&times;</button>
    </div>
    <div class="modal-body">
      <form id="formDonor" onsubmit="handleSaveDonor(event)">
        <div class="form-group">
          <label class="form-label" for="donorFieldType">Donor Type *</label>
          <select class="form-select" id="donorFieldType" onchange="onDonorTypeChange()">
            <option value="individual">Individual / Devotee</option>
            <option value="organization">Company</option>
            <option value="trust">Trust / Foundation</option>
          </select>
        </div>

        <div id="donorIndividualFields">
          <div id="donorPersonMount"></div>
          <div class="mg-muted-xs" style="margin:.15rem 0 .6rem">Name, mobile and city come from the devotee record.</div>
        </div>

        <div id="donorOrgFields" hidden>
          <div class="form-group">
            <label class="form-label" for="donorFieldOrg">Organisation / Trust Name *</label>
            <input type="text" class="form-input" id="donorFieldOrg" placeholder="e.g. Shree Rabari Seva Trust">
          </div>
          <div class="form-group">
            <label class="form-label" for="donorFieldContact">Contact Person</label>
            <input type="text" class="form-input" id="donorFieldContact" placeholder="Authorised signatory">
          </div>
          <div class="grid mg-2col-form">
            <div class="form-group">
              <label class="form-label" for="donorFieldMobile">Mobile Number</label>
              <input type="tel" class="form-input" id="donorFieldMobile" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit mobile">
            </div>
            <div class="form-group">
              <label class="form-label" for="donorFieldCity">City</label>
              <input type="text" class="form-input" id="donorFieldCity" placeholder="e.g. Sanand">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="donorFieldState">State</label>
            <input type="text" class="form-input" id="donorFieldState" placeholder="e.g. Gujarat">
          </div>
        </div>

        <div class="grid mg-2col-form">
          <div class="form-group">
            <label class="form-label" for="donorFieldPan">PAN (for 80G)</label>
            <input type="text" class="form-input" id="donorFieldPan" maxlength="10" placeholder="ABCDE1234F" style="text-transform:uppercase">
          </div>
          <div class="form-group">
            <label class="form-label" for="donorFieldNotes">Notes</label>
            <input type="text" class="form-input" id="donorFieldNotes" placeholder="Optional">
          </div>
        </div>
        <div id="donorExistingHint"></div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modalDonor')">Cancel</button>
      <button class="btn btn-primary" type="submit" form="formDonor" id="donorFormSubmitBtn">Add Donor</button>
    </div>
  </div>
</div>

<!-- Add / Edit Donation Category -->
<div class="modal-overlay" id="modalDonCategory">
  <div class="modal-box">
    <div class="modal-header">
      <div class="modal-title" id="donCatFormTitle">Add Donation Category</div>
      <button class="modal-close-btn" onclick="closeModal('modalDonCategory')">&times;</button>
    </div>
    <div class="modal-body">
      <form id="formDonCategory" onsubmit="handleSaveDonCategory(event)">
        <div class="grid mg-2col-form">
          <div class="form-group">
            <label class="form-label" for="donCatFieldName">Category Name *</label>
            <input type="text" class="form-input" id="donCatFieldName" placeholder="e.g. Gold / Suvarna Daan" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="donCatFieldIcon">Icon (emoji)</label>
            <input type="text" class="form-input" id="donCatFieldIcon" maxlength="2" placeholder="💰">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="donCatFieldKind">Kind *</label>
          <select class="form-select" id="donCatFieldKind">
            <option value="cash">Cash / money</option>
            <option value="kind">In-kind (goods, gold, cattle, etc.)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="donCatFieldDesc">Description</label>
          <input type="text" class="form-input" id="donCatFieldDesc" placeholder="Short note about this category">
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modalDonCategory')">Cancel</button>
      <button class="btn btn-primary" type="submit" form="formDonCategory" id="donCatFormSubmitBtn">Add Category</button>
    </div>
  </div>
</div>

<!-- Modal 7: Donation document viewer (80G receipt / Dhanyavaad certificate) -->
<div class="modal-overlay" id="modalReceiptViewer">
  <div class="modal-box mg-sheet-wide">
    <div class="modal-header">
      <div class="modal-title" id="receiptViewerTitle">Official Temple Receipt</div>
      <button class="modal-close-btn" onclick="closeModal('modalReceiptViewer')">&times;</button>
    </div>
    <div class="modal-body" id="receiptContent">
      <!-- Rendered dynamically by donations-ui.js -->
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal('modalReceiptViewer')">Close</button>
      <button class="btn btn-primary" id="receiptViewerPrintBtn" onclick="printCurrentDonationDoc()">Print / Save PDF</button>
    </div>
  </div>
</div>

`);
})();

/* ============================================================
   DONATIONS APP — MODALS, FORMS & CRUD
   Depends on donations.js + donations-ui.js. Reuses openConfirm,
   openModal/closeModal, nextId, esc globals.
   ============================================================ */

/* ---- option builders ---- */
function renderDonCatOptions(selected) {
  return DON.categories.map(c =>
    `<option value="${c.id}" data-kind="${c.kind}" ${c.id === selected ? 'selected' : ''}>${esc((c.icon || '') + ' ' + tData(c.name))}${c.kind === 'kind' ? ' — ' + window.t('don_kind') : ''}</option>`).join('');
}
function renderDonorOptions(selected) {
  return `<option value="">— ${window.t('don_select_donor')} —</option>` +
    DON.donors.slice().sort((a, b) => donorName(a).localeCompare(donorName(b))).map(d =>
      `<option value="${d.id}" ${d.id === selected ? 'selected' : ''}>${esc(donorName(d))}${d.mobile ? ' · ' + esc(d.mobile) : ''} · ${esc(donorTypeLabel(d))}</option>`).join('');
}

/* ---- toggles ---- */
function onDonationCategoryChange() {
  const sel = document.getElementById('donFieldCategory');
  const opt = sel.options[sel.selectedIndex];
  const kind = opt && opt.getAttribute('data-kind') === 'kind';
  document.getElementById('donCashFields').hidden = kind;
  document.getElementById('donKindFields').hidden = !kind;
  const mode = document.getElementById('donFieldMode');
  if (kind) { mode.value = 'In-Kind'; }
  else if (mode.value === 'In-Kind') { mode.value = 'Cash'; }
}
function onDonorSelectChange() {
  const d = donorById(document.getElementById('donFieldDonor').value);
  const hint = document.getElementById('donDonorHint');
  if (d) {
    hint.innerHTML = `${esc(donorTypeLabel(d))}${d.city ? ' · ' + esc(tData(d.city)) : ''}${d.pan ? ' · PAN ' + esc(d.pan) : ' · ' + window.t('don_no_pan')}`;
  } else {
    hint.innerHTML = '';
  }
}

/* ------------------------------------------------------------
   RECORD / EDIT DONATION
   ------------------------------------------------------------ */
function openRecordDonation(donorId) {
  DON.editingDonationId = null;
  document.getElementById('donationFormTitle').textContent = window.t('don_record');
  document.getElementById('donationFormSubmitBtn').textContent = window.t('don_save_receipt');
  const f = document.getElementById('formDonation');
  if (!f) return;
  f.reset();
  document.getElementById('donFieldCategory').innerHTML = renderDonCatOptions('DCT-001');
  document.getElementById('donFieldDonor').innerHTML = renderDonorOptions(donorId || '');
  document.getElementById('donFieldDate').value = donToday();
  document.getElementById('donFieldStatus').value = 'received';
  document.getElementById('donFieldMode').value = 'Cash';
  document.getElementById('donDonorHint').innerHTML = '';
  onDonationCategoryChange();
  onDonorSelectChange();
  openModal('modalDonation');
}

function openEditDonation(id) {
  const x = donationById(id);
  if (!x) return;
  DON.editingDonationId = id;
  document.getElementById('donationFormTitle').textContent = window.t('don_edit');
  document.getElementById('donationFormSubmitBtn').textContent = window.t('save');
  document.getElementById('donFieldCategory').innerHTML = renderDonCatOptions(x.categoryId);
  document.getElementById('donFieldDonor').innerHTML = renderDonorOptions(x.donorId);
  document.getElementById('donFieldMode').value = x.mode || 'Cash';
  document.getElementById('donFieldAmount').value = x.amount || '';
  document.getElementById('donFieldItem').value = x.item || '';
  document.getElementById('donFieldQty').value = x.qty || '';
  document.getElementById('donFieldValuation').value = x.valuation || '';
  document.getElementById('donFieldDate').value = x.date || donToday();
  document.getElementById('donFieldStatus').value = x.status || 'received';
  document.getElementById('donFieldPurpose').value = x.purpose || '';
  document.getElementById('donFieldNotes').value = x.notes || '';
  onDonationCategoryChange();
  onDonorSelectChange();
  openModal('modalDonation');
}

function handleSaveDonation(e) {
  e.preventDefault();
  const categoryId = document.getElementById('donFieldCategory').value;
  const donorId = document.getElementById('donFieldDonor').value;
  const c = donCatById(categoryId);
  const kind = c && c.kind === 'kind';

  if (!donorId) { donToast(window.t('don_pick_donor')); return; }
  if (!categoryId) { donToast(window.t('don_pick_category')); return; }

  const amount = parseInt(document.getElementById('donFieldAmount').value, 10);
  const valuation = parseInt(document.getElementById('donFieldValuation').value, 10);
  const item = document.getElementById('donFieldItem').value.trim();

  if (kind) {
    if (!item) { donToast(window.t('don_need_item')); return; }
    if (!valuation || valuation < 0) { donToast(window.t('don_need_value')); return; }
  } else {
    if (!amount || amount < 1) { donToast(window.t('don_need_amount')); return; }
  }

  const payload = {
    donorId, categoryId,
    mode: kind ? 'In-Kind' : document.getElementById('donFieldMode').value,
    amount: kind ? 0 : amount,
    item: kind ? item : '',
    qty: kind ? document.getElementById('donFieldQty').value.trim() : '',
    valuation: kind ? valuation : 0,
    date: document.getElementById('donFieldDate').value || donToday(),
    status: document.getElementById('donFieldStatus').value,
    purpose: document.getElementById('donFieldPurpose').value.trim(),
    notes: document.getElementById('donFieldNotes').value.trim()
  };

  const online = !!(window.API && window.API.online);
  let saved;
  if (DON.editingDonationId) {
    saved = donationById(DON.editingDonationId);
    Object.assign(saved, payload);
    donToast(window.t('don_updated'));
    if (online && !!saved.code) {
      window.API.patch('/donations/' + (saved.code || saved.id), {
        mode: payload.mode, amount: payload.amount, item: payload.item, qty: payload.qty,
        valuation: payload.valuation, date: payload.date, status: payload.status,
        purpose: payload.purpose, notes: payload.notes
      })
        .then(function () { return window.__rehydrate && window.__rehydrate('donations'); })
        .catch(function (err) { donToast((err && err.message) || 'Saved locally — sync failed'); });
    }
  } else {
    saved = Object.assign({
      id: nextId('DON', DON.donations, 3),
      receiptNo: nextReceiptNo(), certNo: '', certificateIssued: false,
      recordedBy: (typeof MG !== 'undefined' && MG.session ? MG.session.userName : 'Administrator')
    }, payload);
    DON.donations.unshift(saved);
    donToast(window.t('don_saved') + ' — ' + saved.receiptNo);
    if (online) {
      window.API.post('/donations', payload)
        .then(function (dto) {
          if (dto) { saved.id = dto.code || dto.id || saved.id; if (dto.receiptNo) saved.receiptNo = dto.receiptNo; }
          return window.__rehydrate && window.__rehydrate('donations');
        })
        .catch(function (err) { donToast((err && err.message) || 'Saved locally — sync failed'); });
    }
  }

  DON.editingDonationId = null;
  closeModal('modalDonation');
  renderDonations();
  if (saved.status === 'received') openDonationReceipt(saved.id);
}

function confirmDeleteDonation(id) {
  const x = donationById(id);
  if (!x) return;
  openConfirm({
    title: window.t('don_delete_title'),
    danger: true,
    body: `<p>${window.t('don_delete_body')} <strong>${esc(x.receiptNo)}</strong> — ${esc(donationGiven(x))}?</p>`,
    confirmLabel: window.t('delete'),
    onConfirm: () => {
      const wasSynced = !!x.code;
      DON.donations = DON.donations.filter(d => d.id !== id);
      donToast(window.t('don_deleted'));
      renderDonations();
      if (window.API && window.API.online && wasSynced) window.API.del('/donations/' + (x.code || x.id)).catch(function (err) { donToast((err && err.message) || 'Delete failed to sync'); });
    }
  });
}

/* ------------------------------------------------------------
   DONOR REGISTRY
   ------------------------------------------------------------ */
let _donorReturnTo = null;

function onDonorTypeChange() {
  const t = document.getElementById('donorFieldType').value;
  const indiv = document.getElementById('donorIndividualFields');
  indiv.hidden = (t !== 'individual');
  document.getElementById('donorOrgFields').hidden = (t === 'individual');
  // (re)mount the shared devotee picker for the individual path
  const mount = document.getElementById('donorPersonMount');
  if (t === 'individual' && mount && !mount.querySelector('.dp-combo') && typeof devoteeLinkField === 'function') {
    const d = DON.editingDonorId ? donorById(DON.editingDonorId) : null;
    mount.innerHTML = devoteeLinkField({
      selId: 'donorDevSel', label: window.t('don_donor', 'Donor') + ' (' + window.t('dv_title', 'devotee') + ')', required: true,
      selectedId: (d && d.type === 'individual' && /^DEV-/i.test(d.devoteeId || '')) ? d.devoteeId : '',
      selectedLabel: (d && d.type === 'individual') ? (d.name || '') : ''
    });
  }
}

function openAddDonor(returnTo) {
  _donorReturnTo = returnTo || null;
  DON.editingDonorId = null;
  document.getElementById('donorFormTitle').textContent = window.t('don_add_donor');
  document.getElementById('donorFormSubmitBtn').textContent = window.t('don_add_donor');
  document.getElementById('formDonor').reset();
  document.getElementById('donorFieldType').value = 'individual';
  document.getElementById('donorFieldState').value = 'Gujarat';
  document.getElementById('donorExistingHint').innerHTML = '';
  document.getElementById('donorPersonMount').innerHTML = '';
  onDonorTypeChange();
  openModal('modalDonor');
}

function openEditDonor(id, returnTo) {
  const d = donorById(id);
  if (!d) return;
  _donorReturnTo = returnTo || 'directory';
  DON.editingDonorId = id;
  document.getElementById('donorFormTitle').textContent = window.t('don_edit_donor');
  document.getElementById('donorFormSubmitBtn').textContent = window.t('save');
  document.getElementById('donorFieldType').value = d.type || 'individual';
  document.getElementById('donorFieldOrg').value = d.orgName || '';
  document.getElementById('donorFieldContact').value = d.contactPerson || '';
  document.getElementById('donorFieldMobile').value = d.mobile || '';
  document.getElementById('donorFieldPan').value = d.pan || '';
  document.getElementById('donorFieldCity').value = d.city || '';
  document.getElementById('donorFieldState').value = d.state || '';
  document.getElementById('donorFieldNotes').value = d.notes || '';
  document.getElementById('donorExistingHint').innerHTML = '';
  document.getElementById('donorPersonMount').innerHTML = '';
  onDonorTypeChange();
  openModal('modalDonor');
}

function handleSaveDonor(e) {
  e.preventDefault();
  const type = document.getElementById('donorFieldType').value;
  const org = document.getElementById('donorFieldOrg').value.trim();
  const contact = document.getElementById('donorFieldContact').value.trim();
  const mobile = document.getElementById('donorFieldMobile').value.replace(/\D/g, '').slice(0, 10);
  const pan = document.getElementById('donorFieldPan').value.trim().toUpperCase();
  const city = document.getElementById('donorFieldCity').value.trim();
  const state = document.getElementById('donorFieldState').value.trim();
  const notes = document.getElementById('donorFieldNotes').value.trim();
  const person = (type === 'individual' && typeof devoteeLinkValue === 'function')
    ? devoteeLinkValue('donorDevSel') : null;

  if (type === 'individual') {
    if (!person || !person.id) { donToast(window.t('don_pick_donor', 'Pick a devotee, or add a new one.')); return; }
  } else {
    if (!org) { donToast(window.t('don_need_org')); return; }
    if (mobile && !/^[0-9]{10}$/.test(mobile)) { donToast(window.t('don_need_mobile')); return; }
  }
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) { donToast(window.t('don_bad_pan')); return; }

  const online = !!(window.API && window.API.online);
  const body = (type === 'individual')
    ? { type: 'individual', devoteeId: person.id, pan, notes }
    : { type, orgName: org, contactPerson: contact, mobile, pan, city, state, notes };
  const wasEditing = !!DON.editingDonorId;
  let saved;
  if (wasEditing) {
    saved = donorById(DON.editingDonorId);
    if (type === 'individual') {
      Object.assign(saved, { type, devoteeId: person.id, firstName: person.firstName, lastName: person.lastName,
        name: person.name, mobile: person.mobile, city: person.city, state: person.state, pan, notes });
    } else {
      Object.assign(saved, { type, orgName: org, contactPerson: contact, mobile, pan, city, state, notes });
    }
    donToast(window.t('don_donor_updated'));
    if (online && !!saved.code) {
      window.API.patch('/donors/' + (saved.code || saved.id), body)
        .then(function () { return window.__rehydrate && window.__rehydrate('donations'); })
        .catch(function (err) { donToast((err && err.message) || 'Saved locally — sync failed'); });
    }
  } else {
    saved = (type === 'individual')
      ? { id: nextId('DNR', DON.donors, 3), type, devoteeId: person.id,
          firstName: person.firstName, lastName: person.lastName, name: person.name,
          mobile: person.mobile, city: person.city, state: person.state, pan, notes, addedDate: donToday() }
      : { id: nextId('DNR', DON.donors, 3), type, orgName: org, contactPerson: contact,
          mobile, pan, city, state, notes, addedDate: donToday() };
    DON.donors.push(saved);
    donToast(window.t('don_donor_added') + ' — ' + donorName(saved));
    if (online) {
      window.API.post('/donors', body)
        .then(function (dto) {
          if (dto && (dto.code || dto.id)) saved.id = dto.code || dto.id;
          if (dto && dto._deduped) donToast('Matched an existing donor — ' + (dto.name || ''));
          return window.__rehydrate && window.__rehydrate('donations');
        })
        .then(function () { if (back === 'donationForm') refreshDonorSelect(saved.id); })
        .catch(function (err) { donToast((err && err.message) || 'Saved locally — sync failed'); });
    }
  }

  DON.editingDonorId = null;
  const back = _donorReturnTo;
  _donorReturnTo = null;
  closeModal('modalDonor');

  if (back === 'donationForm') {
    refreshDonorSelect(saved.id);
  } else {
    renderDonations();
  }
}
function refreshDonorSelect(donorId) {
  const sel = document.getElementById('donFieldDonor');
  if (sel && typeof renderDonorOptions === 'function') { sel.innerHTML = renderDonorOptions(donorId); if (typeof onDonorSelectChange === 'function') onDonorSelectChange(); }
}

function confirmDeleteDonor(id) {
  const d = donorById(id);
  if (!d) return;
  const used = donationsOfDonor(id).length;
  if (used) { donToast(window.t('don_donor_in_use').replace('{n}', used)); return; }
  openConfirm({
    title: window.t('don_delete_donor'),
    danger: true,
    body: `<p>${window.t('don_delete_donor_body')} <strong>${esc(donorName(d))}</strong>?</p>`,
    confirmLabel: window.t('delete'),
    onConfirm: () => {
      const wasSynced = !!d.code;
      DON.donors = DON.donors.filter(x => x.id !== id);
      if (DON.activeDonorId === id) { DON.activeDonorId = null; DON.view = 'directory'; }
      donToast(window.t('don_donor_deleted'));
      renderDonations();
      if (window.API && window.API.online && wasSynced) window.API.del('/donors/' + (d.code || d.id)).catch(function (err) { donToast((err && err.message) || 'Delete failed to sync'); });
    }
  });
}

/* ------------------------------------------------------------
   DONATION CATEGORIES
   ------------------------------------------------------------ */
function openAddDonCategory() {
  DON.editingCatId = null;
  document.getElementById('donCatFormTitle').textContent = window.t('don_add_category');
  document.getElementById('donCatFormSubmitBtn').textContent = window.t('don_add_category');
  document.getElementById('formDonCategory').reset();
  openModal('modalDonCategory');
}
function openEditDonCategory(id) {
  const c = donCatById(id);
  if (!c) return;
  DON.editingCatId = id;
  document.getElementById('donCatFormTitle').textContent = window.t('don_edit_category');
  document.getElementById('donCatFormSubmitBtn').textContent = window.t('save');
  document.getElementById('donCatFieldName').value = c.name;
  document.getElementById('donCatFieldIcon').value = c.icon || '';
  document.getElementById('donCatFieldKind').value = c.kind;
  document.getElementById('donCatFieldDesc').value = c.description || '';
  openModal('modalDonCategory');
}
function handleSaveDonCategory(e) {
  e.preventDefault();
  const name = document.getElementById('donCatFieldName').value.trim();
  if (!name) { donToast(window.t('don_need_cat_name')); return; }
  const dupe = DON.categories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== DON.editingCatId);
  if (dupe) { donToast(window.t('don_cat_exists')); return; }
  const payload = {
    name,
    icon: document.getElementById('donCatFieldIcon').value.trim() || (document.getElementById('donCatFieldKind').value === 'kind' ? '🎁' : '🪙'),
    kind: document.getElementById('donCatFieldKind').value,
    description: document.getElementById('donCatFieldDesc').value.trim()
  };
  const online = !!(window.API && window.API.online);
  if (DON.editingCatId) {
    const c = donCatById(DON.editingCatId);
    Object.assign(c, payload);
    donToast(window.t('don_cat_updated'));
    if (online && !!c.code) window.API.patch('/donation-categories/' + (c.code || c.id), payload).catch(function () {});
  } else {
    const c = Object.assign({ id: nextId('DCT', DON.categories, 3) }, payload);
    DON.categories.push(c);
    donToast(window.t('don_cat_added'));
    if (online) window.API.post('/donation-categories', payload)
      .then(function () { return window.__rehydrate && window.__rehydrate('donations'); }).catch(function () {});
  }
  DON.editingCatId = null;
  closeModal('modalDonCategory');
  renderDonations();
}
function confirmDeleteDonCategory(id) {
  const c = donCatById(id);
  if (!c) return;
  const used = DON.donations.filter(x => x.categoryId === id).length;
  if (used) { donToast(window.t('don_cat_in_use').replace('{n}', used)); return; }
  openConfirm({
    title: window.t('don_delete_category'),
    danger: true,
    body: `<p>${window.t('don_delete_cat_body')} <strong>${esc(tData(c.name))}</strong>?</p>`,
    confirmLabel: window.t('delete'),
    onConfirm: () => {
      const wasSynced = !!c.code;
      DON.categories = DON.categories.filter(x => x.id !== id);
      donToast(window.t('don_cat_deleted'));
      renderDonations();
      if (window.API && window.API.online && wasSynced) window.API.del('/donation-categories/' + (c.code || c.id)).catch(function () {});
    }
  });
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('donationsRoot')) return;
  renderDonations();
  if (typeof onLanguageChange === 'function') onLanguageChange(() => renderDonations());
});
