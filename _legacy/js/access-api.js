/* API-backed Accounts & Access panel. When the backend is reachable this
   overrides renderAccess() from access.js with a live view of /api/users +
   /api/sessions, and gives superadmin / admin the controls to add, edit,
   disable and delete accounts and to terminate sessions.
   Falls back to the seed-data renderer (access.js) when offline. */
(function () {
  if (typeof window === 'undefined') return;

  var ROLES = ['superadmin', 'admin', 'accountant'];
  var ROLE_LABEL = {
    superadmin: 'Super Admin', admin: 'Administrator', accountant: 'Temple Accountant',
  };
  var PRIVILEGED = { superadmin: 1, admin: 1 };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function T(k, f) { return (typeof window.t === 'function') ? window.t(k, f) : (f != null ? f : k); }
  function toast(m) { if (typeof showToast === 'function') showToast(m); }
  function me() { return (window.API && window.API.session) || {}; }
  function iAmSuper() { var s = me(); return !!(s.user && (s.user.roles || []).indexOf('superadmin') !== -1); }

  var USERS = [];
  var SESSIONS = [];
  var AUDIT = [];
  var DEVOTEES = [];

  async function load() {
    var u = await window.API.get('/users');
    USERS = Array.isArray(u) ? u : [];
    try { var s = await window.API.get('/sessions'); SESSIONS = Array.isArray(s) ? s : []; }
    catch (e) { SESSIONS = []; }
    try { var a = await window.API.get('/activity?limit=60'); AUDIT = Array.isArray(a) ? a : []; }
    catch (e) { AUDIT = []; }
    try { var d = await window.API.get('/devotees?limit=2000'); DEVOTEES = Array.isArray(d) ? d : []; }
    catch (e) { DEVOTEES = []; }
  }

  function digits(v) { return String(v || '').replace(/\D/g, ''); }
  function devWithAccount() {
    // key by the DEV-### code — that's what DEVOTEES / the dropdown use
    var m = {};
    USERS.forEach(function (u) {
      var key = u.devoteeCode || (u.devoteeId != null ? String(u.devoteeId) : '');
      if (key) m[key] = u.email;
    });
    return m;
  }

  function draw() {
    var root = document.getElementById('accessRoot');
    if (!root) return;
    var canWrite = true; // server enforces; button visibility is a hint only
    var superOnly = iAmSuper();

    var total = USERS.length;
    var admins = USERS.filter(function (u) { return (u.roles || []).indexOf('superadmin') !== -1; }).length;
    var disabled = USERS.filter(function (u) { return !u.active; }).length;

    root.innerHTML =
      '<div class="flex justify-between items-center mg-page-head">' +
        '<div><h1 class="banner-title mg-page-title">🛡️ Accounts &amp; Access</h1>' +
        '<p class="mg-page-sub">Every authorised Google account, its roles, and live device sessions</p></div>' +
        '<div style="display:flex;gap:.5rem;flex-wrap:wrap">' +
          '<button class="btn btn-primary mg-btn-xs" onclick="accAddAccount()">+ Add account</button>' +
          '<button class="btn btn-outline mg-btn-xs mg-btn-danger" onclick="accRevokeAllSessions()">Terminate all other sessions</button>' +
        '</div>' +
      '</div>' +

      '<div class="stats-grid">' +
        kpi('Authorised Accounts', total, 'Google accounts with access', '🛡️') +
        kpi('Super Admins', admins, 'Full authority', '👑') +
        kpi('Disabled', disabled, 'Cannot sign in', '⛔') +
        kpi('Active Sessions', SESSIONS.length, 'Signed-in devices', '📱') +
      '</div>' +

      '<div class="card mg-mt"><div class="card-header flex justify-between items-center">' +
        '<div class="card-title">Accounts <span class="mg-muted-xs">(' + total + ')</span></div></div>' +
        '<div class="card-body" style="padding:0"><div class="mg-table-scroll"><table class="custom-table acc-table">' +
        '<thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        USERS.map(function (u) {
          var priv = (u.roles || []).some(function (r) { return PRIVILEGED[r]; });
          var lockRow = priv && !superOnly;
          var editBtn = '<button class="btn btn-outline mg-btn-xs" onclick="accEditProfile(\'' + u.id + '\')">Edit</button> ';
          var actions;
          if (u.rootOwner) {
            // only the superadmin may touch the superadmin account; an admin cannot
            actions = (superOnly ? editBtn : '') +
                      '<span class="badge badge-maroon">🔒 ' + esc(T('acc_owner', 'Primary owner')) + '</span>' +
                      ' <span class="mg-muted-xs">' + esc(T('acc_owner_note', 'protected — cannot be disabled or removed')) + '</span>';
          } else if (lockRow) {
            actions = '<span class="mg-muted-xs">superadmin only</span>';
          } else {
            actions = editBtn +
              '<button class="btn btn-outline mg-btn-xs" onclick="accEditRoles(\'' + u.id + '\')">Roles</button> ' +
              '<button class="btn btn-outline mg-btn-xs" onclick="accToggleActive(\'' + u.id + '\')">' + (u.active ? 'Disable' : 'Enable') + '</button> ' +
              '<button class="btn btn-outline mg-btn-xs mg-btn-danger" onclick="accDeleteAccount(\'' + u.id + '\')">Delete</button>';
          }
          return '<tr>' +
            '<td><div class="mg-name-cell"><span class="mg-avatar">' + esc((u.name || u.email || '?')[0].toUpperCase()) + '</span>' +
              '<div><strong>' + esc(u.name || '—') + '</strong><div class="mg-muted-xs">' + esc(u.id) + (u.googleLinked ? ' · linked' : '') + '</div></div></div></td>' +
            '<td class="acc-wrap">' + esc(u.email) + '</td>' +
            '<td>' + (u.roles || []).map(function (r) { return '<span class="badge badge-maroon">' + esc(ROLE_LABEL[r] || r) + '</span>'; }).join(' ') + '</td>' +
            '<td>' + (u.active ? '<span class="badge badge-confirmed">Active</span>' : '<span class="badge badge-cancelled">Disabled</span>') + '</td>' +
            '<td style="white-space:nowrap">' + actions + '</td></tr>';
        }).join('') +
        '</tbody></table></div></div></div>' +

      (typeof window.accRoleReferenceCard === 'function' ? window.accRoleReferenceCard() : '') +

      '<div class="card mg-mt"><div class="card-header"><div class="card-title">Active sessions <span class="mg-muted-xs">(' + SESSIONS.length + ')</span></div></div>' +
        '<div class="card-body" style="padding:0"><div class="mg-table-scroll"><table class="custom-table acc-table acc-table-sm">' +
        '<thead><tr><th>Signed-in device</th><th style="text-align:right">Action</th></tr></thead><tbody>' +
        (SESSIONS.length ? SESSIONS.map(function (s) {
          return '<tr>' +
            '<td class="acc-wrap">' +
              '<strong>' + esc(s.userEmail || '—') + '</strong>' +
              (s.current ? ' <span class="badge badge-confirmed">this device</span>' : '') +
              '<div class="mg-muted-xs" style="margin-top:2px">' +
                esc(shortUA(s.userAgent)) +
                (s.ip ? ' · ' + esc(s.ip) : '') +
                (s.lastSeen ? ' · ' + esc(window.fmtServerTimeIST ? window.fmtServerTimeIST(s.lastSeen) : s.lastSeen) : '') +
              '</div>' +
            '</td>' +
            '<td style="text-align:right;white-space:nowrap">' +
              (s.current ? '<span class="mg-muted-xs">—</span>'
                         : '<button class="btn btn-outline mg-btn-xs mg-btn-danger" onclick="accRevokeSession(\'' + s.id + '\')">Revoke</button>') +
            '</td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="2" class="mg-muted-xs" style="padding:1rem">No other active sessions.</td></tr>') +
        '</tbody></table></div></div></div>' +

      /* Audit trail — server-recorded, from /api/activity (audit_logs table) */
      '<div class="card mg-mt"><div class="card-header"><div class="card-title">Audit trail <span class="mg-muted-xs">(' + AUDIT.length + ' most recent)</span></div></div>' +
        '<div class="card-body" style="padding:0"><div class="mg-table-scroll"><table class="custom-table acc-table acc-table-sm">' +
        '<thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>' +
        (AUDIT.length ? AUDIT.map(function (a) {
          var when = a.createdAt ? (window.fmtServerTimeIST ? window.fmtServerTimeIST(a.createdAt) : a.createdAt) : '—';
          var ent = [a.entityType, a.entityId].filter(Boolean).join(' ');
          var extra = '';
          try { var d = a.details || {}; var keys = Object.keys(d); if (keys.length) extra = keys.map(function (k) { return k + ': ' + (typeof d[k] === 'object' ? JSON.stringify(d[k]) : d[k]); }).join(', '); } catch (e) {}
          return '<tr>' +
            '<td class="mg-muted-xs" style="white-space:nowrap">' + esc(when) + '</td>' +
            '<td class="acc-wrap">' + esc(a.userEmail || '—') + (a.module ? ' <span class="badge badge-maroon">' + esc(a.module) + '</span>' : '') + '</td>' +
            '<td style="white-space:nowrap"><strong>' + esc(a.action || '') + '</strong></td>' +
            '<td class="acc-wrap mg-muted-xs">' + esc([ent, extra].filter(Boolean).join(' · ')) + '</td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="4" class="mg-muted-xs" style="padding:1rem">No audit entries yet. Every account / role / data change is recorded here.</td></tr>') +
        '</tbody></table></div></div></div>';
  }

  /* "Chrome on Windows" style label from a UA string, with a raw fallback */
  function shortUA(ua) {
    ua = String(ua || '');
    if (!ua) return 'unknown device';
    var b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera'
          : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox'
          : /Safari\//.test(ua) ? 'Safari' : '';
    var o = /Windows NT/.test(ua) ? 'Windows'
          : /iPhone|iPad/.test(ua) ? 'iOS'
          : /Android/.test(ua) ? 'Android'
          : /Mac OS X/.test(ua) ? 'macOS'
          : /Linux/.test(ua) ? 'Linux' : '';
    return (b && o) ? (b + ' on ' + o) : (b || o || ua.slice(0, 40));
  }

  function kpi(label, value, meta, icon) {
    if (typeof kpiCard === 'function') return kpiCard(label, value, meta, icon);
    return '<div class="stat-card"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + esc(value) + '</div><div class="mg-muted-xs">' + esc(meta) + '</div></div>';
  }

  function errState(msg) {
    var root = document.getElementById('accessRoot');
    if (!root) return;
    root.innerHTML =
      '<div class="mg-page-head"><div><h1 class="banner-title mg-page-title">🛡️ ' + esc(T('acc_title', 'Accounts & Access')) + '</h1></div></div>' +
      '<div class="card mg-mt"><div class="card-body">' +
        '<p class="mg-page-sub">' + esc(msg) + '</p>' +
        '<button class="btn btn-primary mg-btn-xs" onclick="renderAccess()">' + esc(T('retry', 'Retry')) + '</button>' +
      '</div></div>';
  }
  async function refresh() {
    try { await load(); }
    catch (e) {
      console.error('[access] load failed', e);
      errState((T('acc_load_fail', 'Could not load accounts') + ': ' + (e && e.message || 'request failed')));
      return;
    }
    // keep the Dashboard "Authorized Accounts" KPI (hydrate.js's ACCOUNTS
    // registry) live too — an add/edit/disable here shouldn't need a reload
    // elsewhere to show up.
    if (typeof window.__rehydrate === 'function') window.__rehydrate('accounts');
    try { draw(); }
    catch (e2) {
      console.error('[access] draw failed', e2);
      errState(T('acc_render_fail', 'Loaded, but the page could not be drawn. Reload and try again.'));
    }
  }

  /* ---------- actions ---------- */
  function roleCheckboxes(current) {
    var superOnly = iAmSuper();
    var cur = current || [];
    return ROLES.map(function (r) {
      var checked = cur.indexOf(r) !== -1 ? ' checked' : '';
      var note = '', disabled = '';
      if (r === 'superadmin') {
        // exactly one superadmin (the primary owner) — never grantable via the UI
        disabled = ' disabled';
        note = checked ? ' <span class="mg-muted-xs">(the primary owner — fixed)</span>'
                       : ' <span class="mg-muted-xs">(only one superadmin allowed)</span>';
      } else if (r === 'admin' && !superOnly) {
        disabled = ' disabled';
        note = ' <span class="mg-muted-xs">(superadmin only)</span>';
      }
      return '<label style="display:flex;gap:.5rem;align-items:center;margin:.3rem 0">' +
        '<input type="checkbox" value="' + r + '"' + checked + disabled + '> ' + esc(ROLE_LABEL[r] || r) +
        note + '</label>';
    }).join('');
  }
  function pickedRoles(form) {
    return Array.prototype.slice.call(form.querySelectorAll('input[type=checkbox]:checked')).map(function (c) { return c.value; });
  }

  window.accAddAccount = function () {
    if (typeof openSheet !== 'function') { toast('UI not ready'); return; }
    var picker = (typeof devoteeLinkField === 'function')
      ? devoteeLinkField({ selId: 'accDevoteeSel', label: 'Person (devotee)', required: true, onChange: 'accDevoteePicked()' })
      : '<input class="form-input" id="accDevoteeSel" placeholder="DEV-###">';
    openSheet({
      title: 'Add account',
      body: '<form id="accAddForm">' +
        picker +
        '<div id="accPersonHint" class="link-section-hint" style="margin:.2rem 0 .6rem"></div>' +
        /* EXTRA — what belongs to the account, not the person */
        '<div class="form-group"><label class="form-label">Google email *</label>' +
          '<input class="form-input" name="email" type="email" placeholder="person@gmail.com" required></div>' +
        '<div class="form-group"><label class="form-label">Roles</label>' + roleCheckboxes([]) + '</div></form>',
      footer: '<button class="btn btn-outline" onclick="closeSheet()">Cancel</button>' +
              '<button class="btn btn-primary" onclick="accSubmitAdd()">Create</button>',
    });
  };

  window.accDevoteePicked = function () {
    var hint = document.getElementById('accPersonHint');
    var sel = document.getElementById('accDevoteeSel');
    if (!hint || !sel) return;
    var d = DEVOTEES.filter(function (x) { return String(x.id) === String(sel.value); })[0];
    if (!sel.value) { hint.textContent = ''; return; }
    var busy = devWithAccount()[String(sel.value)];
    if (busy) {
      hint.innerHTML = '<span style="color:var(--primary-maroon)">⚠ ' + esc((d && d.name) || sel.value) + ' already has an account (' + esc(busy) + ')</span>';
      return;
    }
    hint.innerHTML = '<span style="color:var(--success,#2E7D6B)">✓ the account links to this devotee record.</span>';
  };

  window.accSubmitAdd = async function () {
    var f = document.getElementById('accAddForm'); if (!f) return;
    var email = f.email.value.trim();
    if (!email) { toast('Google email is required'); return; }
    var devoteeId = (document.getElementById('accDevoteeSel') || {}).value || '';
    if (!devoteeId) { toast('Pick a devotee, or add a new one.'); return; }
    var roles = pickedRoles(f);
    try {
      var created = await window.API.post('/users', { email: email, roles: roles, devoteeId: devoteeId });
      if (typeof closeSheet === 'function') closeSheet();
      toast('Account created'); await refresh();
    } catch (e) { toast(e.message); }
  };

  window.accEditProfile = function (id) {
    var u = USERS.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!u || typeof openSheet !== 'function') { toast('UI not ready'); return; }
    var priv = (u.roles || []).some(function (r) { return PRIVILEGED[r]; });
    if (priv && !iAmSuper()) { toast('Only a superadmin can edit an admin / superadmin account'); return; }
    var devKey = u.devoteeCode || (u.devoteeId != null ? String(u.devoteeId) : '');
    var linked = devKey ? DEVOTEES.filter(function (x) { return String(x.id) === devKey || String(x.rowId) === devKey; })[0] : null;
    var personBlock = devKey
      ? '<div class="form-group"><label class="form-label">Person (devotee)</label>' +
          '<input class="form-input" value="' + esc((linked && linked.name) || u.name || '—') +
            (linked && linked.mobile ? ' · ' + esc(linked.mobile) : '') +
            (linked && linked.city ? ' · ' + esc(linked.city) : '') + '" disabled>' +
          '<span class="mg-muted-xs">Linked to devotee ' + esc((linked && linked.id) || devKey) +
            ' — edit the person\'s name / mobile / city in the People register; it updates everywhere.</span></div>'
      : ((typeof devoteeLinkField === 'function')
          ? devoteeLinkField({ selId: 'accProfileDevSel', label: 'Person (devotee)', required: true }) +
            '<div class="mg-muted-xs" style="margin:.2rem 0 .5rem">This account is not yet linked to a person — pick the devotee it belongs to (or add a new one).</div>'
          : '<div class="form-group"><label class="form-label">DEV-### code</label><input class="form-input" id="accProfileDevSel"></div>');
    openSheet({
      title: 'Edit profile — ' + esc(u.name || u.email),
      body: '<form id="accProfileForm">' +
        '<div class="form-group"><label class="form-label">Google email</label>' +
          '<input class="form-input" value="' + esc(u.email) + '" disabled>' +
          '<span class="mg-muted-xs">The sign-in email cannot be changed. Remove this account and add the new email instead.</span></div>' +
        personBlock +
      '</form>',
      footer: '<button class="btn btn-outline" onclick="closeSheet()">Cancel</button>' +
              (devKey ? '' : '<button class="btn btn-primary" onclick="accSubmitProfile(\'' + id + '\')">Link devotee</button>'),
    });
  };
  window.accSubmitProfile = async function (id) {
    var sel = document.getElementById('accProfileDevSel');
    var devoteeId = sel && sel.value;
    if (!devoteeId) { toast('Pick a devotee, or add a new one.'); return; }
    try {
      await window.API.patch('/users/' + id, { devoteeId: devoteeId });
      if (typeof closeSheet === 'function') closeSheet();
      toast('Account linked to devotee'); await refresh();
    } catch (e) { toast(e.message); }
  };

  window.accEditRoles = function (id) {
    var u = USERS.filter(function (x) { return String(x.id) === String(id); })[0]; if (!u) return;
    openSheet({
      title: 'Roles — ' + esc(u.name || u.email),
      body: '<form id="accRolesForm">' + roleCheckboxes(u.roles) + '</form>',
      footer: '<button class="btn btn-outline" onclick="closeSheet()">Cancel</button>' +
              '<button class="btn btn-primary" onclick="accSubmitRoles(\'' + id + '\')">Save</button>',
    });
  };
  window.accSubmitRoles = async function (id) {
    var u = USERS.filter(function (x) { return String(x.id) === String(id); })[0];
    var f = document.getElementById('accRolesForm'); if (!u || !f) return;
    var want = pickedRoles(f), have = u.roles || [];
    try {
      for (var i = 0; i < want.length; i++) if (have.indexOf(want[i]) === -1) await window.API.post('/users/' + id + '/roles', { role: want[i] });
      for (var k = 0; k < have.length; k++) if (want.indexOf(have[k]) === -1) await window.API.del('/users/' + id + '/roles/' + have[k]);
      if (typeof closeSheet === 'function') closeSheet();
      toast('Roles updated'); await refresh();
    } catch (e) { toast(e.message); }
  };

  window.accToggleActive = async function (id) {
    var u = USERS.filter(function (x) { return String(x.id) === String(id); })[0]; if (!u) return;
    try {
      await window.API.patch('/users/' + id, { active: !u.active });
      toast(u.active ? 'Account disabled' : 'Account enabled');
      await refresh();
    } catch (e) { toast(e.message); }
  };

  window.accDeleteAccount = function (id) {
    var u = USERS.filter(function (x) { return String(x.id) === String(id); })[0]; if (!u) return;
    var go = async function () {
      try { await window.API.del('/users/' + id); toast('Account deleted'); }
      catch (e) { toast(e.message); }
      if (typeof closeConfirm === 'function') closeConfirm();
      await refresh();
    };
    if (typeof openConfirm === 'function') {
      openConfirm({ title: 'Delete account', body: 'Permanently remove <strong>' + esc(u.email) + '</strong> and end its sessions?', danger: true, confirmLabel: 'Delete', onConfirm: go });
    } else if (window.confirm('Delete ' + u.email + '?')) go();
  };

  window.accRevokeSession = async function (sid) {
    try { await window.API.del('/sessions/' + sid); toast('Session revoked'); await refresh(); }
    catch (e) { toast(e.message); }
  };
  window.accRevokeAllSessions = function () {
    var go = async function () {
      try { await window.API.del('/sessions/all'); toast('All other sessions terminated'); }
      catch (e) { toast(e.message); }
      if (typeof closeConfirm === 'function') closeConfirm();
      await refresh();
    };
    if (typeof openConfirm === 'function') {
      openConfirm({ title: 'Terminate sessions', body: 'Sign out every other device and person. Your current session stays active.', danger: true, confirmLabel: 'Terminate all', onConfirm: go });
    } else if (window.confirm('Terminate all other sessions?')) go();
  };

  /* ---------- install ---------- */
  var seedRender = window.renderAccess;
  window.renderAccess = function () {
    if (!window.API || !window.API.online) { if (typeof seedRender === 'function') return seedRender(); return; }
    var root = document.getElementById('accessRoot');
    if (!root) return;
    // Same guard the seed renderer applies (access.js accGuard): don't even
    // attempt the admin-only /users fetch for a persona that can't open this
    // page — GET /users is admin-tier now, so a scoped role would otherwise
    // hit a guaranteed 403 on every app boot for a page it can never see.
    if (typeof canOpenPage === 'function' && !canOpenPage('admin')) { root.innerHTML = ''; return; }
    if (!USERS.length) root.innerHTML = '<div class="mg-muted-xs" style="padding:1rem">Loading accounts…</div>';
    refresh();
  };
})();
