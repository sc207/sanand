/* Thin fetch wrapper. Every call goes through here so auth headers,
   error shape and JSON parsing stay in exactly one place. */
(function (global) {
  'use strict';

  const BASE = '/api';

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem('svmds_user') || 'null')
        || { id: null, name: 'Administrator', role: 'superadmin' };
    } catch (e) {
      return { id: null, name: 'Administrator', role: 'superadmin' };
    }
  }

  function setCurrentUser(user) {
    try { localStorage.setItem('svmds_user', JSON.stringify(user)); } catch (e) { /* private mode */ }
  }

  async function request(method, path, body, query) {
    let url = BASE + path;
    if (query) {
      const qs = new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ).toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }

    const opts = {
      method,
      headers: {
        'Accept': 'application/json',
        'X-User-Name': encodeURIComponent(currentUser().name || 'Unknown'),
      },
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, opts);
    } catch (networkErr) {
      throw new Error('Cannot reach the server. Check that it is running.');
    }

    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }

    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* A spreadsheet goes up as its own bytes, not as JSON and not as
     multipart: `fetch` sends a File as the body unchanged, and the
     server already has express.raw, so neither side needs an upload
     library — which the offline rule would have made awkward anyway.
     The name travels in a header because the body is only bytes, and
     the server uses it to tell a .xls apart from a real workbook. */
  async function postFile(path, file, query) {
    let url = BASE + path;
    const qs = new URLSearchParams(
      Object.entries(query || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (qs) url += '?' + qs;

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name || ''),
          'X-User-Name': encodeURIComponent(currentUser().name || 'Unknown'),
        },
        body: file,
      });
    } catch (networkErr) {
      throw new Error('Cannot reach the server. Check that it is running.');
    }
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  global.API = {
    currentUser,
    setCurrentUser,
    postFile,
    get: (p, q) => request('GET', p, undefined, q),
    post: (p, b) => request('POST', p, b),
    put: (p, b) => request('PUT', p, b),
    del: (p) => request('DELETE', p),

    // Domain shortcuts — keeps page code readable.
    lookups: (type) => request('GET', '/lookups', undefined, { type }),
    addLookup: (type, value) => request('POST', '/lookups', { type, value }),
    dashboard: () => request('GET', '/dashboard'),
    categories: () => request('GET', '/poojas/categories'),
    poojas: (category) => request('GET', '/poojas', undefined, { category }),
    pooja: (id) => request('GET', `/poojas/${id}`),
    devotees: (params) => request('GET', '/devotees', undefined, params),
    devotee: (id) => request('GET', `/devotees/${id}`),
    bookings: (params) => request('GET', '/bookings', undefined, params),
    outstanding: (search) => request('GET', '/payments/outstanding', undefined, { search }),
    payments: (params) => request('GET', '/payments', undefined, params),
    paymentsByDay: (month) => request('GET', '/payments/by-day', undefined, { month }),
    donations: (params) => request('GET', '/donations', undefined, params),
    visits: (params) => request('GET', '/visits', undefined, params),
    calendar: (month) => request('GET', '/calendar', undefined, { month }),
    settings: () => request('GET', '/settings'),
    users: () => request('GET', '/users'),
    audit: (params) => request('GET', '/audit', undefined, params),

    importKinds: () => request('GET', '/import/kinds'),
    sevaNames: () => request('GET', '/import/seva-names'),
    /* A plain link, not a fetch — the browser's own download handling
       is what puts the file on disk with its name. */
    importTemplateUrl: (kind) => BASE + '/import/template/' + encodeURIComponent(kind),
    importPreview: (kind, file, opts) => postFile('/import/preview', file, { kind, ...opts }),
    importCommit: (kind, file, opts) => postFile('/import/commit', file, { kind, ...opts }),
  };
})(window);
