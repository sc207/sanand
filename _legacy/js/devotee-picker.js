/* ============================================================
   Shared devotee "add / pick a person" widget — the SAME reusable
   form for Committee leader/member, Management lead/member, Pooja
   sevarthi/coordinator/guest. A person is a devotee; a role is a link.
   Loaded after people-picker.js.
   ============================================================ */
(function () {
  if (typeof window === 'undefined') return;

  /* ---- Dedicated overlay so the devotee form ALWAYS stacks visibly on top
     of whatever opened it — a module modal (#modalPooja / #modalCommittee /
     #modalManagement, z-index 1000) OR the generic sheet #mgSheet (1100),
     which is what the Bappa-Visits form uses. Own DOM + z-index 1300. ---- */
  function ensureOverlay() {
    if (typeof document === 'undefined' || document.getElementById('dpOverlay')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="modal-overlay" id="dpOverlay">' +
        '<div class="modal-box" style="max-width:560px">' +
          '<div class="modal-header">' +
            '<div class="modal-title" id="dpSheetTitle"></div>' +
            '<button class="modal-close-btn" onclick="dpCloseSheet()">&times;</button>' +
          '</div>' +
          '<div class="modal-body" id="dpSheetBody"></div>' +
          '<div class="modal-footer" id="dpSheetFooter"></div>' +
        '</div>' +
      '</div>');
    document.getElementById('dpOverlay').addEventListener('click', function (e) {
      if (e.target.id === 'dpOverlay') dpCloseSheet();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var o = document.getElementById('dpOverlay');
        if (o && o.classList.contains('active')) dpCloseSheet();
      }
    });
  }
  if (typeof document !== 'undefined') {
    if (document.body) ensureOverlay();
    else document.addEventListener('DOMContentLoaded', ensureOverlay);
  }
  function dpOpenSheet(o) {
    ensureOverlay();
    var t = document.getElementById('dpSheetTitle');
    var b = document.getElementById('dpSheetBody');
    var f = document.getElementById('dpSheetFooter');
    if (!b) { if (typeof openSheet === 'function') return openSheet(o); return; }
    t.textContent = o.title || '';
    b.innerHTML = o.body || '';
    f.innerHTML = o.footer || '<button class="btn btn-primary" onclick="dpCloseSheet()">Close</button>';
    document.getElementById('dpOverlay').classList.add('active');
  }
  window.dpCloseSheet = function () {
    var o = document.getElementById('dpOverlay');
    if (o) o.classList.remove('active');
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var digits = function (v) { return String(v || '').replace(/\D/g, ''); };

  /* All people from the shared register, newest-first-friendly, as
     { id, name, mobile, city }. Kept in sync with the DB via state.devotees
     (hydrated from /api/devotees) plus anyone already referenced locally. */
  window.allPeople = function () {
    return (typeof templePeople === 'function' ? templePeople() : [])
      .filter(function (p) { return p.kind !== 'committee'; });
  };

  /* A checkbox roster: <div id=containerId> filled with tickable people.
     selectedIds  = array of ids to pre-tick (or [{id, role}] objects).
     roleOptions  = optional array of role names → each row gets a role <select>. */
  window.personCheckList = function (people, selectedIds, checkClass, roleOptions) {
    var sel = selectedIds || [];
    var selIds = sel.map(function (x) { return (x && x.id != null) ? x.id : x; });
    var roleOf = {};
    sel.forEach(function (x) { if (x && x.id != null && x.role) roleOf[x.id] = x.role; });
    var cls = checkClass || 'dp-check';
    if (!people.length) {
      return '<div class="people-check-list"><div class="people-check-empty">' +
        '<span class="pce-emoji">👥</span>No one in the register yet — use “Add new devotee”.</div></div>';
    }
    var roleSel = function (id) {
      if (!roleOptions || !roleOptions.length) return '';
      var cur = roleOf[id] || roleOptions[0];
      return '<select class="form-select pcr-role ' + cls + '-role" data-for="' + esc(id) + '" onclick="event.preventDefault()">' +
        roleOptions.map(function (r) {
          return '<option value="' + esc(r) + '"' + (r === cur ? ' selected' : '') + '>' + esc(r) + '</option>';
        }).join('') + '</select>';
    };
    var initials = function (nm) {
      return String(nm || '?').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).slice(0, 2).join('') || '?';
    };
    return '<div class="people-check-list">' + people.map(function (p) {
      return '<label class="people-check-row">' +
        '<input type="checkbox" class="' + cls + '" value="' + esc(p.id) + '"' +
          (selIds.indexOf(p.id) !== -1 ? ' checked' : '') + '>' +
        '<span class="pcr-avatar">' + esc(initials(p.name)) + '</span>' +
        '<span class="pcr-body"><strong>' + esc(p.name) + '</strong>' +
        '<small>' + [p.mobile, p.city].filter(Boolean).map(esc).join(' · ') + '</small></span>' +
        roleSel(p.id) +
      '</label>';
    }).join('') + '</div>';
  };
  window.checkedIds = function (containerId, checkClass) {
    var box = document.getElementById(containerId);
    if (!box) return [];
    return Array.prototype.slice
      .call(box.querySelectorAll('.' + (checkClass || 'dp-check') + ':checked'))
      .map(function (c) { return c.value; });
  };
  /** [{ id, role }] for every ticked row (role from the row's <select>, if any). */
  window.checkedPeople = function (containerId, checkClass) {
    var box = document.getElementById(containerId);
    if (!box) return [];
    var cls = checkClass || 'dp-check';
    return Array.prototype.slice.call(box.querySelectorAll('.' + cls + ':checked')).map(function (c) {
      var rs = box.querySelector('.' + cls + '-role[data-for="' + c.value.replace(/"/g, '\\"') + '"]');
      return { id: c.value, role: rs ? rs.value : '' };
    });
  };

  /* ============================================================
     devoteeLinkField — the ONE "person = devotee" field for any form.
     A SEARCHABLE combobox over the register (type a name / 10-digit
     mobile / DEV-### code, ↑↓ + Enter) + "+ Add new devotee". Read it
     back with devoteeLinkValue(selId). The value lives in a hidden
     <input id="selId"> so devoteeLinkValue / change events are unchanged.
       opts = { selId, label?, hint?, required?, selectedId?, selectedLabel?, onChange? }
     ============================================================ */
  function personLabel(p) {
    return (p.name || '') + (p.mobile ? ' · ' + p.mobile : '') + (p.city ? ' · ' + p.city : '');
  }
  function findPerson(id) {
    if (id == null || id === '') return null;
    var people = (typeof window.allPeople === 'function') ? window.allPeople() : [];
    return people.filter(function (x) { return String(x.id) === String(id); })[0] || null;
  }

  /* opts.clearable adds a "Remove" action next to "Add new devotee" — for a
     field that names ONE person but isn't actually mandatory (committee
     leader, management lead, event in-charge): it clears the hidden value
     (and, for an already-saved record, the caller's save handler is
     responsible for syncing that clear to the backend — see devLinkClear). */
  window.devoteeLinkField = function (opts) {
    opts = opts || {};
    var selId = opts.selId || 'devLinkSel';
    var label = opts.label || 'Person (devotee)';
    var sel = opts.selectedId != null ? String(opts.selectedId) : '';
    var selP = sel ? findPerson(sel) : null;
    var selText = selP ? personLabel(selP) : (opts.selectedLabel || '');
    if (opts.onChange) window['__dpOnChange_' + selId] = opts.onChange;
    return '<div class="link-section">' +
      '<div class="link-section-head">' +
        '<p class="ls-title">' + esc(label) + (opts.required ? ' <span class="ls-req">*</span>' : '') + '</p>' +
        '<div class="flex gap-2">' +
          (opts.clearable ? '<button type="button" class="btn-add-devotee" onclick="devLinkClear(\'' + selId + '\')">' + esc(opts.clearLabel || 'Remove') + '</button>' : '') +
          '<button type="button" class="btn-add-devotee" onclick="devLinkAdd(\'' + selId + '\')">Add new devotee</button>' +
        '</div>' +
      '</div>' +
      (opts.hint ? '<div class="link-section-hint">' + esc(opts.hint) + '</div>' : '') +
      '<div class="link-field dp-combo" id="' + selId + '__combo">' +
        '<input type="hidden" id="' + selId + '" value="' + esc(sel) + '">' +
        '<input type="text" class="form-input dp-combo-input" id="' + selId + '__q" autocomplete="off" spellcheck="false" ' +
          'placeholder="Search name, mobile or DEV-###" value="' + esc(selText) + '" ' +
          'oninput="dpComboFilter(\'' + selId + '\')" onkeydown="dpComboKey(event,\'' + selId + '\')" ' +
          'onfocus="dpComboOpen(\'' + selId + '\')" onblur="dpComboBlur(\'' + selId + '\')">' +
        '<div class="dp-combo-list" id="' + selId + '__list" hidden></div>' +
      '</div>' +
    '</div>';
  };

  function comboRender(selId, q) {
    var list = document.getElementById(selId + '__list');
    if (!list) return;
    var people = (typeof window.allPeople === 'function') ? window.allPeople() : [];
    var ql = String(q || '').trim().toLowerCase();
    var qd = digits(q);
    var hits = !ql ? people.slice(0, 50) : people.filter(function (p) {
      if (String(p.name || '').toLowerCase().indexOf(ql) !== -1) return true;
      if (qd.length >= 3 && digits(p.mobile).indexOf(qd) !== -1) return true;
      if (String(p.id || '').toLowerCase().indexOf(ql) !== -1) return true;
      if (String(p.city || '').toLowerCase().indexOf(ql) !== -1) return true;
      return false;
    }).slice(0, 50);
    if (!hits.length) {
      list.innerHTML = '<div class="dp-combo-empty">No devotee matches — use “Add new devotee”.</div>';
    } else {
      list.innerHTML = hits.map(function (p, i) {
        return '<div class="dp-combo-opt' + (i === 0 ? ' active' : '') + '" data-id="' + esc(p.id) + '" ' +
          'data-label="' + esc(personLabel(p)) + '" onmousedown="dpComboPick(event,\'' + selId + '\')">' +
          '<strong>' + esc(p.name || '') + '</strong>' +
          '<small>' + [p.id, p.mobile, p.city].filter(Boolean).map(esc).join(' · ') + '</small></div>';
      }).join('');
    }
    list.hidden = false;
  }
  window.dpComboOpen = function (selId) { comboRender(selId, (document.getElementById(selId + '__q') || {}).value || ''); };
  window.dpComboFilter = function (selId) {
    var hid = document.getElementById(selId);
    if (hid && hid.value) { hid.value = ''; try { hid.dispatchEvent(new Event('change')); } catch (e) {} }
    comboRender(selId, (document.getElementById(selId + '__q') || {}).value || '');
  };
  window.dpComboBlur = function (selId) {
    // delay so an onmousedown pick on a list row runs before we close
    setTimeout(function () {
      var list = document.getElementById(selId + '__list');
      if (list) list.hidden = true;
      var hid = document.getElementById(selId), q = document.getElementById(selId + '__q');
      // committed selection → show its canonical label; otherwise keep whatever
      // was typed (so "Add new devotee" can prefill it)
      if (hid && q && hid.value) {
        var p = findPerson(hid.value);
        if (p) q.value = personLabel(p);
      }
    }, 150);
  };
  window.dpComboKey = function (e, selId) {
    var list = document.getElementById(selId + '__list');
    if (!list) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) return dpComboOpen(selId);
      var opts = Array.prototype.slice.call(list.querySelectorAll('.dp-combo-opt'));
      if (!opts.length) return;
      var i = opts.findIndex(function (o) { return o.classList.contains('active'); });
      opts.forEach(function (o) { o.classList.remove('active'); });
      i = e.key === 'ArrowDown' ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1);
      opts[i].classList.add('active');
      opts[i].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      var act = list.querySelector('.dp-combo-opt.active') || list.querySelector('.dp-combo-opt');
      if (act && !list.hidden) { e.preventDefault(); commitPick(selId, act.dataset.id, act.dataset.label); }
    } else if (e.key === 'Escape') {
      list.hidden = true;
    }
  };
  function commitPick(selId, id, label) {
    var hid = document.getElementById(selId), q = document.getElementById(selId + '__q'), list = document.getElementById(selId + '__list');
    if (hid) { hid.value = id || ''; try { hid.dispatchEvent(new Event('change')); } catch (e) {} }
    if (q) q.value = label || '';
    if (list) list.hidden = true;
    var extra = window['__dpOnChange_' + selId];
    if (extra) { try { /* eslint-disable no-new-func */ (new Function(extra))(); } catch (e) {} }
  }
  window.dpComboPick = function (e, selId) {
    e.preventDefault();               // fire before blur closes the list
    var el = e.currentTarget;
    commitPick(selId, el.dataset.id, el.dataset.label);
  };

  window.devLinkAdd = function (selId) {
    if (typeof window.openDevoteeSheet !== 'function') {
      if (typeof showToast === 'function') showToast('Devotee form unavailable');
      return;
    }
    var typed = (document.getElementById(selId + '__q') || {}).value || '';
    window.openDevoteeSheet({
      title: 'Add a new devotee',
      prefillName: typed && !findPerson((document.getElementById(selId) || {}).value) ? typed : '',
      onSaved: function (dev) {
        commitPick(selId, dev.id, dev.name + (dev.mobile ? ' · ' + dev.mobile : '') + (dev.city ? ' · ' + dev.city : ''));
      }
    });
  };
  /* Clears a devoteeLinkField's picked value (see opts.clearable). Only
     clears the FORM field — the caller's own save handler reads the now-
     empty hidden input like any other change and is responsible for
     syncing the removal to the backend (a committee/team/event's "unassign
     leader/lead/in-charge" DELETE route). */
  window.devLinkClear = function (selId) {
    commitPick(selId, '', '');
    var q = document.getElementById(selId + '__q');
    if (q) q.focus();
  };
  /** { id, name, firstName, lastName, mobile, city, state } for the chosen person, or null. */
  window.devoteeLinkValue = function (selId) {
    var hid = document.getElementById(selId);
    if (!hid || !hid.value) return null;
    var p = findPerson(hid.value);
    var name = p ? p.name : (((document.getElementById(selId + '__q') || {}).value || '').split(' · ')[0]);
    var parts = String(name || '').trim().split(/\s+/);
    return {
      id: hid.value, name: name,
      firstName: parts.shift() || '', lastName: parts.join(' '),
      mobile: (p && p.mobile) || '', city: (p && p.city) || '', state: (p && p.state) || 'Gujarat'
    };
  };

  /* One field of markup for an optional extra input.
     f = { name, label, type:'text'|'textarea'|'select', options?, placeholder?, value? } */
  function extraFieldHTML(fld) {
    var nm = 'x_' + fld.name, lbl = esc(fld.label || fld.name), val = esc(fld.value || '');
    if (fld.type === 'select') {
      return '<div class="form-group" style="grid-column:1/-1"><label class="form-label">' + lbl + '</label>' +
        '<select class="form-select" name="' + nm + '">' + (fld.options || []).map(function (o) {
          return '<option value="' + esc(o) + '"' + (o === fld.value ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select></div>';
    }
    if (fld.type === 'textarea') {
      return '<div class="form-group" style="grid-column:1/-1"><label class="form-label">' + lbl + '</label>' +
        '<textarea class="form-input mg-textarea" name="' + nm + '" rows="2" placeholder="' + esc(fld.placeholder || '') + '">' + val + '</textarea></div>';
    }
    return '<div class="form-group"><label class="form-label">' + lbl + '</label>' +
      '<input class="form-input" name="' + nm + '" value="' + val + '" placeholder="' + esc(fld.placeholder || '') + '"></div>';
  }

  /* Category classification — Normal / VIP / Guest / Gurudev-Bhuvaji. A real
     devotees.category column (server/db/migrations/015), not a derived label
     like samaj. Defined once here (loaded before devotees.js, pooja-ui.js,
     invite-ui.js) so every surface that needs the option list or a display
     label shares the same source — never redeclare this list elsewhere.
     Per "data entry stays English": the Add/Edit form's <option> text is the
     plain hardcoded label (devoteeCategoryPlainLabel / …FormOptionsHTML);
     filters, table columns and badges use the translated one (…Label). */
  window.DEVOTEE_CATEGORIES = ['normal', 'vip', 'guest', 'gurudev_bhuvaji'];
  var DV_CAT_LABELS = { normal: 'Normal', vip: 'VIP', guest: 'Guest', gurudev_bhuvaji: 'Gurudev/Bhuvaji' };
  window.devoteeCategoryPlainLabel = function (cat) { return DV_CAT_LABELS[cat] || 'Normal'; };
  window.devoteeCategoryLabel = function (cat) {
    return (typeof window.t === 'function')
      ? window.t('dv_cat_' + (cat || 'normal'), window.devoteeCategoryPlainLabel(cat))
      : window.devoteeCategoryPlainLabel(cat);
  };
  window.devoteeCategoryFormOptionsHTML = function (selected) {
    var sel = selected || 'normal';
    return window.DEVOTEE_CATEGORIES.map(function (c) {
      return '<option value="' + c + '"' + (c === sel ? ' selected' : '') + '>' + window.devoteeCategoryPlainLabel(c) + '</option>';
    }).join('');
  };

  /* The reusable "Add a new devotee" sheet.
       opts = { title?, prefillName?,
                extraFields?: [ {name,label,type,options,placeholder,value} ],
                onSaved(devotee, extras) }
     Identity fields (name / contact / city / state / samaj / category) go to
     the shared devotees record; extraFields are role/context inputs the
     caller attaches to the link (committee-member role, sevarthi notes,
     guest title, …). Dedupes by mobile; persists to /api/devotees when
     online. */
  window.openDevoteeSheet = function (opts) {
    opts = opts || {};
    var pf = String(opts.prefillName || '').trim();
    // The "Samaj / Committee" checklist is the ONE place a person is tied to a
    // committee (and, for this temple, their samaj). Shown by default on every
    // "add a person" surface; a caller can pass committeePicker:false to hide it.
    var showCmtPicker = (opts.committeePicker !== false) && typeof devoteeCommitteeChecklist === 'function';
    var cmtPickerHTML = showCmtPicker ? devoteeCommitteeChecklist(null, []) : '';
    window.__dpCommitteePicker = showCmtPicker;
    window.__dpExtra = Array.isArray(opts.extraFields) ? opts.extraFields : [];
    var extraHTML = window.__dpExtra.length
      ? '<hr class="dp-extra-divider"><div class="dp-form-caption">' +
          esc(opts.extraCaption || 'Details for this role') + '</div>' +
          window.__dpExtra.map(extraFieldHTML).join('')
      : '';

    dpOpenSheet({
      title: opts.title || 'Add a new person (devotee)',
      body:
        '<form id="dpForm" class="grid mg-2col-form">' +
          '<div class="dp-form-caption">Person details — shared devotee record</div>' +
          '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Full name *</label>' +
            '<input class="form-input" name="fullName" value="' + esc(pf) + '" placeholder="e.g. Rameshbhai Rabari" required></div>' +
          '<div class="form-group"><label class="form-label">Contact number *</label>' +
            '<input class="form-input" name="mobile" maxlength="10" inputmode="numeric" placeholder="10-digit mobile" required oninput="dpMobileLookup()">' +
            '<div id="dpHint" class="mg-muted-xs" style="margin-top:.3rem"></div></div>' +
          '<div class="form-group"><label class="form-label">City</label><input class="form-input" name="city"></div>' +
          '<div class="form-group"><label class="form-label">State</label><input class="form-input" name="state" value="Gujarat"></div>' +
          '<div class="form-group" style="grid-column:1/-1"><label class="form-label">' + esc(window.t('dv_category', 'Category')) + '</label>' +
            '<select class="form-select" name="category">' + window.devoteeCategoryFormOptionsHTML(opts.category) + '</select></div>' +
          cmtPickerHTML +
          extraHTML +
        '</form>',
      footer:
        '<button class="btn btn-outline" onclick="dpCloseSheet()">Cancel</button>' +
        '<button class="btn btn-primary" id="dpSaveBtn" onclick="dpSubmit()">Save person</button>',
    });
    window.__dpOnSaved = (typeof opts.onSaved === 'function') ? opts.onSaved : function () {};
  };

  /* live "is this mobile already a devotee?" check */
  window.dpMobileLookup = function () {
    var f = document.getElementById('dpForm'); if (!f) return;
    var hint = document.getElementById('dpHint');
    var m = digits(f.mobile.value);
    if (m.length < 10) { hint.textContent = ''; return; }
    var hit = window.allPeople().filter(function (p) { return digits(p.mobile) === m; })[0];
    if (hit) {
      hint.innerHTML = '<span style="color:var(--success,#2E7D6B)">✓ Already a devotee: <strong>' +
        esc(hit.name) + '</strong>' + (hit.city ? ' · ' + esc(hit.city) : '') +
        '</span> — saving will just re-use this record.';
    } else {
      hint.innerHTML = '<span class="mg-muted-xs">New person — a devotee record will be created.</span>';
    }
  };

  window.dpSubmit = function () {
    var f = document.getElementById('dpForm'); if (!f) return;
    var name = (f.elements['fullName'].value || '').trim().replace(/\s+/g, ' ');
    var mobile = digits(f.mobile.value);
    if (!name) { toast('Full name is required'); return; }
    if (mobile.length !== 10) { toast('Contact number must be 10 digits'); return; }
    var city = f.city.value.trim();
    var st = f.state.value.trim() || 'Gujarat';   // NOT `state` — that's the global store
    var cat = (f.elements['category'] && f.elements['category'].value) || 'normal';
    var extras = {};
    (window.__dpExtra || []).forEach(function (fld) {
      var el = f.elements['x_' + fld.name];
      if (el) extras[fld.name] = (el.value || '').trim();
    });
    var pickedCmt = (window.__dpCommitteePicker && typeof devoteeCommitteePicked === 'function')
      ? devoteeCommitteePicked('dpForm') : null;
    // NOTE: devotees.samaj is deprecated — samaj membership is a committee_members
    // relationship (the checklist), never a column. Nothing samaj-related is sent.

    // dedupe against the register
    var existing = window.allPeople().filter(function (p) { return digits(p.mobile) === mobile; })[0];
    if (existing) {
      finish({ id: existing.id, name: existing.name, mobile: existing.mobile, city: existing.city });
      return;
    }

    var online = !!(window.API && window.API.online);
    if (online) {
      window.API.post('/devotees', { name: name, mobile: mobile, city: city, state: st, category: cat })
        .then(function (d) {
          pushLocal(d.id || d.code, name, mobile, city, d.category || cat);
          finish({ id: d.id || d.code, name: name, mobile: mobile, city: city, category: d.category || cat });
        })
        .catch(function (e) { toast((e && e.message) || 'Could not save'); });
    } else {
      var id = 'DEV-' + Date.now().toString().slice(-6);
      pushLocal(id, name, mobile, city, cat);
      finish({ id: id, name: name, mobile: mobile, city: city, category: cat });
    }

    function pushLocal(id, nm, mob, ct, category) {
      if (typeof state === 'undefined' || !Array.isArray(state.devotees)) return;
      if (!state.devotees.some(function (x) { return digits(x.phone || x.mobile) === digits(mob); })) {
        state.devotees.unshift({ id: id, name: nm, phone: mob, mobile: mob, city: ct, status: 'active', category: category || 'normal', visits: 0 });
      }
    }
    function finish(dev) {
      try {
        if (pickedCmt && pickedCmt.length && dev && dev.id && typeof syncDevoteeCommittees === 'function') {
          syncDevoteeCommittees(dev.id, pickedCmt, true /* add-only from the Add sheet */);
        }
      } catch (e) {}
      try { if (typeof syncEntitySelects === 'function') syncEntitySelects(); } catch (e) {}
      dpCloseSheet();
      toast(dev.name + ' saved.');
      try { (window.__dpOnSaved || function () {})(dev, extras); } catch (e) {}
    }
    function toast(m) { if (typeof showToast === 'function') showToast(m); else if (typeof pjToast === 'function') pjToast(m); }
  };
})();
