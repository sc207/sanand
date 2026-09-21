/* ============================================================
   SHRI VISAT MELDI MATA MANDIR — DIVINE MANDALA JAVASCRIPT ENGINE
   ============================================================ */

// Master State Store
const state = {
  activePage: 'dashboard',
  roleScope: 'admin',
  // Admin/superadmin "view as" preview — a ROLE_META key (e.g. 'accountant'),
  // set only when no specific-person module scope (CMT/POOJA/MG session) is
  // active. See changeRoleScope().
  previewRole: null,
  currentLang: 'en',

  // Devotees Register (Central Person Model)
  devotees: [],
  
  // Financial Donations Log — superseded by the Donations module (donations.js)
  donations: [],

};

// Initialize Application Engine
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  applySessionChrome();
  initCharts();
  renderCalendar();
  injectMandalaDecorations();
});

// Setup Navigation & Router
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page');
      if (pageId) {
        switchPage(pageId);
      }
    });
  });

  const toggleBtn = document.getElementById('toggleSidebar');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleSidebarMenu);
  }
}

function toggleSidebarMenu() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}

/**
 * Pages the currently active session may open.
 * Returns null for an unrestricted (admin / core-team) session, otherwise
 * the allow-list for the one restricted module scope that is active.
 * Kept here (not in a module -ui.js) so switchPage can enforce it centrally.
 */
function currentAllowedPages() {
  // ROLE_META (people.js) via rolePages() — the single source of truth every
  // branch below reads from, so none of them can drift from what a real
  // login with that role actually sees. '' falls back to a hardcoded list
  // only for legacy/offline harnesses where people.js never loaded.
  var rp = function (role, fallback) {
    return (typeof rolePages === 'function' && rolePages(role).length) ? rolePages(role) : fallback;
  };
  // Preview personas (topbar "view as" switcher), most specific first.
  // 2) a generic "what would this role see" preview — page-shape only, no
  //    specific person's data (also covers the "specific Accountant" preview,
  //    which personalises the toast/topbar name only — accountant has no
  //    ownable data of its own to scope).
  if (state.previewRole && typeof rolePages === 'function') {
    var pr = rolePages(state.previewRole);
    if (pr.length) return pr.slice();
  }
  // Real signed-in session — honour the page list the backend computed for this
  // user's roles (accountant, event_incharge, committee_leader, …). '*' or no
  // backend (demo mode) → unrestricted.
  var s = (typeof window !== 'undefined' && window.__SESSION) || null;
  if (s && Array.isArray(s.pages) && s.pages.length && s.pages.indexOf('*') === -1) {
    return s.pages.slice();
  }
  return null;
}

/** True while the admin/superadmin "view as" switcher is previewing a
 * restricted role — either a specific person's module scope, or a generic
 * role-shape preview. */
function isPreviewActive() {
  return !!state.previewRole;
}

/* Trim the sidebar / mobile nav to what the active session/preview may
   actually open, and bounce off any forbidden page. Runs once at boot for a
   real signed-in session, and again on every "view as" change so a preview
   stays live. No-op (fully open) for admins and demo mode. */
function applySessionChrome() {
  var allowed = currentAllowedPages();
  var preview = isPreviewActive();
  // The "view as" switcher is an admin-only tool — hide it only for a REAL
  // restricted login. Never hide it while the admin is merely previewing
  // one, or they would lose the only way back to "My view — full access".
  var sw = document.getElementById('viewSwitchWrap');
  if (sw) sw.style.display = (allowed && !preview) ? 'none' : '';
  document.querySelectorAll('.nav-item[data-page], .mobile-nav-item[data-page]').forEach(function (el) {
    el.style.display = (allowed && allowed.indexOf(el.getAttribute('data-page')) === -1) ? 'none' : '';
  });
  // the sidebar nav is flat: a .nav-group-title followed by its .nav-items as
  // siblings. Hide a heading when every item under it is now hidden. (This
  // also correctly RE-SHOWS everything when allowed goes back to null, e.g.
  // the admin switching a preview back to "My view — full access".)
  document.querySelectorAll('.sidebar-nav .nav-group-title').forEach(function (title) {
    var anyVisible = false;
    for (var n = title.nextElementSibling; n && !n.classList.contains('nav-group-title'); n = n.nextElementSibling) {
      if (n.classList.contains('nav-item') && n.style.display !== 'none') { anyVisible = true; break; }
    }
    title.style.display = anyVisible ? '' : 'none';
  });
  if (allowed && allowed.indexOf(state.activePage || 'dashboard') === -1) switchPage('dashboard');
}

/** True when the active session is allowed to open pageId. */
function canOpenPage(pageId) {
  const allowed = currentAllowedPages();
  return !allowed || allowed.indexOf(pageId) !== -1;
}

function switchPage(pageId) {
  // Central access guard — a scoped leader/coordinator can never be routed
  // (via a dashboard shortcut, calendar item, deep link, etc.) into a module
  // they are not authorised for.
  if (!canOpenPage(pageId)) {
    if (typeof showToast === 'function') showToast('You do not have access to that section.');
    pageId = 'dashboard';
  }
  state.activePage = pageId;

  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
    if (el.getAttribute('data-page') === pageId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  document.querySelectorAll('.page').forEach(page => {
    if (page.id === `page-${pageId}`) {
      page.classList.add('active');
    } else {
      page.classList.remove('active');
    }
  });

  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Admin/superadmin "view as" preview switcher.
// Only ONE restricted scope is ever active at a time — either a specific
// person's module scope (Committee Leader / Pooja Coordinator / Management
// Lead, which also filters that module's own data) or a generic role-shape
// preview (state.previewRole, page-list only, for roles with no per-module
// scoped session of their own, e.g. Accountant / Event In-charge). Every
// other scope is reset FIRST (silently), the target is activated LAST, and
// applySessionChrome() is called before navigating so the nav reflects the
// new scope immediately.
function changeRoleScope(role) {
  state.roleScope = role;
  state.previewRole = null;

  if (role === 'admin') {
    showToast('Context switched to: Super Admin (Full Platform)');
    applySessionChrome();
    if (typeof renderDashboard === 'function') renderDashboard();
    switchPage('dashboard');
    return;
  }

  // Accountant scope — a specific person. Accountant has no ownable data of
  // its own to filter by (temple-wide by design — donations aren't assigned
  // to one accountant), so this only personalises the toast/topbar name on
  // top of the same page-shape as the generic Accountant preview.
  if (role.indexOf('acct:') === 0) {
    const id = role.slice(5);
    const a = (typeof accountById === 'function') ? accountById(id) : null;
    const name = (a && a.name) || 'Temple Accountant';
    state.previewRole = 'accountant';
    const nameEl = document.getElementById('topbarUserName');
    if (nameEl) nameEl.textContent = name;
    showToast(`Context switched to: ${name} (Temple Accountant)`);
    applySessionChrome();
    if (typeof renderDashboard === 'function') renderDashboard();
    switchPage('donations');
    return;
  }

  // Generic "what would this role see" preview — page-shape only, driven by
  // ROLE_META (people.js) via rolePages() so it can never drift from what a
  // real login with that role actually sees.
  const GENERIC_ROLE = {
    accountant: { key: 'accountant', label: 'Temple Accountant', landing: 'donations' },
  };
  const g = GENERIC_ROLE[role];
  if (g && typeof rolePages === 'function' && rolePages(g.key).length) {
    state.previewRole = g.key;
    showToast(`Context switched to: ${g.label}`);
    applySessionChrome();
    if (typeof renderDashboard === 'function') renderDashboard();
    switchPage(g.landing);
    return;
  }

  // Unknown value — fall back to the admin's own unrestricted view.
  showToast('Context switched to: Super Admin (Full Platform)');
  applySessionChrome();
  if (typeof renderDashboard === 'function') renderDashboard();
  switchPage('dashboard');
}


// Trilingual layer lives in i18n.js (window.setLanguage / t / tData).
// This wrapper keeps older callers working and syncs state.currentLang.
function changeLanguage(lang) {
  state.currentLang = lang;
  if (typeof setLanguage === 'function') setLanguage(lang);
}

// Devotees are handled by the Devotees 360° module (devotees.js).
// Donations are handled by the Donations module (donations*.js).

// Modal Management
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

/* Auth is a real page now (public/login.html + Google Sign-In). The in-app
   "Sign in" button and the user menu route here to end the session. */
function signOut() {
  try {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(function () { window.location.href = '/login'; });
  } catch (e) { window.location.href = '/login'; }
}

/* Top-bar account menu (the only sign-out affordance in the header). */
function toggleUserMenu(ev) {
  if (ev) ev.stopPropagation();
  var pop = document.getElementById('userMenuPop');
  var btn = document.getElementById('userMenuBtn');
  if (!pop || !btn) return;
  if (pop.hidden) {
    // position:fixed has no positioning parent, so anchor it to the
    // button's real screen position on every open (see styles.css for why
    // it's fixed, not absolute).
    var r = btn.getBoundingClientRect();
    pop.style.top = (r.bottom + 8) + 'px';
    pop.style.right = (window.innerWidth - r.right) + 'px';
  }
  pop.hidden = !pop.hidden;
}
document.addEventListener('click', function (ev) {
  var pop = document.getElementById('userMenuPop');
  var btn = document.getElementById('userMenuBtn');
  if (pop && !pop.hidden && btn && !btn.contains(ev.target)) pop.hidden = true;
});

/* Fill the account menu (and the top-bar name) from the real signed-in user. */
function initAccountMenu() {
  var s = (typeof window !== 'undefined' && window.__SESSION) || null;
  var u = s && s.user;
  var emailEl = document.getElementById('userMenuEmail');
  var nameEl = document.getElementById('topbarUserName');
  if (u) {
    if (emailEl) emailEl.textContent = u.email || '';
    if (nameEl && u.name) nameEl.textContent = u.name;
    if (s.impersonating && emailEl) emailEl.textContent = (u.email || '') + '  (impersonating)';
  } else {
    if (emailEl) emailEl.textContent = 'Demo mode — no backend';
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAccountMenu);
} else {
  initAccountMenu();
}

function openBadgeGeneratorModal() {
  openModal('modalBadgeViewer');
}

function approveVolunteer(btn) {
  const parent = btn.closest('.summary-item');
  if (parent) {
    parent.innerHTML = `
      <div>
        <strong>Volunteer Application Approved</strong>
        <div style="font-size: 0.8rem; color: var(--success);">Added to Active Roster</div>
      </div>
      <span class="badge badge-confirmed">Accepted</span>
    `;
    showToast('Volunteer application approved!');
  }
}

function terminateSession(btn) {
  const row = btn.closest('tr');
  if (row) {
    row.remove();
    showToast('User session terminated.');
  }
}

function toggleNotificationsDrawer() {
  showToast('No new notifications');
}

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    <span>${msg}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function handleGlobalSearch(val) {
  if (val.length > 2) {
    showToast(`Searching temple records for: "${val}"...`);
  }
}

// High-DPI Canvas Charts Initializer
function initCharts() {
  // 1. Donation Bar Chart
  const barCanvas = document.getElementById('donationBarChart');
  if (barCanvas) {
    const ctx = barCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = barCanvas.getBoundingClientRect();
    barCanvas.width = (rect.width || 500) * dpr;
    barCanvas.height = (rect.height || 230) * dpr;
    ctx.scale(dpr, dpr);

    const data = [18, 24, 20, 32, 30, 42, 36, 48, 52, 40, 50, 58];
    const maxVal = 65;
    const barWidth = 14;
    const width = rect.width || 500;
    const height = rect.height || 230;
    const gap = (width - (data.length * barWidth)) / (data.length + 1);

    ctx.clearRect(0, 0, width, height);

    data.forEach((val, i) => {
      const x = gap + i * (barWidth + gap);
      const barHeight = (val / maxVal) * (height - 30);
      const y = height - barHeight - 20;

      ctx.fillStyle = i % 2 === 0 ? '#6B1F2A' : '#C96A20';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();
    });
  }

  // 2. Donation Categories Donut Chart
  const donutCanvas = document.getElementById('sourcesDonutChart');
  if (donutCanvas) {
    const ctx = donutCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    donutCanvas.width = 140 * dpr;
    donutCanvas.height = 140 * dpr;
    ctx.scale(dpr, dpr);

    const segments = [
      { percentage: 0.48, color: '#6B1F2A' },
      { percentage: 0.32, color: '#C96A20' },
      { percentage: 0.12, color: '#C9A24A' },
      { percentage: 0.08, color: '#EFE3CF' }
    ];

    let startAngle = -Math.PI / 2;
    const cx = 70, cy = 70, radius = 55, innerRadius = 35;

    segments.forEach(seg => {
      const sliceAngle = seg.percentage * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      startAngle += sliceAngle;
    });
  }
}

// The Unified Calendar is rendered by calendar.js into #calendarRoot.
function renderCalendar() { if (typeof renderUnifiedCalendar === 'function') renderUnifiedCalendar(); }

// Mandala Geometric SVG Decorator
function injectMandalaDecorations() {
  // Can programmatically append background mandala overlays or corner flourishes if needed
}
