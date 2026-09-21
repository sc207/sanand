/* ============================================================
   Annual Temple Events — Tithi & important-dates store.
   Part of the Seva & Pooja module (renders in the Pooja directory view).

   Canonical data is English; Gujarati / Hindi strings sit alongside and are
   shown when the portal language is set. TITHI rows store Amanta coordinates
   (masa / paksha / tithi) and the Gregorian date is CALCULATED per selected
   year via js/panchang.js; FIXED_DATE rows use a Gregorian month/day; an
   admin-pinned per-year override always wins.
   ============================================================ */
(function () {
  if (typeof window === 'undefined') return;
  if (typeof window.t !== 'function') window.t = function (k, f) { return f != null ? f : k; };

  var thisYear = new Date().getFullYear();

  window.ANNUAL = {
    year: thisYear,
    loaded: false,
    /* seed mirrors server/db/seed/reference-data.js ANNUAL_EVENTS */
    events: [
      { id: 'ANE-001', name: 'Gujarati New Year (Bestu Varas)', name_gu: 'બેસતું વર્ષ', name_hi: '',
        activity: "Mataji's Gadi", activity_gu: 'માતાજીની ગાદી', activity_hi: '',
        type: 'TITHI', masa: 'Kartik', paksha: 'shukla', tithi: 1, fixedMonth: 0, fixedDay: 0,
        overrides: {}, description: '', notes: '', active: true },
      { id: 'ANE-002', name: 'Maha Sud Bij', name_gu: 'મહા સુદ બીજ', name_hi: '',
        activity: "Mataji's Dhaja", activity_gu: 'માતાજીની ધજા', activity_hi: '',
        type: 'TITHI', masa: 'Magha', paksha: 'shukla', tithi: 2, fixedMonth: 0, fixedDay: 0,
        overrides: {}, description: '', notes: '', active: true },
      { id: 'ANE-003', name: 'Chaitra Sud Punam', name_gu: 'ચૈત્ર સુદ પૂનમ', name_hi: '',
        activity: "Mataji's Ramel", activity_gu: 'માતાજીની રમેલ', activity_hi: '',
        type: 'TITHI', masa: 'Chaitra', paksha: 'shukla', tithi: 15, fixedMonth: 0, fixedDay: 0,
        overrides: {}, description: '', notes: '', active: true },
      { id: 'ANE-004', name: 'Jeth Sud Trij', name_gu: 'જેઠ સુદ ત્રીજ', name_hi: '',
        activity: 'Bhagwan Shri Kamshibapa Sthapana Divas', activity_gu: 'ભગવાન શ્રી કમશીબાપાનો સ્થાપના દિવસ', activity_hi: '',
        type: 'TITHI', masa: 'Jyeshtha', paksha: 'shukla', tithi: 3, fixedMonth: 0, fixedDay: 0,
        overrides: {}, description: '', notes: '', active: true },
      { id: 'ANE-005', name: 'Dussehra', name_gu: 'દશેરા', name_hi: '',
        activity: "Mataji's Gadi", activity_gu: 'માતાજીની ગાદી', activity_hi: '',
        type: 'TITHI', masa: 'Ashwin', paksha: 'shukla', tithi: 10, fixedMonth: 0, fixedDay: 0,
        overrides: {}, description: '', notes: '', active: true },
      { id: 'ANE-006', name: 'Dhanteras', name_gu: 'ધનતેરસ', name_hi: '',
        activity: 'Bhagwan Shri Kamshibapa Birthday', activity_gu: 'ભગવાન શ્રી કમશીબાપાનો જન્મદિવસ', activity_hi: '',
        type: 'TITHI', masa: 'Ashwin', paksha: 'krishna', tithi: 13, fixedMonth: 0, fixedDay: 0,
        overrides: {}, description: '', notes: '', active: true },
      { id: 'ANE-007', name: 'P.P. Bhuvaji Shri Sureshbapa Birthday', name_gu: 'પ.પૂ. ભુવાજી શ્રી સુરેશબાપાનો જન્મદિવસ', name_hi: '',
        activity: 'Birthday', activity_gu: 'જન્મદિવસ', activity_hi: '',
        type: 'FIXED_DATE', masa: '', paksha: '', tithi: 0, fixedMonth: 9, fixedDay: 27,
        overrides: {}, description: '', notes: '', active: true }
    ]
  };

  /* ---- localisation maps ---- */
  var MASA_GU = {
    Chaitra: 'ચૈત્ર', Vaishakha: 'વૈશાખ', Jyeshtha: 'જેઠ', Ashadha: 'અષાઢ', Shravana: 'શ્રાવણ',
    Bhadrapada: 'ભાદરવો', Ashwin: 'આસો', Kartik: 'કારતક', Margashirsha: 'માગશર', Pausha: 'પોષ',
    Magha: 'મહા', Phalguna: 'ફાગણ'
  };
  var MASA_HI = {
    Chaitra: 'चैत्र', Vaishakha: 'वैशाख', Jyeshtha: 'ज्येष्ठ', Ashadha: 'आषाढ़', Shravana: 'श्रावण',
    Bhadrapada: 'भाद्रपद', Ashwin: 'आश्विन', Kartik: 'कार्तिक', Margashirsha: 'मार्गशीर्ष', Pausha: 'पौष',
    Magha: 'माघ', Phalguna: 'फाल्गुन'
  };
  var PAKSHA = {
    gu: { shukla: 'સુદ', krishna: 'વદ' },
    hi: { shukla: 'शुक्ल', krishna: 'कृष्ण' },
    en: { shukla: 'Sud', krishna: 'Vad' }
  };
  var GU_DIGITS = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'];

  function lang() { return (typeof currentLang === 'function') ? currentLang() : 'en'; }
  function guNum(n) { return String(n).replace(/\d/g, function (d) { return GU_DIGITS[+d]; }); }

  /* ---- helpers ---- */
  window.annualEventById = function (id) {
    return window.ANNUAL.events.filter(function (e) { return e.id === id; })[0] || null;
  };

  window.annualName = function (ev) {
    var l = lang();
    if (l === 'gu' && ev.name_gu) return ev.name_gu;
    if (l === 'hi' && ev.name_hi) return ev.name_hi;
    return ev.name;
  };
  window.annualActivity = function (ev) {
    var l = lang();
    if (l === 'gu' && ev.activity_gu) return ev.activity_gu;
    if (l === 'hi' && ev.activity_hi) return ev.activity_hi;
    return ev.activity;
  };

  /* "મહા સુદ ૨" / "Magha Sud 2" — the Tithi coordinate, distinct from a date */
  window.annualTithiLabel = function (ev) {
    if (ev.type === 'FIXED_DATE') {
      var mn = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return (ev.fixedDay || '') + ' ' + (mn[ev.fixedMonth] || '') + ' — ' + window.t('ann_fixed', 'fixed date');
    }
    var l = lang();
    var masa = l === 'gu' ? (MASA_GU[ev.masa] || ev.masa) : l === 'hi' ? (MASA_HI[ev.masa] || ev.masa) : ev.masa;
    var pk = (PAKSHA[l] || PAKSHA.en)[ev.paksha] || ev.paksha;
    var ti = l === 'gu' ? guNum(ev.tithi) : ev.tithi;
    return masa + ' ' + pk + ' ' + ti;
  };

  /* resolve to { date:'YYYY-MM-DD'|null, source:'pinned'|'fixed'|'calculated' }
     — memoised: the year-scan is cheap but the calendar re-renders often. */
  var _resolveCache = {};
  window.annualClearCache = function () { _resolveCache = {}; };
  window.annualResolve = function (ev, year) {
    year = year || window.ANNUAL.year;
    var ck = (ev.id || ev.code || ev.name) + '|' + year + '|' + JSON.stringify(ev.overrides || {});
    if (_resolveCache[ck]) return _resolveCache[ck];
    var out;
    if (window.Panchang && window.Panchang.resolveDate) {
      out = window.Panchang.resolveDate(ev, year);
      _resolveCache[ck] = out;
      return out;
    }
    // no calculator loaded → only overrides / fixed
    var ovAll = ev.overrides || {};
    if (ovAll.once && Number(ovAll.once) !== Number(year)) return { date: null, source: 'once' };
    var ov = ovAll[String(year)];
    if (ov) return { date: ov, source: 'pinned' };
    if (ev.type === 'FIXED_DATE' && ev.fixedMonth && ev.fixedDay) {
      return { date: year + '-' + String(ev.fixedMonth).padStart(2, '0') + '-' + String(ev.fixedDay).padStart(2, '0'), source: 'fixed' };
    }
    return { date: null, source: 'calculated' };
  };

  window.annualLocDate = function (iso) {
    if (!iso) return window.t('ann_not_set', 'date not set — pin it');
    return (typeof locDate === 'function') ? locDate(iso) : iso;
  };

  /* is this a one-off (single-year) event, and for which year? */
  window.annualOnceYear = function (ev) {
    var y = ev && ev.overrides && ev.overrides.once;
    return y ? Number(y) : null;
  };

  /* events for the selected year, resolved + sorted by Gregorian date.
     One-off events only appear in the single year they belong to. */
  window.annualForYear = function (year, includeInactive) {
    year = year || window.ANNUAL.year;
    return window.ANNUAL.events
      .filter(function (e) { return includeInactive || e.active; })
      .filter(function (e) {
        var oy = window.annualOnceYear(e);
        return !oy || oy === Number(year);
      })
      .map(function (e) {
        var r = window.annualResolve(e, year);
        return Object.assign({}, e, { year: year, gregorianDate: r.date, dateSource: r.source });
      })
      .sort(function (a, b) { return (a.gregorianDate || '9999').localeCompare(b.gregorianDate || '9999'); });
  };

  /* ---- backend sync (used when API.online) ---- */
  window.annualLoad = function () {
    if (!window.API || !window.API.online) return Promise.resolve(false);
    return window.API.get('/annual-events?all=1&year=' + window.ANNUAL.year)
      .then(function (res) {
        if (res && Array.isArray(res.events)) {
          window.ANNUAL.events = res.events.map(function (e) {
            return {
              id: e.id, name: e.name, name_gu: e.name_gu || '', name_hi: e.name_hi || '',
              activity: e.activity || '', activity_gu: e.activity_gu || '', activity_hi: e.activity_hi || '',
              type: e.type, masa: e.masa || '', paksha: e.paksha || '', tithi: e.tithi || 0,
              fixedMonth: e.fixedMonth || 0, fixedDay: e.fixedDay || 0,
              overrides: e.overrides || {}, description: e.description || '', notes: e.notes || '',
              active: e.active !== false
            };
          });
          window.ANNUAL.loaded = true;
        }
        return true;
      })
      .catch(function () { return false; });
  };
})();
