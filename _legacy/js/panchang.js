/* ============================================================
   Panchang — dependency-free Tithi ↔ Gregorian for the temple's annual events.

   Moderate-precision apparent geocentric longitudes of the Sun (Meeus ch.25)
   and Moon (Meeus ch.47, ~16 largest longitude terms → ~0.05°). A tithi is
   12° of elongation and lasts ~24h, so this resolves "which civil day" a tithi
   falls on reliably; residual boundary cases are handled by the admin's
   per-year override on the event.

   Amanta month naming: a lunar month is named after the solar rashi the Sun is
   in when that month BEGINS (at its new moon). Evaluated at ~06:00 IST
   (sunrise convention) for Sanand.

   Accuracy: matches published Gujarati panchang within ±1 day for ordinary
   years. Years with an adhika (extra) lunar month are not modelled and may be
   off or unresolved — the admin pins the correct Gregorian date for that year
   on the event (overrides win over the calculation).

   Works both as a browser global (window.Panchang) and as a CommonJS module.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Panchang = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var D2R = Math.PI / 180;
  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }
  var MASA_KEYS = ['Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada',
                   'Ashwin', 'Kartik', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna'];

  /* Julian Day from a UTC Date */
  function jdFromUTC(d) {
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    var day = d.getUTCDate() + (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) / 24;
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
  }

  /* A civil date (year, monthIndex 0-11, day) at 06:00 India Standard Time,
     expressed as a UTC Date → 00:30 UTC the same calendar day. */
  function istMorningUTC(y, mo, day) {
    return new Date(Date.UTC(y, mo, day, 0, 30, 0)); // 06:00 IST
  }

  /* Sun apparent longitude, degrees (Meeus 25) */
  function sunLongitude(jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    var Mr = M * D2R;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
          + 0.000289 * Math.sin(3 * Mr);
    var trueLong = L0 + C;
    var omega = 125.04 - 1934.136 * T;
    return norm360(trueLong - 0.00569 - 0.00478 * Math.sin(omega * D2R));
  }

  /* Moon apparent longitude, degrees (Meeus 47, abridged) */
  function moonLongitude(jd) {
    var T = (jd - 2451545.0) / 36525.0;
    var Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841 - T * T * T * T / 65194000;
    var Dm = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868 - T * T * T * T / 113065000;
    var M  = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T + T * T * T / 24490000;
    var Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699 - T * T * T * T / 14712000;
    var F  = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T - T * T * T / 3526000 + T * T * T * T / 863310000;
    var E = 1 - 0.002516 * T - 0.0000074 * T * T;
    Lp = norm360(Lp); Dm *= D2R; M *= D2R; Mp *= D2R; F *= D2R;
    var s = 0;
    s += 6288774 * Math.sin(Mp);
    s += 1274027 * Math.sin(2 * Dm - Mp);
    s +=  658314 * Math.sin(2 * Dm);
    s +=  213618 * Math.sin(2 * Mp);
    s += -185116 * Math.sin(M) * E;
    s += -114332 * Math.sin(2 * F);
    s +=   58793 * Math.sin(2 * Dm - 2 * Mp);
    s +=   57066 * Math.sin(2 * Dm - M - Mp) * E;
    s +=   53322 * Math.sin(2 * Dm + Mp);
    s +=   45758 * Math.sin(2 * Dm - M) * E;
    s +=  -40923 * Math.sin(M - Mp) * E;
    s +=  -34720 * Math.sin(Dm);
    s +=  -30383 * Math.sin(M + Mp) * E;
    s +=   15327 * Math.sin(2 * Dm - 2 * F);
    s +=  -12528 * Math.sin(Mp + 2 * F);
    s +=   10980 * Math.sin(Mp - 2 * F);
    s +=   10675 * Math.sin(4 * Dm - Mp);
    s +=   10034 * Math.sin(3 * Mp);
    return norm360(Lp + s / 1000000);
  }

  /* Elongation (moon − sun), degrees. Ayanamsa cancels in the difference, so
     tithi/paksha are unaffected by tropical-vs-sidereal. */
  function elongation(jd) { return norm360(moonLongitude(jd) - sunLongitude(jd)); }

  /* Lahiri ayanamsa (deg): tropical → sidereal offset. ~50.29"/yr from a
     J2000 value near 23.853°. Only the masa (absolute rashi) needs this. */
  function ayanamsa(jd) {
    return 23.853 + 0.013969 * ((jd - 2451545.0) / 365.25);
  }
  function siderealSunLongitude(jd) { return norm360(sunLongitude(jd) - ayanamsa(jd)); }

  /* JD of the new moon for lunation number k (Meeus ch.49, truncated → ~1 min) */
  function newMoonJD(k) {
    var T = k / 1236.85;
    var JDE = 2451550.09766 + 29.530588861 * k
            + 0.00015437 * T * T - 0.000000150 * T * T * T + 0.00000000073 * T * T * T * T;
    var M  = (2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T * T * T) * D2R;
    var Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T * T * T - 0.000000058 * T * T * T * T) * D2R;
    var F  = (160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T * T * T + 0.000000011 * T * T * T * T) * D2R;
    var Om = (124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T * T * T) * D2R;
    var E = 1 - 0.002516 * T - 0.0000074 * T * T;
    JDE += -0.40720 * Math.sin(Mp)
         + 0.17241 * E * Math.sin(M)
         + 0.01608 * Math.sin(2 * Mp)
         + 0.01039 * Math.sin(2 * F)
         + 0.00739 * E * Math.sin(Mp - M)
         - 0.00514 * E * Math.sin(Mp + M)
         + 0.00208 * E * E * Math.sin(2 * M)
         - 0.00111 * Math.sin(Mp - 2 * F)
         - 0.00057 * Math.sin(Mp + 2 * F)
         + 0.00056 * E * Math.sin(2 * Mp + M)
         - 0.00042 * Math.sin(3 * Mp)
         + 0.00042 * E * Math.sin(M + 2 * F)
         + 0.00038 * E * Math.sin(M - 2 * F)
         - 0.00024 * E * Math.sin(2 * Mp - M)
         - 0.00017 * Math.sin(Om)
         - 0.00007 * Math.sin(Mp + 2 * M)
         + 0.00004 * Math.sin(2 * Mp - 2 * F)
         + 0.00004 * Math.sin(3 * M)
         + 0.00003 * Math.sin(Mp + M - 2 * F)
         + 0.00003 * Math.sin(2 * Mp + 2 * F)
         - 0.00003 * Math.sin(Mp + M + 2 * F)
         + 0.00003 * Math.sin(Mp - M + 2 * F)
         - 0.00002 * Math.sin(Mp - M - 2 * F)
         - 0.00002 * Math.sin(3 * Mp + M)
         + 0.00002 * Math.sin(4 * Mp);
    return JDE;
  }

  /* Tithi at a civil date (IST-morning). Returns
     { index:0-29, paksha:'shukla'|'krishna', num:1-15 } */
  function tithiInfo(y, mo, day) {
    var jd = jdFromUTC(istMorningUTC(y, mo, day));
    var idx = Math.floor(elongation(jd) / 12); // 0..29
    if (idx > 29) idx = 29;
    return { index: idx, paksha: idx < 15 ? 'shukla' : 'krishna', num: (idx % 15) + 1 };
  }

  /* Amanta masa key for a civil date. The lunar month is named for the rashi
     the Sun occupies at the new moon that began it. Validated against Bestu
     Varas / Dussehra / Ganesh Chaturthi. */
  function amantaMasa(y, mo, day) {
    var jd = jdFromUTC(istMorningUTC(y, mo, day));
    var k = Math.floor((jd - 2451550.09766) / 29.530588861);
    // largest new-moon JD not after this date
    var nm = newMoonJD(k);
    while (nm > jd) { k -= 1; nm = newMoonJD(k); }
    while (newMoonJD(k + 1) <= jd) { k += 1; }
    var rashi = Math.floor(siderealSunLongitude(newMoonJD(k)) / 30); // 0=Mesha .. 11=Meena
    return MASA_KEYS[(rashi + 1) % 12];
  }

  /* First Gregorian date in calendar year `year` matching a Tithi spec.
     spec = { masa:'Magha', paksha:'shukla', tithi:2 }
     Returns 'YYYY-MM-DD' or null (not present that Gregorian year). */
  function iso(year, mo, day) {
    return year + '-' + String(mo + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }
  function nextDay(year, mo, day) {
    var d = new Date(year, mo, day + 1);
    return { y: d.getFullYear(), mo: d.getMonth(), d: d.getDate() };
  }

  /* masa of the day, tolerant of the ±1-day ayanamsa wobble at a month
     boundary: accept if this day OR two days later resolves to `want`. */
  function masaMatches(year, mo, day, want) {
    if (amantaMasa(year, mo, day) === want) return true;
    var f = nextDay(year, mo, day); f = nextDay(f.y, f.mo, f.d);
    return amantaMasa(f.y, f.mo, f.d) === want;
  }

  function gregorianForTithi(spec, year) {
    if (!spec || !spec.masa || !spec.paksha || !spec.tithi) return null;
    var wantNum = Number(spec.tithi);
    var fallback = null;
    for (var mo = 0; mo < 12; mo++) {
      var dim = new Date(year, mo + 1, 0).getDate();
      for (var day = 1; day <= dim; day++) {
        var t = tithiInfo(year, mo, day);
        if (t.paksha === spec.paksha && t.num === wantNum && masaMatches(year, mo, day, spec.masa)) {
          return iso(year, mo, day);
        }
        // fallback: the tithi is skipped at 06:00 IST but begins on this day
        if (!fallback) {
          var nd = nextDay(year, mo, day);
          var tn = tithiInfo(nd.y, nd.mo, nd.d);
          if (t.paksha === spec.paksha && tn.paksha === spec.paksha &&
              t.num < wantNum && tn.num > wantNum &&
              masaMatches(year, mo, day, spec.masa)) {
            fallback = iso(year, mo, day);
          }
        }
      }
    }
    return fallback;
  }

  /* Resolve an annual event to a Gregorian ISO date for a year.
     ev = { type, masa, paksha, tithi, fixedMonth, fixedDay, overrides:{...} } */
  function resolveDate(ev, year) {
    year = Number(year);
    var ov = ev.overrides || {};
    // one-off event: only exists for the single year it was created for
    if (ov.once && Number(ov.once) !== year) return { date: null, source: 'once' };
    if (ov[String(year)]) return { date: ov[String(year)], source: 'pinned' };
    if (ev.type === 'FIXED_DATE') {
      if (!ev.fixedMonth || !ev.fixedDay) return { date: null, source: 'fixed' };
      return { date: year + '-' + String(ev.fixedMonth).padStart(2, '0') + '-' + String(ev.fixedDay).padStart(2, '0'), source: 'fixed' };
    }
    return { date: gregorianForTithi({ masa: ev.masa, paksha: ev.paksha, tithi: ev.tithi }, year), source: 'calculated' };
  }

  return { MASA_KEYS: MASA_KEYS, tithiInfo: tithiInfo, amantaMasa: amantaMasa,
           gregorianForTithi: gregorianForTithi, resolveDate: resolveDate,
           sunLongitude: sunLongitude, moonLongitude: moonLongitude };
});
