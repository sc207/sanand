/* Router + shell wiring. Pages register themselves on window.Pages
   as { render(host) }. Navigation is hash-based so back/forward and
   deep links work. */
(function () {
  'use strict';

  const PAGES = {
    dashboard:  { title: 'Dashboard' },
    mahotsav:   { title: 'Murti Pran Pratishtha Mahotsav' },
    payments:   { title: 'Payment Received' },
    devotees:   { title: 'Devotee' },
    visits:     { title: 'Bappa / Bhuvaji Padhramni' },
    calendar:   { title: 'Universal Calendar' },
    donations:  { title: 'Donation' },
    invitation: { title: 'Invitation' },
    settings:   { title: 'Settings' },
    accounts:   { title: 'Accounts & Access' },
  };

  const main = () => document.getElementById('main');

  function parseHash() {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [page, ...rest] = raw.split('/');
    return { page: PAGES[page] ? page : 'dashboard', params: rest };
  }

  async function render() {
    const { page, params } = parseHash();
    const host = main();

    document.querySelectorAll('[data-page]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-page') === page);
    });
    document.title = PAGES[page].title + ' · Shri Vihat Meldi Dham';

    const mod = window.Pages && window.Pages[page];
    if (!mod) {
      host.innerHTML = UI.errorState('That section is not available yet.');
      return;
    }

    host.innerHTML = UI.loading(3);
    try {
      await mod.render(host, params);
      Lang.translateTree(host);
    } catch (err) {
      console.error(err);
      host.innerHTML = UI.errorState(err.message || 'Unexpected error');
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function go(page, ...params) {
    location.hash = '#/' + [page, ...params].join('/');
  }
  window.navigate = go;
  window.refreshPage = render;

  /* ---------- shell events (delegated) ---------- */
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-page]');
    if (nav) { e.preventDefault(); go(nav.getAttribute('data-page')); return; }

    const action = e.target.closest('[data-action]');
    if (action) {
      const name = action.getAttribute('data-action');
      if (name === 'quick-add') Forms.quickAddMenu();
      if (name === 'more') moreMenu();
      return;
    }

    if (e.target.closest('[data-sheet-close]')) { UI.closeSheet(); return; }
  });

  document.getElementById('sheetClose').addEventListener('click', UI.closeSheet);
  // clicking the dark area outside the box closes it
  document.getElementById('sheet').addEventListener('click', (e) => {
    if (e.target.id === 'sheet') UI.closeSheet();
  });

  document.getElementById('toggleSidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  const search = document.getElementById('globalSearchInput');
  if (search) search.addEventListener('focus', () => { search.blur(); Forms.globalSearch(); });

  document.getElementById('userChip').addEventListener('click', () => {
    Forms.switchUser();
  });

  document.getElementById('langToggle').addEventListener('click', () => {
    Lang.setLang(Lang.lang() === 'gu' ? 'en' : 'gu');
  });

  function moreMenu() {
    const items = [
      ['devotees', 'users', 'Devotee Register'],
      ['visits', 'temple', 'Bappa / Bhuvaji Padhramni'],
      ['calendar', 'calendar', 'Universal Calendar'],
      ['donations', 'gift', 'Donation'],
      ['invitation', 'mail', 'Invitation'],
      ['settings', 'settings', 'Settings'],
      ['accounts', 'shield', 'Accounts & Access'],
    ];
    UI.openSheet({
      title: 'All sections',
      body: `<div class="list">${items.map(([page, ic, label]) => `
        <button class="row-item" data-goto="${UI.attr(page)}">
          ${UI.icon(ic)}
          <div class="row-main"><div class="row-title">${UI.esc(label)}</div></div>
          ${UI.icon('chevron-right', 'ico-sm')}
        </button>`).join('')}</div>`,
      onMount(sheet) {
        sheet.querySelectorAll('[data-goto]').forEach((b) => {
          b.addEventListener('click', () => {
            UI.closeSheet();
            go(b.getAttribute('data-goto'));
          });
        });
      },
    });
  }

  /* ---------- boot ---------- */
  function paintUser() {
    const u = API.currentUser();
    document.getElementById('userInitial').textContent =
      (u.name || 'A').trim().charAt(0).toUpperCase();
    const nameEl = document.getElementById('topbarUserName');
    if (nameEl) nameEl.textContent = u.name || 'Administrator';
    document.getElementById('userChip').title = 'Signed in as ' + (u.name || 'Administrator');
  }
  window.paintUser = paintUser;

  async function paintBrand() {
    try {
      const s = await API.settings();
      if (s.temple_name) document.getElementById('brandName').textContent = s.temple_name;
      if (s.temple_location) document.getElementById('brandSub').textContent = s.temple_location;
    } catch (e) { /* offline — keep defaults */ }
  }

  window.addEventListener('hashchange', render);
  document.documentElement.lang = Lang.lang();
  document.documentElement.classList.toggle('lang-gu', Lang.lang() === 'gu');
  Lang.paintStaticLabels();
  paintUser();
  paintBrand();
  if (!location.hash) location.hash = '#/dashboard';
  render();
})();
