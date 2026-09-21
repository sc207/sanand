/* ============================================================
   DONATIONS APP — RENDER, RECEIPT & CERTIFICATE LAYER
   Depends on donations.js. Reuses management/pooja globals.
   ============================================================ */

function renderDonations() {
  const root = document.getElementById('donationsRoot');
  if (!root) return;
  root.innerHTML = (DON.view === 'donor' && DON.activeDonorId)
    ? viewDonorProfile()
    : viewDonationsDirectory();
}

/* ------------------------------------------------------------
   DIRECTORY
   ------------------------------------------------------------ */
function viewDonationsDirectory() {
  const monthKey = donToday().slice(0, 7);
  const thisMonth = DON.donations.filter(x => donMonthKeyOf(x) === monthKey);
  const cashMonth = thisMonth.filter(x => !donationIsKind(x) && x.status === 'received')
    .reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const kindMonth = thisMonth.filter(x => donationIsKind(x) && x.status === 'received')
    .reduce((s, x) => s + (Number(x.valuation) || 0), 0);
  const pledged = DON.donations.filter(x => x.status === 'pledged').length;

  const list = filteredDonations();

  const catOpts = `<option value="all">${window.t('all')} ${window.t('don_categories')}</option>` +
    DON.categories.map(c => `<option value="${c.id}" ${DON.filterCat === c.id ? 'selected' : ''}>${esc(tData(c.name))}</option>`).join('');
  const monthOpts = `<option value="all">${window.t('all')} ${window.t('date')}</option>` +
    donMonthOptions().map(k => {
      const [y, m] = k.split('-');
      return `<option value="${k}" ${DON.filterMonth === k ? 'selected' : ''}>${MONTHS[+m - 1]} ${y}</option>`;
    }).join('');

  return `
  <div class="flex justify-between items-center mg-page-head">
    <div>
      <h1 class="banner-title mg-page-title">💰 ${window.t('don_title')}</h1>
      <p class="mg-page-sub">${window.t('don_sub')}</p>
    </div>
    <div class="flex gap-2">
      ${typeof exportBar === 'function' ? exportBar('mod-donations') : ''}
      <button class="btn btn-primary" onclick="openRecordDonation()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        ${window.t('don_record')}
      </button>
    </div>
  </div>

  <div class="stats-grid">
    ${kpiCard(window.t('don_kpi_cash'), '₹' + cashMonth.toLocaleString('en-IN'), MONTHS[+monthKey.split('-')[1] - 1] + ' ' + monthKey.split('-')[0], '🪙')}
    ${kpiCard(window.t('don_kpi_kind'), '₹' + kindMonth.toLocaleString('en-IN'), window.t('don_kpi_kind_meta'), '💍')}
    ${kpiCard(window.t('don_kpi_donors'), DON.donors.length, window.t('don_kpi_donors_meta'), '🙏')}
    ${kpiCard(window.t('don_kpi_pledged'), pledged, window.t('don_kpi_pledged_meta'), '⏳')}
  </div>

  <div class="card mg-mt">
    <div class="card-header flex justify-between items-center" style="flex-wrap:wrap; gap:0.5rem;">
      <div class="card-title">${window.t('don_register')}</div>
      <div class="flex gap-2" style="flex-wrap:wrap;">
        <select class="form-select mg-inline-select" onchange="DON.filterMonth=this.value; renderDonations()">${monthOpts}</select>
        <select class="form-select mg-inline-select" onchange="DON.filterCat=this.value; renderDonations()">${catOpts}</select>
        <select class="form-select mg-inline-select" onchange="DON.filterStatus=this.value; renderDonations()">
          <option value="all" ${DON.filterStatus === 'all' ? 'selected' : ''}>${window.t('all')} ${window.t('status')}</option>
          <option value="received" ${DON.filterStatus === 'received' ? 'selected' : ''}>${window.t('don_received')}</option>
          <option value="pledged" ${DON.filterStatus === 'pledged' ? 'selected' : ''}>${window.t('don_pledged')}</option>
        </select>
        <input class="form-input mg-inline-search" placeholder="${window.t('search')}…" value="${esc(DON.search)}" oninput="DON.search=this.value; renderDonations()">
      </div>
    </div>
    <div class="card-body" style="padding:0;">
      <div class="mg-table-scroll">
        <table class="custom-table pj-reg-table">
          <thead><tr>
            <th>${window.t('don_receipt_no')}</th><th>${window.t('don_donor')}</th><th>${window.t('don_category')}</th>
            <th>${window.t('don_given')}</th><th>${window.t('don_value')}</th><th>${window.t('date')}</th>
            <th>${window.t('status')}</th><th>${window.t('actions')}</th>
          </tr></thead>
          <tbody>${donationRows(list)}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="card mg-mt">
    <div class="card-header flex justify-between items-center">
      <div class="card-title">${window.t('don_donor_registry')} (${DON.donors.length})</div>
      <button class="btn btn-primary mg-btn-xs" onclick="openAddDonor('directory')">+ ${window.t('don_add_donor')}</button>
    </div>
    <div class="card-body" style="padding:0;">
      <div class="mg-table-scroll">
        <table class="custom-table pj-reg-table">
          <thead><tr><th>${window.t('name')}</th><th>${window.t('don_donor_type')}</th><th>${window.t('mobile')}</th><th>${window.t('city')} / ${window.t('state')}</th><th>PAN</th><th>${window.t('don_lifetime')}</th><th>${window.t('actions')}</th></tr></thead>
          <tbody>${donorRegistryRows()}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="card mg-mt">
    <div class="card-header flex justify-between items-center">
      <div class="card-title">${window.t('don_categories')} (${DON.categories.length})</div>
      <button class="btn btn-primary mg-btn-xs" onclick="openAddDonCategory()">+ ${window.t('don_category')}</button>
    </div>
    <div class="card-body">
      <div class="pj-type-grid">${donCategoryCards()}</div>
    </div>
  </div>`;
}

function filteredDonations() {
  const q = (DON.search || '').toLowerCase();
  return DON.donations.filter(x => {
    if (DON.filterMonth !== 'all' && donMonthKeyOf(x) !== DON.filterMonth) return false;
    if (DON.filterCat !== 'all' && x.categoryId !== DON.filterCat) return false;
    if (DON.filterStatus !== 'all' && x.status !== DON.filterStatus) return false;
    if (q) {
      const d = donorById(x.donorId);
      const hay = [x.receiptNo, x.certNo, donorName(d), donCatName(x), x.item, x.purpose].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
}

function donationRows(list) {
  if (!list.length) return `<tr><td colspan="8" class="mg-empty-cell">${window.t('don_none')}</td></tr>`;
  return list.map(x => {
    const d = donorById(x.donorId);
    const c = donCatById(x.categoryId);
    const kind = donationIsKind(x);
    return `
    <tr>
      <td><strong>${esc(x.receiptNo || '—')}</strong>${x.certNo ? `<div class="mg-muted-xs">🎖 ${esc(x.certNo)}</div>` : ''}</td>
      <td>
        <div class="mg-name-cell">
          <span class="mg-avatar">${esc((donorName(d)[0] || '?').toUpperCase())}</span>
          <div><strong>${esc(donorName(d))}</strong><div class="mg-muted-xs">${esc(donorTypeLabel(d))}${d && d.committee ? ' · ' + esc(tData(d.committee)) : ''}</div></div>
        </div>
      </td>
      <td><span class="badge badge-maroon">${esc(c ? (c.icon || '') + ' ' + tData(c.name) : '—')}</span></td>
      <td>${kind ? esc(x.item || '—') + (x.qty ? `<div class="mg-muted-xs">${esc(x.qty)}</div>` : '') : `<span class="mg-muted-xs">${esc(x.mode)}</span>`}</td>
      <td><strong>₹${donationValue(x).toLocaleString('en-IN')}</strong>${kind ? `<div class="mg-muted-xs">${window.t('don_est_value')}</div>` : ''}</td>
      <td>${fmtDate(x.date)}</td>
      <td><span class="badge ${x.status === 'received' ? 'badge-confirmed' : 'badge-pending'}">${x.status === 'received' ? window.t('don_received') : window.t('don_pledged')}</span></td>
      <td>
        <div class="flex gap-1 mg-actions-wrap">
          <button class="btn btn-outline mg-btn-xs" onclick="openDonationReceipt('${x.id}')">🧾 ${window.t('don_receipt')}</button>
          <button class="btn btn-outline mg-btn-xs" onclick="openDonationCertificate('${x.id}')">🎖 ${window.t('don_certificate')}</button>
          <button class="btn btn-outline mg-btn-xs" onclick="openEditDonation('${x.id}')">${window.t('edit')}</button>
          <button class="btn btn-outline mg-btn-xs mg-btn-danger" onclick="confirmDeleteDonation('${x.id}')">${window.t('delete')}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function donorRegistryRows() {
  if (!DON.donors.length) return `<tr><td colspan="7" class="mg-empty-cell">${window.t('don_no_donors')}</td></tr>`;
  return DON.donors.map(d => {
    const lifetime = donationsOfDonor(d.id).filter(x => x.status === 'received').reduce((s, x) => s + donationValue(x), 0);
    return `
    <tr>
      <td>
        <div class="mg-name-cell">
          <span class="mg-avatar">${esc((donorName(d)[0] || '?').toUpperCase())}</span>
          <div><strong>${esc(donorName(d))}</strong>${donorSubline(d) ? `<div class="mg-muted-xs">${esc(donorSubline(d))}</div>` : ''}</div>
        </div>
      </td>
      <td><span class="badge ${d.type === 'individual' ? 'badge-maroon' : 'badge-confirmed'}">${esc(donorTypeLabel(d))}</span></td>
      <td>${esc(d.mobile || '—')}</td>
      <td>${esc([tData(d.city), tData(d.state)].filter(Boolean).join(', ') || '—')}</td>
      <td>${esc(d.pan || '—')}</td>
      <td><strong>₹${lifetime.toLocaleString('en-IN')}</strong></td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-outline mg-btn-xs" onclick="openDonorProfile('${d.id}')">${window.t('view')}</button>
          <button class="btn btn-outline mg-btn-xs" onclick="openEditDonor('${d.id}','directory')">${window.t('edit')}</button>
          <button class="btn btn-outline mg-btn-xs mg-btn-danger" onclick="confirmDeleteDonor('${d.id}')">${window.t('delete')}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function donCategoryCards() {
  return DON.categories.map(c => {
    const used = DON.donations.filter(x => x.categoryId === c.id).length;
    return `
    <div class="pj-type-card">
      <div class="pj-type-top">
        <span class="pj-type-icon">${esc(c.icon || '🪙')}</span>
        <div class="pj-type-head">
          <strong>${esc(tData(c.name))}</strong>
          <span class="mg-muted-xs">${c.kind === 'kind' ? window.t('don_kind') : window.t('don_cash')}</span>
        </div>
      </div>
      ${c.description ? `<p class="pj-type-desc">${esc(c.description)}</p>` : ''}
      <div class="pj-type-foot">
        <span class="mg-muted-xs">${used ? used + ' ' + window.t('don_records') : window.t('don_unused')}</span>
        <span class="flex gap-1">
          <button class="btn btn-outline mg-btn-xs" onclick="openEditDonCategory('${c.id}')">${window.t('edit')}</button>
          <button class="btn btn-outline mg-btn-xs mg-btn-danger" onclick="confirmDeleteDonCategory('${c.id}')">${window.t('delete')}</button>
        </span>
      </div>
    </div>`;
  }).join('');
}

/* ------------------------------------------------------------
   DONOR PROFILE
   ------------------------------------------------------------ */
function openDonorProfile(id) { DON.activeDonorId = id; DON.view = 'donor'; renderDonations(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function closeDonorProfile() { DON.activeDonorId = null; DON.view = 'directory'; renderDonations(); }

function viewDonorProfile() {
  const d = donorById(DON.activeDonorId);
  if (!d) { DON.view = 'directory'; return viewDonationsDirectory(); }
  const hist = donationsOfDonor(d.id).slice().sort((a, b) => b.date.localeCompare(a.date));
  const lifetime = hist.filter(x => x.status === 'received').reduce((s, x) => s + donationValue(x), 0);

  return `
  <button class="btn btn-outline mg-back" onclick="closeDonorProfile()">← ${window.t('don_donor_registry')}</button>

  <div class="card mg-profile-card">
    <div class="mg-profile-head">
      <div class="mg-profile-avatar" style="background:var(--primary-maroon)">${esc((donorName(d)[0] || '?').toUpperCase())}</div>
      <div class="mg-profile-id">
        <h2>${esc(donorName(d))}</h2>
        <div class="mg-muted-xs">${esc(d.id)} · ${esc(donorTypeLabel(d))}</div>
        <div class="mg-profile-badges">
          <span class="badge badge-confirmed">₹${lifetime.toLocaleString('en-IN')} ${window.t('don_lifetime')}</span>
          ${d.committee ? `<span class="badge badge-maroon">${esc(tData(d.committee))}</span>` : ''}
        </div>
      </div>
      <div class="mg-profile-actions">
        ${d.mobile ? `<a class="btn btn-outline" href="tel:${esc(d.mobile)}">📞 ${window.t('call')}</a>
        <a class="btn btn-outline" href="https://wa.me/91${esc(d.mobile)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
        <button class="btn btn-outline" onclick="openEditDonor('${d.id}','profile')">${window.t('edit')}</button>
        <button class="btn btn-primary" onclick="openRecordDonation('${d.id}')">+ ${window.t('don_record')}</button>
      </div>
    </div>
    <div class="mg-profile-grid">
      <div><span>${window.t('mobile')}</span><strong>${esc(d.mobile || '—')}</strong></div>
      <div><span>${window.t('city')}</span><strong>${esc(tData(d.city) || '—')}</strong></div>
      <div><span>${window.t('state')}</span><strong>${esc(tData(d.state) || '—')}</strong></div>
      <div><span>PAN</span><strong>${esc(d.pan || '—')}</strong></div>
      ${d.type !== 'individual' ? `<div><span>${window.t('don_contact_person')}</span><strong>${esc(d.contactPerson || '—')}</strong></div>` : ''}
      <div><span>${window.t('don_committee')}</span><strong>${esc(tData(d.committee) || '—')}</strong></div>
    </div>
    ${d.notes ? `<div class="mg-note-box"><strong>${window.t('notes')}:</strong> ${esc(d.notes)}</div>` : ''}
  </div>

  <div class="card mg-mt">
    <div class="card-header"><div class="card-title">${window.t('don_history')} (${hist.length})</div></div>
    <div class="card-body" style="padding:0;">
      ${hist.length ? `<div class="mg-table-scroll"><table class="custom-table pj-reg-table">
        <thead><tr><th>${window.t('don_receipt_no')}</th><th>${window.t('don_category')}</th><th>${window.t('don_given')}</th><th>${window.t('don_value')}</th><th>${window.t('date')}</th><th>${window.t('actions')}</th></tr></thead>
        <tbody>${hist.map(x => `
          <tr>
            <td><strong>${esc(x.receiptNo)}</strong></td>
            <td>${esc(donCatName(x))}</td>
            <td>${esc(donationGiven(x))}</td>
            <td><strong>₹${donationValue(x).toLocaleString('en-IN')}</strong></td>
            <td>${fmtDate(x.date)}</td>
            <td><div class="flex gap-1">
              <button class="btn btn-outline mg-btn-xs" onclick="openDonationReceipt('${x.id}')">🧾</button>
              <button class="btn btn-outline mg-btn-xs" onclick="openDonationCertificate('${x.id}')">🎖</button>
            </div></td>
          </tr>`).join('')}</tbody>
      </table></div>` : `<div class="mg-pad-note">${window.t('don_none')}</div>`}
    </div>
  </div>`;
}

/* ------------------------------------------------------------
   80G RECEIPT  +  DHANYAVAAD CERTIFICATE
   ------------------------------------------------------------ */
function templeEmblemImg(cls) {
  const src = (typeof assetURL === 'function') ? assetURL('assets/icon.png') : 'assets/icon.png';
  return `<img class="${cls}" src="${src}" alt="Shri Vihat Meldi Dham"
    onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:this.className+' don-emblem-fallback',textContent:'🛕'}))">`;
}

function receiptMarkup(x) {
  const d = donorById(x.donorId);
  const c = donCatById(x.categoryId);
  const kind = donationIsKind(x);
  const val = donationValue(x);
  return `
  <div class="don-doc don-receipt">
    <div class="don-doc-frame">
      <div class="don-doc-head">
        ${templeEmblemImg('don-doc-emblem')}
        <div>
          <div class="don-doc-temple">Shri Vihat Meldi Dham</div>
          <div class="don-doc-temple-sub">Sanand, Gujarat &nbsp;·&nbsp; Public Charitable Trust</div>
        </div>
      </div>
      <div class="don-doc-title">Official Donation Receipt</div>

      <div class="don-doc-meta">
        <span>${window.t('don_receipt_no')}: <strong>${esc(x.receiptNo)}</strong></span>
        <span>${window.t('date')}: <strong>${fmtDate(x.date)}</strong></span>
      </div>

      <table class="don-doc-table">
        <tr><td>Received with gratitude from</td><td><strong>${esc(donorName(d))}</strong>${d && d.type !== 'individual' && d.contactPerson ? ' (c/o ' + esc(d.contactPerson) + ')' : ''}</td></tr>
        <tr><td>Address</td><td>${esc([tData(d && d.city), tData(d && d.state)].filter(Boolean).join(', ') || '—')}</td></tr>
        <tr><td>PAN</td><td>${esc(d && d.pan || 'Not provided')}</td></tr>
        <tr><td>Donation category</td><td>${esc(c ? tData(c.name) : '—')}</td></tr>
        <tr><td>${kind ? 'Article donated' : 'Payment mode'}</td><td>${kind ? esc(x.item || '—') + (x.qty ? ' — ' + esc(x.qty) : '') : esc(x.mode)}</td></tr>
        ${x.purpose ? `<tr><td>Earmarked for</td><td>${esc(x.purpose)}</td></tr>` : ''}
      </table>

      <div class="don-doc-amount">
        ${kind
          ? `Estimated value: <strong>₹ ${val.toLocaleString('en-IN')} /-</strong><span class="don-doc-words">(In-kind donation — value as assessed by the Trust)</span>`
          : `<strong>₹ ${val.toLocaleString('en-IN')} /-</strong><span class="don-doc-words">Rupees ${esc(amountInWords(val))} only</span>`}
      </div>

      <div class="don-doc-foot">
        <div>Exempt under Section 80G of the Income-tax Act, 1961.<br>Reg. No. &amp; validity as per the Trust's 80G certificate.</div>
        <div class="don-doc-sign"><span></span>Authorised Signatory / Trustee</div>
      </div>
      <div class="don-doc-note">This is a computer-generated receipt. ${x.notes ? esc(x.notes) : ''}</div>
    </div>
  </div>`;
}

function certificateMarkup(x) {
  const d = donorById(x.donorId);
  const c = donCatById(x.categoryId);
  const kind = donationIsKind(x);
  const val = donationValue(x);
  const certNo = x.certNo || nextCertNo();
  return `
  <div class="don-doc don-cert">
    <span class="don-cert-corner c-tl"></span><span class="don-cert-corner c-tr"></span>
    <span class="don-cert-corner c-bl"></span><span class="don-cert-corner c-br"></span>
    <img class="don-cert-hero" src="${(typeof assetURL === 'function') ? assetURL('assets/temple.png') : 'assets/temple.png'}" alt="" aria-hidden="true" onerror="this.style.display='none'">
    <div class="don-cert-frame">
      ${templeEmblemImg('don-cert-emblem')}
      <div class="don-cert-temple">Shri Vihat Meldi Dham</div>
      <div class="don-cert-temple-sub">Sanand, Gujarat</div>

      <div class="don-cert-ribbon">॥ ધન્યવાદ પ્રમાણપત્ર ॥</div>
      <div class="don-cert-ribbon-en">Certificate of Appreciation</div>

      <p class="don-cert-body">This is to gratefully acknowledge that</p>
      <h1 class="don-cert-name">${esc(donorName(d))}</h1>
      ${d && d.type !== 'individual' && d.contactPerson ? `<div class="don-cert-sub">represented by ${esc(d.contactPerson)}</div>` : ''}
      ${d && (d.city || d.committee) ? `<div class="don-cert-sub">${esc([tData(d.city), tData(d.committee)].filter(Boolean).join(' · '))}</div>` : ''}

      <p class="don-cert-body">has, with deep devotion, offered to the mandir</p>
      <div class="don-cert-gift">
        ${kind ? esc(x.item || 'An article of value') : '₹ ' + val.toLocaleString('en-IN') + ' /-'}
        ${kind && x.qty ? `<span class="don-cert-gift-sub">${esc(x.qty)}</span>` : ''}
        ${kind ? `<span class="don-cert-gift-sub">Assessed value ₹ ${val.toLocaleString('en-IN')}</span>` : `<span class="don-cert-gift-sub">Rupees ${esc(amountInWords(val))} only</span>`}
      </div>
      <div class="don-cert-cat">${esc(c ? (c.icon || '') + ' ' + tData(c.name) : '')}${x.purpose ? ' — ' + esc(x.purpose) : ''} · ${fmtDate(x.date)}</div>

      <p class="don-cert-bless">
        માતાજી આપને અને આપના પરિવારને સુખ, સમૃદ્ધિ અને આરોગ્ય પ્રદાન કરે.<br>
        <strong>ખમ્મા માડી, ખમ્મા 🙏</strong>
      </p>

      <div class="don-cert-foot">
        <div class="don-cert-sign"><span></span>President / Trustee</div>
        <div class="don-cert-seal">Trust Seal</div>
        <div class="don-cert-sign"><span></span>Secretary</div>
      </div>
      <div class="don-cert-no">Certificate No: ${esc(certNo)} · Receipt: ${esc(x.receiptNo)}</div>
    </div>
  </div>`;
}

let _donViewer = null;   // { type:'receipt'|'cert', id }

function openDonationReceipt(id) {
  const x = donationById(id);
  if (!x) return;
  const box = document.getElementById('receiptContent');
  document.getElementById('receiptViewerTitle').textContent = window.t('don_receipt_title');
  box.className = 'modal-body don-doc-viewer';
  box.innerHTML = receiptMarkup(x);
  _donViewer = { type: 'receipt', id };
  openModal('modalReceiptViewer');
}

function openDonationCertificate(id) {
  const x = donationById(id);
  if (!x) return;
  if (!x.certNo) {
    x.certNo = nextCertNo();
    if (window.API && window.API.online && !!x.code) {
      window.API.post('/donations/' + (x.code || x.id) + '/certificate')
        .then(function (dto) { if (dto && dto.certNo) x.certNo = dto.certNo; renderDonations(); })
        .catch(function () {});
    }
  }
  x.certificateIssued = true;
  const box = document.getElementById('receiptContent');
  document.getElementById('receiptViewerTitle').textContent = window.t('don_cert_title');
  box.className = 'modal-body don-doc-viewer';
  box.innerHTML = certificateMarkup(x);
  _donViewer = { type: 'cert', id };
  openModal('modalReceiptViewer');
  if (DON.view === 'directory') renderDonations();
}

function printCurrentDonationDoc() {
  if (!_donViewer) { window.print(); return; }
  const x = donationById(_donViewer.id);
  if (!x) return;
  if (_donViewer.type === 'cert') printDonationHTML(certificateMarkup(x), 'don-print-cert');
  else printDonationHTML(receiptMarkup(x), 'don-print-receipt');
}

function printDonationHTML(inner, sizeClass) {
  if (typeof openPrintDoc !== 'function') { donToast('Print service unavailable.'); return; }
  const isCert = /cert/.test(sizeClass || '');
  openPrintDoc({
    title: 'Temple Document',
    wrapClass: 'don-print-wrap ' + (sizeClass || ''),
    inner: inner,
    css:
      '.don-print-wrap{display:flex;justify-content:center;padding:16px;background:#f2ece0}' +
      '@media print{' +
        '@page{size:' + (isCert ? '297mm 210mm' : '210mm 297mm') + ';margin:0}' +
        'body{background:#fff}' +
        '.don-print-wrap{display:block;padding:0;background:#fff}' +
        '.don-doc{margin:0 auto !important;box-shadow:none !important;border-radius:0 !important;' +
          'break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        (isCert
          ? '.don-doc.don-cert{width:297mm !important;height:210mm !important;aspect-ratio:auto !important}'
          : '.don-doc.don-receipt{width:210mm !important;min-height:auto !important}') +
      '}'
  });
}

function donationsExport() {
  return {
    filename: 'donations-register',
    title: window.t('don_register', 'Donation Register'),
    subtitle: window.t('don_sub', 'Cash & in-kind offerings'),
    columns: ['Receipt No', 'Cert No', 'Donor', 'Donor Type', 'Category', 'Kind', 'Given', 'Value (INR)', 'Mode', 'Date', 'Status', 'Purpose'],
    rows: filteredDonations().map(x => {
      const d = donorById(x.donorId);
      const c = donCatById(x.categoryId);
      return [x.receiptNo, x.certNo || '', donorName(d), donorTypeLabel(d), c ? tData(c.name) : '',
        c && c.kind === 'kind' ? 'In-kind' : 'Cash', donationGiven(x), donationValue(x),
        x.mode, x.date, x.status, x.purpose || ''];
    })
  };
}
if (typeof registerExport === 'function') registerExport('mod-donations', donationsExport);
function exportDonationsCSV() { if (typeof runExport === 'function') runExport('mod-donations', 'csv'); }
