/* Router + shell wiring. Pages register themselves on window.Pages
   as { render(host) }. Navigation is hash-based so back/forward and
   deep links work. */
(function () {
  'use strict';

  const PAGES = {
    dashboard:  { title: 'Dashboard' },
    mahotsav:   { title: 'Murti Pran Pratishtha Mahotsav' },
    payments:   { title: 'Payments' },
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
      appReady();                 // an error still counts as "screen drawn"
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

    appReady();
  }

  /* Tell the splash the first screen is actually on the page. The window
     `load` event fires while this render is still fetching, so without
     this the loader would lift onto skeletons. Fired whether the render
     succeeded or errored — a visible error beats a splash that never
     leaves — and only ever the first time. */
  function appReady() {
    if (window.__appReady) { window.__appReady(); window.__appReady = null; }
  }

  function go(page, ...params) {
    location.hash = '#/' + [page, ...params].join('/');
  }
  window.navigate = go;
  window.refreshPage = render;

  /* ---------- shell events (delegated) ---------- */
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-page]');
    if (nav) {
      e.preventDefault();
      /* Close on the TAP, not only on the navigation: tapping the
         section you are already on changes no hash, fires no
         hashchange, and left the drawer sitting open over the page it
         had just confirmed you were looking at. */
      closeDrawer();
      go(nav.getAttribute('data-page'));
      return;
    }

    const action = e.target.closest('[data-action]');
    if (action) {
      const name = action.getAttribute('data-action');
      if (name === 'quick-add') { closeDrawer(); Forms.quickAddMenu(); }
      /* "More" opens the sidebar, not a second menu of its own.
         There were two: the drawer behind the hamburger, and an "All
         sections" sheet behind this button — different labels for the
         same pages ("Padhramni" against "Bappa / Bhuvaji Padhramni"),
         a different order, and the SAME hamburger glyph on both
         buttons. Two menus is one too many, and the drawer is the one
         that already matches the desktop and groups its sections. */
      if (name === 'more') setDrawer(true);
      return;
    }

    if (e.target.closest('[data-sheet-close]')) { UI.closeSheet(); return; }
  });

  document.getElementById('sheetClose').addEventListener('click', UI.closeSheet);
  // clicking the dark area outside the box closes it
  document.getElementById('sheet').addEventListener('click', (e) => {
    if (e.target.id === 'sheet') UI.closeSheet();
  });

  /* ---- the off-canvas drawer ----
     Three things were missing, and all three are the same omission:
     the drawer knew how to open and nothing else knew it was open.
       - Tapping a link inside it navigated and left the drawer sitting
         over the page you had just asked for, with the hamburger the
         only way back out.
       - There was nothing to tap outside it. Escape worked, which is
         no help at all on the phone and tablet this layout exists for.
       - The page behind stayed scrollable underneath it.
     `setDrawer` owns all of that in one place, so a future caller
     cannot open it and forget half. */
  const drawer = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebarScrim');

  function setDrawer(open) {
    drawer.classList.toggle('open', open);
    if (scrim) scrim.hidden = !open;
    document.body.classList.toggle('drawer-open', open);
  }
  const closeDrawer = () => setDrawer(false);

  document.getElementById('toggleSidebar').addEventListener('click', () => {
    setDrawer(!drawer.classList.contains('open'));
  });
  if (scrim) scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });
  /* Any navigation closes it, wherever it came from — a link in the
     drawer, the bottom bar, the More sheet or a card on the page. */
  window.addEventListener('hashchange', closeDrawer);

  const search = document.getElementById('globalSearchInput');
  if (search) search.addEventListener('focus', () => { search.blur(); Forms.globalSearch(); });

  document.getElementById('userChip').addEventListener('click', () => {
    Forms.switchUser();
  });

  document.getElementById('langToggle').addEventListener('click', () => {
    Lang.setLang(Lang.lang() === 'gu' ? 'en' : 'gu');
  });


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
