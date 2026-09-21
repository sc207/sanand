/* Settings — temple identity and the managed lists. */
(function (global) {
  'use strict';
  const { esc, attr, icon, readForm, toast } = UI;

  const LISTS = [
    ['samaj', 'Samaj'],
    ['devotee_category', 'Devotee Category'],
    ['donation_category', 'Donation Category'],
  ];

  async function render(host) {
    const s = await API.settings();
    const counts = await Promise.all(LISTS.map(([t]) => API.lookups(t).then((r) => r.length)));

    host.innerHTML = `
      <div class="mg-page-head">
        <h1 class="banner-title mg-page-title">Settings</h1>
        <p class="mg-page-sub">Temple details and the lists used across the app</p>
      </div>

      <div class="card">
        <div class="card-header"><h2>Temple Identity</h2></div>
        <div class="card-body">
          <!-- Paired across two columns: a page-level card is the full
               width of the content column, and one field per row left
               most of it empty while making the form look longer than
               the five fields it is. -->
          <form id="setForm">
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_temple_name">Temple Name (Gujarati)</label>
                <input class="form-input" id="f_temple_name" name="temple_name" value="${attr(s.temple_name || '')}"></div>
              <div class="form-group"><label class="form-label" for="f_temple_name_en">Temple Name (English)</label>
                <input class="form-input" id="f_temple_name_en" name="temple_name_en" value="${attr(s.temple_name_en || '')}"></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label class="form-label" for="f_temple_location">Location</label>
                <input class="form-input" id="f_temple_location" name="temple_location" value="${attr(s.temple_location || '')}"></div>
              <div class="form-group"><label class="form-label" for="f_trust_head">Trust Head / Bhuvaji</label>
                <input class="form-input" id="f_trust_head" name="trust_head" value="${attr(s.trust_head || '')}"></div>
            </div>
            <div class="form-group"><label class="form-label" for="f_mahotsav_name">Mahotsav Name</label>
              <input class="form-input" id="f_mahotsav_name" name="mahotsav_name" value="${attr(s.mahotsav_name || '')}"></div>
            <div class="form-actions">
              <button type="button" class="btn btn-primary" id="setSave">Save Details</button>
            </div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Managed Lists</h2></div>
        <div class="card-body" style="padding:0"><div class="list">
          ${LISTS.map(([type, label], i) => `
            <button class="row-item" data-list="${attr(type)}" data-label="${attr(label)}">
              <div class="row-main"><div class="row-title">${esc(label)}</div>
                <div class="row-sub">${esc(counts[i])} entries</div></div>
              ${icon('chevron-right','ico-sm')}
            </button>`).join('')}
        </div></div>
      </div>

      <div class="card">
        <div class="card-header"><h2>About</h2></div>
        <div class="card-body small muted">
          <p>Phase 1 — sevarthi registration and contributions for the Mahotsav.</p>
          <p style="margin:0">Management Apps and Committee / Samaj modules arrive in Phase 2; the
             database already carries a coordinator field on every pooja so they link in without rework.</p>
        </div>
      </div>`;

    host.querySelector('#setSave').addEventListener('click', async (e) => {
      const data = readForm(document.getElementById('setForm'));
      e.currentTarget.disabled = true;
      try {
        await API.put('/settings', data);
        toast('Settings saved', 'ok');
        if (data.temple_name) document.getElementById('brandName').textContent = data.temple_name;
        if (data.temple_location) document.getElementById('brandSub').textContent = data.temple_location;
      } catch (err) { toast(err.message, 'err'); }
      e.currentTarget.disabled = false;
    });

    host.querySelectorAll('[data-list]').forEach((b) =>
      b.addEventListener('click', () =>
        Forms.addLookupSheet(b.getAttribute('data-list'), 'Manage ' + b.getAttribute('data-label'))));
  }

  global.Pages = global.Pages || {};
  global.Pages.settings = { render };
})(window);
