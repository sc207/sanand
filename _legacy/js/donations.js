/* ============================================================
   DONATIONS MODULE — cash & in-kind offerings, 80G receipts,
   Dhanyavaad certificates
   Shri Vihat Meldi Dham
   ------------------------------------------------------------
   A devotee / company / trust donates money OR an article
   (cow, gold paghadi, diamond jewellery, grain, construction
   material, …). Every record can issue an Official 80G Receipt
   and a printable Dhanyavaad (thank-you) Certificate.
   Reuses globals: esc, jsq, fmtDate, nextId, MONTHS, kpiCard,
   emptyState, openSheet, openConfirm, downloadCSV, showToast,
   openModal, closeModal, t, tData.
   ============================================================ */

/* Resilience shim if i18n.js did not load */
if (typeof window !== 'undefined' && typeof window.t !== 'function') {
  window.t = function (k, f) { return f != null ? f : k; };
  window.tData = function (v) { return v == null ? '' : v; };
  window.onLanguageChange = function () {};
}

const DON = {
  view: 'directory',            // 'directory' | 'donor'
  activeDonorId: null,
  editingDonationId: null,
  editingDonorId: null,
  editingCatId: null,
  filterMonth: 'all',
  filterCat: 'all',
  filterStatus: 'all',
  search: '',
  today: (typeof mgRealDate === 'function') ? mgRealDate() : '2026-09-06',

  /* --- Donation categories (admin-managed) --------------- */
  categories: [
    { id:'DCT-001', name:'General Donation',        kind:'cash', icon:'🪙', description:'Unrestricted offering to the mandir.' },
    { id:'DCT-002', name:'Temple Renovation',       kind:'cash', icon:'🏗️', description:'Towards construction & restoration work.' },
    { id:'DCT-003', name:'Annadan / Bhojan Seva',   kind:'cash', icon:'🍲', description:'Community meal / prasad fund.' },
    { id:'DCT-004', name:'Pooja / Seva Booking',    kind:'cash', icon:'🪔', description:'Sponsored pooja or seva.' },
    { id:'DCT-005', name:'Gau Daan (Cow)',          kind:'kind', icon:'🐄', description:'Donation of a cow to the temple gaushala.' },
    { id:'DCT-006', name:'Suvarna Daan (Gold)',     kind:'kind', icon:'🥇', description:'Gold ornaments, paghadi, chhatra, kalash.' },
    { id:'DCT-007', name:'Rajat Daan (Silver)',     kind:'kind', icon:'🪙', description:'Silver articles and utensils.' },
    { id:'DCT-008', name:'Ratna / Jewellery',       kind:'kind', icon:'💍', description:'Diamond & precious-stone jewellery.' },
    { id:'DCT-009', name:'Anna Daan (Grain)',       kind:'kind', icon:'🌾', description:'Rice, wheat, ghee, pulses for the bhandar.' },
    { id:'DCT-010', name:'Construction Material',    kind:'kind', icon:'🧱', description:'Cement, marble, steel, timber.' }
  ],

  /* --- Donor registry (individual / company / trust) ----- */
  donors: [],

  /* --- Donation records --------------------------------- */
  donations: []
};

/* ------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------ */
function donToday() { return (typeof MG !== 'undefined' && MG.today) ? MG.today : DON.today; }
function donToast(m) { if (typeof showToast === 'function') showToast(m); }

const donCatById   = id => DON.categories.find(c => c.id === id);
const donorById    = id => DON.donors.find(d => d.id === id);
const donationById = id => DON.donations.find(x => x.id === id);

function donorName(d) {
  if (!d) return 'Unknown';
  if (d.type === 'individual') return ((d.firstName || '') + ' ' + (d.lastName || '')).trim() || 'Unnamed';
  return d.orgName || 'Unnamed organisation';
}
function donorTypeLabel(d) {
  return d && d.type === 'trust' ? 'Trust / Foundation'
       : d && d.type === 'organization' ? 'Company'
       : 'Individual';
}
function donorSubline(d) {
  if (!d) return '';
  const bits = [];
  if (d.type !== 'individual' && d.contactPerson) bits.push('c/o ' + d.contactPerson);
  if (d.city) bits.push(tData(d.city));
  if (d.committee) bits.push(tData(d.committee));
  return bits.join(' · ');
}

/** ₹ value of a donation: cash amount, or estimated valuation for in-kind. */
function donationValue(x) {
  if (!x) return 0;
  const c = donCatById(x.categoryId);
  return (c && c.kind === 'kind') ? (Number(x.valuation) || 0) : (Number(x.amount) || 0);
}
function donationIsKind(x) {
  const c = donCatById(x && x.categoryId);
  return !!(c && c.kind === 'kind');
}
/** Human description of what was given. */
function donationGiven(x) {
  if (donationIsKind(x)) {
    return (x.item || 'In-kind article') + (x.qty ? ' (' + x.qty + ')' : '');
  }
  return '₹' + (Number(x.amount) || 0).toLocaleString('en-IN');
}

const donationsOfDonor = donorId => DON.donations.filter(x => x.donorId === donorId);

function donMonthKeyOf(x) { return (x.date || '').slice(0, 7); }

function donCatName(x) {
  const c = donCatById(x && x.categoryId || x);
  return c ? tData(c.name) : '—';
}

/** Next running receipt / certificate number for the current year. */
function nextReceiptNo() {
  const yr = donToday().slice(0, 4);
  let max = 100;
  DON.donations.forEach(x => {
    const m = String(x.receiptNo || '').match(/REC-\d{4}-(\d+)/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return 'REC-' + yr + '-' + (max + 1);
}
function nextCertNo() {
  const yr = donToday().slice(0, 4);
  let max = 0;
  DON.donations.forEach(x => {
    const m = String(x.certNo || '').match(/CERT-\d{4}-(\d+)/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  return 'CERT-' + yr + '-' + String(max + 1).padStart(3, '0');
}

/** Amount in words (Indian system) — used on the receipt. */
function amountInWords(num) {
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = n => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  const three = n => {
    const h = Math.floor(n / 100), r = n % 100;
    return (h ? ones[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : '');
  };
  const parts = [];
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thou = Math.floor(num / 1000); num %= 1000;
  const hund = num;
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(three(lakh) + ' Lakh');
  if (thou) parts.push(three(thou) + ' Thousand');
  if (hund) parts.push(three(hund));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/* Month options for the filter (last few + all) */
function donMonthOptions() {
  const set = {};
  DON.donations.forEach(x => { const k = donMonthKeyOf(x); if (k) set[k] = true; });
  const keys = Object.keys(set).sort().reverse();
  return keys;
}
