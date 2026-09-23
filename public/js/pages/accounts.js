/* Accounts & Access — who can work in the app, and the audit trail. */
(function (global) {
  'use strict';
  const { esc, attr, icon, debounce, openSheet, closeSheet, readForm,
          clearFieldErrors, showFieldError, toast } = UI;

  const ROLES = ['superadmin', 'admin', 'accountant', 'operator'];
  const state = { auditUser: '', auditEntity: '' };

  async function render(host) {
    const [users, audit] = await Promise.all([API.users(), API.audit({ limit: 100 })]);

    host.innerHTML = `
      <div class="flex justify-between items-center mg-page-head">
        <div>
          <h1 class="banner-title mg-page-title">Accounts &amp; Access</h1>
          <p class="mg-page-sub">Who works in the app, and everything they have done</p>
        </div>
        ${/* Who has an account is administrator work. */''}
        ${UI.can('admin') ? `<button class="btn btn-primary mg-btn-xs" data-add>${icon('plus','ico-sm')} User</button>` : ''}
      </div>

      <div class="card">
        <div class="card-header"><h2>Users</h2></div>
        <div class="card-body" style="padding:0"><div class="list">
          ${users.map((u) => `
            <button class="row-item" data-user="${attr(u.id)}">
              <span class="user-chip" style="width:32px;height:32px;font-size:.8rem">
                ${esc((u.name || '?').charAt(0).toUpperCase())}</span>
              <div class="row-main">
                <div class="row-title">${esc(u.name)}
                  ${u.active ? '' : '<span class="badge badge-cancelled">Disabled</span>'}</div>
                <div class="row-sub">${esc(u.role)}${u.mobile ? ' · ' + esc(u.mobile) : ''}</div>
              </div>
              ${icon('chevron-right','ico-sm')}
            </button>`).join('')}
        </div></div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Audit Trail</h2>
          <span class="small muted">latest ${esc(audit.length)}</span></div>
        <div class="card-body">
          <div class="search-bar" style="margin-bottom:.6rem">${icon('search')}
            <input class="form-input" id="auditSearch" placeholder="Filter by user name" autocomplete="off"></div>
          <div id="auditList"></div>
        </div>
      </div>`;

    paintAudit(audit);

    const addUser = host.querySelector('[data-add]');
    if (addUser) addUser.addEventListener('click', () => userForm());
    host.querySelectorAll('[data-user]').forEach((b) =>
      b.addEventListener('click', () => {
        const u = users.find((x) => String(x.id) === b.getAttribute('data-user'));
        userForm(u);
      }));
    host.querySelector('#auditSearch').addEventListener('input', debounce(async (e) => {
      const list = document.getElementById('auditList');
      list.innerHTML = UI.loading(2);
      try { paintAudit(await API.audit({ user: e.target.value.trim(), limit: 100 })); }
      catch (err) { list.innerHTML = UI.errorState(err.message); }
    }, 280));
  }

  /* The trail is the longest list in the app — every write ever made —
     so it pages. `rows` is kept so paging does not refetch. */
  let auditRows = [];
  let auditPage = 1;

  function paintAudit(rows) {
    const list = document.getElementById('auditList');
    if (!list) return;
    if (rows) { auditRows = rows; auditPage = 1; }
    const ACTION = {
      create: 'badge-ok', update: 'badge-info', delete: 'badge-danger',
      cancel: 'badge-warn', payment: 'badge-gold',
    };
    const pg = UI.paginate(auditRows, auditPage);
    list.innerHTML = auditRows.length ? `<div class="list">${pg.slice.map((a) => `
      <div class="row-item" style="cursor:default;align-items:flex-start">
        <span class="badge ${ACTION[a.action] || ''}">${esc(a.action)}</span>
        <div class="row-main">
          <div class="row-title" style="font-weight:500;white-space:normal">${esc(a.summary)}</div>
          <div class="row-sub">${esc(a.user_name)} ·
            <span title="${attr(a.created_at)}">${esc(UI.ago(a.created_at))}</span></div>
        </div>
      </div>`).join('')}</div>${UI.pager(pg, 'entries')}`
      : UI.empty('Nothing logged yet', 'Every add, edit and delete will appear here.', 'history');
    UI.bindPager(list, (d) => { auditPage = pg.page + d; paintAudit(null); });
  }

  function userForm(existing) {
    const u = existing || {};
    openSheet({
      title: u.id ? 'Edit User' : 'Add User',
      body: `
        <form id="userForm" novalidate>
          <div class="form-group"><label class="form-label req" for="f_name">Name</label>
            <input class="form-input" id="f_name" name="name" value="${attr(u.name || '')}" autocomplete="name"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label" for="f_mobile">Mobile</label>
              <input class="form-input" id="f_mobile" name="mobile" value="${attr(u.mobile || '')}" inputmode="tel"></div>
            <div class="form-group"><label class="form-label" for="f_email">Email</label>
              <input class="form-input" id="f_email" name="email" type="email" value="${attr(u.email || '')}"></div>
          </div>
          <div class="form-group"><label class="form-label" for="f_role">Role</label>
            <select class="form-select" id="f_role" name="role">
              ${ROLES.map((r) => `<option value="${attr(r)}"${(u.role || 'operator') === r ? ' selected' : ''}>
                ${esc(r)}</option>`).join('')}
            </select>
            <div class="form-hint">Roles are recorded for the audit trail. Full login control comes with Phase 2.</div>
          </div>
          ${u.id ? `<label class="small" style="display:flex;align-items:center;gap:.45rem;font-weight:500">
            <input type="checkbox" name="active" ${u.active ? 'checked' : ''} style="width:auto;min-height:0">
            Active</label>` : ''}
        </form>`,
      footer: `<button class="btn btn-outline" data-sheet-close>Cancel</button>
               <button class="btn btn-primary" id="userSave">${u.id ? 'Save changes' : 'Add User'}</button>`,
      onMount(sheet) {
        sheet.querySelector('[data-sheet-close]').addEventListener('click', closeSheet);
        UI.bindEnterFlow(document.getElementById('userForm'),
          () => sheet.querySelector('#userSave').click());
        sheet.querySelector('#userSave').addEventListener('click', async (e) => {
          const form = document.getElementById('userForm');
          clearFieldErrors(form);
          const data = readForm(form);
          if (!data.name) return showFieldError(form, 'name', 'Please enter a name');
          e.currentTarget.disabled = true;
          try {
            if (u.id) await API.put('/users/' + u.id, data);
            else await API.post('/users', data);
            closeSheet(); toast(u.id ? 'User updated' : 'User added', 'ok'); refreshPage();
          } catch (err) {
            e.currentTarget.disabled = false;
            toast(err.message, 'err');
          }
        });
      },
    });
  }

  global.Pages = global.Pages || {};
  global.Pages.accounts = { render };
})(window);
