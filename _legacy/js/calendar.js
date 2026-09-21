/* ============================================================
   UNIFIED TEMPLE CALENDAR
   Aggregates dated items from every module into one month grid.
   Loaded LAST. Renders into #calendarRoot.
   ============================================================ */

if (typeof window !== 'undefined' && typeof window.t !== 'function') {
  window.t = function (k, f) { return f != null ? f : k; };
  window.onLanguageChange = function () {};
}

const CAL = {
  year: 2026,
  month: 8,           // 0-indexed (September)
  filters: { annual: true, donation: true, visit: true }
};
(function () {
  const iso = '2026-09-06';
  const p = iso.split('-').map(Number);
  CAL.year = p[0]; CAL.month = p[1] - 1;
})();

function calToday() { return '2026-09-06'; }

/* Which entry categories this viewer may see.
   Admin / superadmin / demo  → everything.
   Any scoped persona or limited login (accountant) → only the temple-wide
   programme: annual Tithi events. Donation pledges and Bhuvaji visits stay
   private to the admin view. */
var CAL_PUBLIC_TYPES = ['annual'];
function calRestricted() {
  return (typeof currentAllowedPages === 'function') && currentAllowedPages() !== null;
}
function calAllowedTypes() {
  return calRestricted() ? CAL_PUBLIC_TYPES.slice()
                         : ['annual', 'donation', 'visit'];
}

/* ---- localisation: delegate to the shared i18n.js helpers (locDate / locTime
   / locNum / locMonthYear) so every calendar in the app formats the same way ---- */
function calD(v) { return (typeof tData === 'function') ? tData(v == null ? '' : v) : (v == null ? '' : v); }
function calDate(iso) { return (typeof locDate === 'function') ? locDate(iso) : String(iso || ''); }
function calTime(t) { return (typeof locTime === 'function') ? locTime(t) : String(t || ''); }
function calNum(n) { return (typeof locNum === 'function') ? locNum(n) : String(n || 0); }
function calMonthLabel(y, mo) { return (typeof locMonthYear === 'function') ? locMonthYear(y, mo) : (y + '-' + (mo + 1)); }

/** Collect every dated item for the given YYYY-MM. */
function calEntries(monthKey) {
  const out = [];
  const inMonth = d => typeof d === 'string' && d.indexOf(monthKey) === 0;

  // Annual temple Tithi / important events — resolved for the viewed year
  if (CAL.filters.annual && typeof ANNUAL !== 'undefined' && Array.isArray(ANNUAL.events)) {
    const yr = parseInt(monthKey.slice(0, 4), 10);
    ANNUAL.events.forEach(ev => {
      if (ev.active === false) return;
      const r = (typeof annualResolve === 'function') ? annualResolve(ev, yr) : null;
      if (!r || !r.date || !inMonth(r.date)) return;
      out.push({
        date: r.date, time: '', type: 'annual', color: '#8A2B39', scopeId: ev.id,
        title: (typeof annualName === 'function' ? annualName(ev) : ev.name),
        sub: (typeof annualActivity === 'function' ? annualActivity(ev) : ev.activity) +
             ' · ' + (typeof annualTithiLabel === 'function' ? annualTithiLabel(ev) : ''),
        go: () => { if (typeof switchPage === 'function') switchPage('events'); }
      });
    });
  }
  // Dhaja Pooja sponsorships with a scheduled / performed date
  if (CAL.filters.dhaja && typeof DHAJA !== 'undefined' && Array.isArray(DHAJA.sponsorships)) {
    DHAJA.sponsorships.forEach(s => {
      if (s.status === 'cancelled') return;
      const d = s.performedDate || s.scheduledDate;
      if (!inMonth(d)) return;
      const c = (typeof dhajaCampaignById === 'function') ? dhajaCampaignById(s.campaignId) : null;
      out.push({
        date: d, time: '', type: 'dhaja', color: '#B8860B', scopeId: s.campaignId,
        title: calD(s.sponsorName || window.t('dhaja_title', 'Dhaja Pooja')),
        sub: (s.seqNo ? '#' + s.seqNo + ' · ' : '') + (c ? calD(c.name) : window.t('dhaja_title', 'Dhaja Pooja')),
        go: () => { if (typeof switchPage === 'function') switchPage('dhaja'); }
      });
    });
  }
  // Donation pledges awaiting realisation
  if (CAL.filters.donation && typeof DON !== 'undefined' && Array.isArray(DON.donations)) {
    DON.donations.forEach(x => {
      if (x.status !== 'pledged' || !inMonth(x.date)) return;
      const d = (typeof donorById === 'function') ? donorById(x.donorId) : null;
      out.push({
        date: x.date, time: '', type: 'donation', color: '#C9A24A',
        title: calD(typeof donorName === 'function' ? donorName(d) : 'Donor') + ' — ₹ ' + calNum((typeof donationValue === 'function' ? donationValue(x) : x.amount) || 0),
        sub: window.t('cal_pledge', 'Pledged donation') + (x.purpose ? ' · ' + calD(x.purpose) : ''),
        go: () => { if (typeof switchPage === 'function') switchPage('donations'); }
      });
    });
  }
  // Visits
  if (CAL.filters.visit && typeof VISITS !== 'undefined' && Array.isArray(VISITS.list)) {
    VISITS.list.forEach(v => {
      if (!inMonth(v.date)) return;
      out.push({
        date: v.date, time: v.time || '', type: 'visit', color: '#4C8B5A',
        title: calD(v.devoteeName) + ' — ' + (typeof visitPurposeLabel === 'function' ? visitPurposeLabel(v.purpose) : v.purpose),
        sub: (v.time ? calTime(v.time) + ' · ' : '') + calD(v.address || v.city || ''),
        go: () => { if (typeof switchPage === 'function') switchPage('visits'); }
      });
    });
  }

  out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  return out;
}

const CAL_TYPE_META = {
  pooja:     { key: 'cal_poojas',     def: '🪔 Poojas',    badge: 'badge-maroon' },
  committee: { key: 'cal_meetings',   def: '🏛️ Meetings',  badge: 'badge-pending' },
  event:     { key: 'cal_events',     def: '📅 Events',     badge: 'badge-pending' },
  annual:    { key: 'cal_annual',     def: '🗓️ Annual',    badge: 'badge-maroon' },
  dhaja:     { key: 'cal_dhaja',      def: '🚩 Dhaja',     badge: 'badge-maroon' },
  donation:  { key: 'cal_donations',  def: '💰 Pledges',   badge: 'badge-confirmed' },
  visit:     { key: 'cal_visits',     def: '🙏 Visits',    badge: 'badge-confirmed' }
};

function shiftCalMonth(delta) {
  let m = CAL.month + delta, y = CAL.year;
  if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
  CAL.month = m; CAL.year = y;
  renderUnifiedCalendar();
}
function toggleCalFilter(type) {
  if (calAllowedTypes().indexOf(type) === -1) return;   // not visible to this viewer
  CAL.filters[type] = !CAL.filters[type];
  renderUnifiedCalendar();
}
function calGoto(idx) {
  const e = renderUnifiedCalendar._entries && renderUnifiedCalendar._entries[idx];
  if (e && typeof e.go === 'function') e.go();
}
/** Grid day cell "+N more" chip -> scroll down to that day's full entry in
    the readable agenda list below (the grid cell itself is too small to
    show every item's title/time on a phone). */
function calJumpToDay(iso) {
  const el = document.getElementById('cal-day-' + iso);
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderUnifiedCalendar() {
  const root = document.getElementById('calendarRoot');
  if (!root) return;
  const MON = (typeof MONTHS !== 'undefined') ? MONTHS : ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const y = CAL.year, mo = CAL.month;
  const monthKey = y + '-' + String(mo + 1).padStart(2, '0');
  const daysIn = new Date(y, mo + 1, 0).getDate();
  const startDow = (new Date(y, mo, 1).getDay() + 6) % 7;   // Monday-first

  // clamp the filters to what this viewer is allowed to see
  const allowedTypes = calAllowedTypes();
  Object.keys(CAL.filters).forEach(k => { if (allowedTypes.indexOf(k) === -1) CAL.filters[k] = false; });

  const entries = calEntries(monthKey);
  renderUnifiedCalendar._entries = entries;

  const dowNames = [
    window.t('cal_mon', 'Mon'), window.t('cal_tue', 'Tue'), window.t('cal_wed', 'Wed'),
    window.t('cal_thu', 'Thu'), window.t('cal_fri', 'Fri'), window.t('cal_sat', 'Sat'), window.t('cal_sun', 'Sun')
  ];
  const todayDow = (typeof todayDowIndex === 'function') ? todayDowIndex(y, mo, calToday()) : -1;

  // cap chips per day so a busy day doesn't blow out the cell (esp. on a
  // phone, where the 7-col grid stays visible now instead of hiding); the
  // rest are one tap away via the "+N more" chip -> the readable agenda list.
  const MAX_CHIPS_PER_DAY = 3;
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += `<div class="mg-cal-cell mg-cal-empty"></div>`;
  for (let d = 1; d <= daysIn; d++) {
    const iso = monthKey + '-' + String(d).padStart(2, '0');
    const dayE = entries.map((e, i) => ({ e, i })).filter(x => x.e.date === iso);
    const shown = dayE.slice(0, MAX_CHIPS_PER_DAY);
    const overflow = dayE.length - shown.length;
    cells += `<div class="mg-cal-cell ${iso === calToday() ? 'mg-cal-today' : ''}">
      <div class="mg-cal-date">${d}${iso === calToday() ? `<span class="mg-cal-todaytag">${window.t('today')}</span>` : ''}</div>
      ${shown.map(x => `<div class="mg-cal-event cal-ev-${x.e.type}" style="--c:${x.e.color}" onclick="calGoto(${x.i})" title="${(x.e.title || '').replace(/"/g, '&quot;')}">
        <div class="mg-ev-title">${escCal(x.e.title)}</div>
        <div class="mg-ev-meta">${escCal(x.e.sub)}</div>
      </div>`).join('')}
      ${overflow > 0 ? `<div class="cal-more-chip" onclick="calJumpToDay('${iso}')">+${calNum(overflow)} ${window.t('cal_more', 'more')}</div>` : ''}
    </div>`;
  }
  const trail = (7 - ((startDow + daysIn) % 7)) % 7;
  for (let i = 0; i < trail; i++) cells += `<div class="mg-cal-cell mg-cal-empty"></div>`;

  const legend = allowedTypes.filter(type => CAL_TYPE_META[type]).map(type => {
    const m = CAL_TYPE_META[type];
    return `<button class="cal-legend-btn ${CAL.filters[type] ? 'on' : 'off'}" onclick="toggleCalFilter('${type}')">
      <span class="cal-legend-dot cal-ev-${type}"></span>${window.t(m.key, m.def)}</button>`;
  }).join('');

  const upNext = entries.filter(e => e.date >= calToday()).slice(0, 6);

  /* Agenda list — the readable calendar on a phone (the 7-column grid is far
     too cramped below ~720px). Whole month, grouped by day, tap to open. */
  const monthSorted = entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.date + (a.e.time || '')).localeCompare(b.e.date + (b.e.time || '')));
  let agenda = '', lastDay = '';
  monthSorted.forEach(({ e, i }) => {
    if (e.date !== lastDay) {
      lastDay = e.date;
      const isT = e.date === calToday();
      agenda += `<li id="cal-day-${e.date}" class="cal-agenda-day${isT ? ' is-today' : ''}">${calDate(e.date)}${isT ? ` <span class="mg-cal-todaytag">${window.t('today')}</span>` : ''}</li>`;
    }
    const m = CAL_TYPE_META[e.type] || { badge: 'badge-maroon', key: '', def: e.type };
    agenda += `<li class="cal-agenda-item cal-ev-${e.type}" style="--c:${e.color}" onclick="calGoto(${i})">
      <span class="cal-agenda-dot"></span>
      <span class="cal-agenda-tx">
        <strong>${escCal(e.title)}</strong>
        <span>${escCal(e.sub)}</span>
        <span class="badge ${m.badge} cal-agenda-badge">${window.t(m.key, m.def)}</span>
      </span>
    </li>`;
  });

  root.innerHTML = `
  <div class="flex justify-between items-center mg-page-head">
    <div>
      <h1 class="banner-title mg-page-title">🗓️ ${window.t('cal_title', 'Unified Temple Calendar')}</h1>
      <p class="mg-page-sub">${calRestricted()
        ? window.t('cal_sub_public', 'Poojas, events and annual Tithi dates across the temple')
        : window.t('cal_sub', 'Poojas, committee meetings, events, pledges and visits — all in one place')}</p>
    </div>
    <div class="flex gap-2 items-center">
      <button class="btn btn-outline mg-btn-xs" onclick="shiftCalMonth(-1)">← ${window.t('back')}</button>
      <strong class="mg-cal-label">${calMonthLabel(y, mo)}</strong>
      <button class="btn btn-outline mg-btn-xs" onclick="shiftCalMonth(1)">${window.t('cal_next', 'Next')} →</button>
    </div>
  </div>

  <div class="cal-legend">${legend}</div>

  <div class="card mg-mt cal-grid-view">
    <div class="card-body">
      <div class="mg-cal-head">${dowNames.map((x, i) => `<div class="${i === todayDow ? 'mg-cal-dow-today' : ''}">${x}</div>`).join('')}</div>
      <div class="mg-cal-grid">${cells}</div>
    </div>
  </div>

  <div class="card mg-mt cal-agenda-view">
    <div class="card-header"><div class="card-title">🗓️ ${window.t('cal_agenda', 'This month')} <span class="mg-muted-xs">(${monthSorted.length})</span></div></div>
    <div class="card-body" style="padding:0;">
      ${monthSorted.length ? `<ul class="cal-agenda">${agenda}</ul>` : `<div class="mg-pad-note">${window.t('cal_nothing', 'Nothing scheduled this month.')}</div>`}
    </div>
  </div>

  <div class="card mg-mt cal-upnext-view">
    <div class="card-header"><div class="card-title">${window.t('cal_up_next', 'Up Next')}</div></div>
    <div class="card-body" style="padding:0;">
      ${upNext.length ? `<div class="mg-table-scroll"><table class="custom-table">
        <thead><tr><th>${window.t('date')}</th><th>${window.t('cal_item', 'Item')}</th><th>${window.t('cal_type', 'Type')}</th><th></th></tr></thead>
        <tbody>${upNext.map(e => {
          const idx = entries.indexOf(e);
          return `<tr>
            <td>${calDate(e.date)}</td>
            <td><strong>${escCal(e.title)}</strong><div class="mg-muted-xs">${escCal(e.sub)}</div></td>
            <td><span class="badge ${CAL_TYPE_META[e.type].badge}">${window.t(CAL_TYPE_META[e.type].key, CAL_TYPE_META[e.type].def)}</span></td>
            <td><button class="btn btn-outline mg-btn-xs" onclick="calGoto(${idx})">${window.t('open')}</button></td>
          </tr>`;
        }).join('')}</tbody></table></div>` : `<div class="mg-pad-note">${window.t('cal_nothing', 'Nothing scheduled this month.')}</div>`}
    </div>
  </div>`;
}

function escCal(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('calendarRoot')) return;
  renderUnifiedCalendar();
  if (typeof onLanguageChange === 'function') onLanguageChange(() => renderUnifiedCalendar());
});
