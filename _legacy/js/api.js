/* Thin REST client for the SVMDS backend. Loaded before every module script.
   All calls send the session cookie; a 401 bounces to /login.
   When the backend is unreachable (app opened as a static file), API.online is
   false and modules keep running on their in-memory seed data. */
window.API = (function () {
  var BASE = '/api';

  async function req(method, path, body) {
    var res;
    try {
      res = await fetch(BASE + path, {
        method: method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (netErr) {
      var e = new Error('network');
      e.offline = true;
      throw e;
    }

    if (res.status === 401) {
      window.location.replace('/login');
      throw new Error('unauthorized');
    }

    var data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      var err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  /* In-flight de-dupe: a double-submit (or a re-render firing the same save
     twice) collapses to ONE network call while the first is pending. Keyed on
     method + path + body. GETs are not de-duped here (cheap, and callers may
     want a fresh read). */
  var inflight = {};
  function keyed(method, path, body) {
    return method + ' ' + path + ' ' + (body === undefined ? '' : JSON.stringify(body));
  }
  function dedup(method, path, body) {
    var k = keyed(method, path, body);
    if (inflight[k]) return inflight[k];
    var p = req(method, path, body).then(
      function (v) { delete inflight[k]; return v; },
      function (e) { delete inflight[k]; throw e; }
    );
    inflight[k] = p;
    return p;
  }

  return {
    get:   function (p) { return req('GET', p); },
    post:  function (p, b) { return dedup('POST', p, b === undefined ? {} : b); },
    put:   function (p, b) { return dedup('PUT', p, b === undefined ? {} : b); },
    patch: function (p, b) { return dedup('PATCH', p, b === undefined ? {} : b); },
    del:   function (p) { return dedup('DELETE', p); },

    /* Fire a create, then copy the server's authoritative fields back onto the
       optimistic local row. `pick` names the fields to copy (server DTO key →
       local key, or a plain string when they match). Returns the server DTO.
       On failure the local row is marked `_syncFailed` and the error re-thrown
       so the caller can toast + offer a retry. */
    postReconcile: function (path, body, localRow, pick) {
      return dedup('POST', path, body === undefined ? {} : body).then(function (dto) {
        if (localRow && dto) {
          localRow.id = dto.code || dto.id || localRow.id;
          localRow._syncFailed = false;
          (pick || []).forEach(function (f) {
            var from = f, to = f;
            if (f && typeof f === 'object') { from = f.from; to = f.to; }
            if (dto[from] !== undefined && dto[from] !== null) localRow[to] = dto[from];
          });
        }
        return dto;
      }, function (err) {
        if (localRow) localRow._syncFailed = true;
        throw err;
      });
    },

    /* Populated by the inline auth gate in index.html (may be null in demo mode). */
    session: (typeof window !== 'undefined' && window.__SESSION) || null,
    online:  !!(typeof window !== 'undefined' && window.__SESSION),

    /** Convenience: does the logged-in user hold this role? */
    hasRole: function (role) {
      var s = this.session;
      return !!(s && s.user && s.user.roles && s.user.roles.indexOf(role) !== -1);
    },
    /** Convenience: may the logged-in user open this page id? */
    canOpen: function (pageId) {
      var s = this.session;
      if (!s || !s.pages) return true;               // demo mode → unrestricted
      return s.pages.indexOf('*') !== -1 || s.pages.indexOf(pageId) !== -1;
    },
  };
})();
