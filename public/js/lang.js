/* ============================================================
   LANGUAGE — English / ગુજરાતી
   ------------------------------------------------------------
   The app's own labels are translated here, not by a machine: a
   temple's vocabulary is exact (સેવાર્થી, પ્રાણ પ્રતિષ્ઠા, પાટલા) and a
   generic translator mangles it. This table is the whole UI, so
   switching language is instant and works with no internet.

   Free text a person types — notes, descriptions — is a different
   problem and goes through the offline translator (translate.js).
   ============================================================ */
(function (global) {
  'use strict';

  const GU = {
    /* chrome */
    'Dashboard': 'ડેશબોર્ડ',
    'Universal Calendar': 'સંકલિત કેલેન્ડર',
    'Overview': 'ઝાંખી',
    'Mahotsav': 'મહોત્સવ',
    'Pran Pratishtha': 'પ્રાણ પ્રતિષ્ઠા',
    'Payment Received': 'પ્રાપ્ત રકમ',
    'Invitation': 'આમંત્રણ',
    'Devotees & Seva': 'ભક્તો અને સેવા',
    'Devotee Register': 'ભક્ત નોંધણી',
    'Devotee': 'ભક્ત',
    'Padhramni': 'પધરામણી',
    'Donation': 'દાન',
    'Administration': 'વહીવટ',
    'Settings': 'સેટિંગ્સ',
    'Accounts & Access': 'ખાતાં અને પ્રવેશ',
    'Home': 'ઘર',
    'Payments': 'ચુકવણી',
    'More': 'વધુ',
    'All sections': 'બધા વિભાગો',

    /* actions */
    'Add Sevarthi': 'સેવાર્થી ઉમેરો',
    'Add Payment': 'ચુકવણી ઉમેરો',
    'Add Samaj': 'સમાજ ઉમેરો',
    'Add Devotee': 'ભક્ત ઉમેરો',
    'Add Donation': 'દાન ઉમેરો',
    'Add Padhramni': 'પધરામણી ઉમેરો',
    'Add Devotee Category': 'ભક્ત શ્રેણી ઉમેરો',
    'Devotee Category': 'ભક્ત શ્રેણી',
    'Donation Category': 'દાન શ્રેણી',
    'Quick Add': 'ઝડપી ઉમેરો',
    'Save': 'સાચવો',
    'Save Sevarthi': 'સેવાર્થી સાચવો',
    'Save Payment': 'ચુકવણી સાચવો',
    'Save Details': 'વિગતો સાચવો',
    'Cancel': 'રદ કરો',
    'Close': 'બંધ કરો',
    'Delete': 'કાઢી નાખો',
    'Remove': 'દૂર કરો',
    'Edit': 'ફેરફાર',
    'Add': 'ઉમેરો',
    'Create': 'બનાવો',
    'Back': 'પાછળ',
    'Open': 'ખોલો',
    'Print': 'છાપો',
    'Search': 'શોધો',
    'Confirm': 'ખાતરી કરો',
    'Please confirm': 'કૃપા કરી ખાતરી કરો',
    'Add Seva': 'સેવા ઉમેરો',
    'Add User': 'વપરાશકર્તા ઉમેરો',
    'New': 'નવું',
    'Sevarthi': 'સેવાર્થી',
    'Payment': 'ચુકવણી',
    'Visit': 'પધરામણી',
    'User': 'વપરાશકર્તા',

    /* dashboard */
    'Received': 'પ્રાપ્ત',
    'Outstanding': 'બાકી',
    "Bapa's Support": 'બાપાનો સહયોગ',
    "Bapa's share": 'બાપાનો હિસ્સો',
    'today': 'આજે',
    'covered for sevarthi': 'સેવાર્થી માટે આપેલ',
    'devotees registered': 'ભક્તો નોંધાયેલા',
    'sevarthi pending': 'સેવાર્થી બાકી',
    'Mahotsav Progress': 'મહોત્સવ પ્રગતિ',
    'Recent activity': 'તાજેતરની પ્રવૃત્તિ',
    'Today at the mandir': 'આજે મંદિરમાં',
    'No activity yet': 'હજી કોઈ પ્રવૃત્તિ નથી',
    'Full': 'ભરાઈ ગયું',

    /* mahotsav */
    'Murti Pran Pratishtha Mahotsav': 'મૂર્તિ પ્રાણ પ્રતિષ્ઠા મહોત્સવ',
    'Maha Yagna': 'મહા યજ્ઞ',
    'Mandir ni Pooja': 'મંદિરની પૂજા',
    'Bhagvat Saptah — Katha': 'ભાગવત સપ્તાહ — કથા',
    'Seats': 'બેઠકો',
    'Committed': 'વચન આપેલ',
    'Day-wise seating (patla)': 'દિવસ પ્રમાણે બેઠક (પાટલા)',
    'Sevarthi ledger': 'સેવાર્થી ખાતાવહી',
    'in order of joining': 'જોડાયાના ક્રમમાં',
    'tap a day to change count': 'સંખ્યા બદલવા દિવસ પર ટેપ કરો',
    'Pick a day': 'દિવસ પસંદ કરો',
    'open': 'ખાલી',
    'open seating': 'ખુલ્લી બેઠક',
    'Seats for this day': 'આ દિવસની બેઠકો',
    'Patla count (seats)': 'પાટલાની સંખ્યા',
    'No sevarthi yet': 'હજી કોઈ સેવાર્થી નથી',
    'Contribution': 'ફાળો',
    'Total Contribution': 'કુલ ફાળો',
    'Covered by Bapa': 'બાપા આપશે',
    'Which part of the Mahotsav is this seva for?': 'આ સેવા મહોત્સવના કયા ભાગ માટે છે?',

    /* devotee form */
    'Full Name': 'પૂરું નામ',
    'Mobile No.': 'મોબાઈલ નં.',
    'Mobile': 'મોબાઈલ',
    'City': 'શહેર',
    'State': 'રાજ્ય',
    'Mul Vatan': 'મૂળ વતન',
    'Samaj': 'સમાજ',
    'Note': 'નોંધ',
    'Notes': 'નોંધ',
    'Address': 'સરનામું',
    'Date': 'તારીખ',
    'Time': 'સમય',
    'Purpose': 'હેતુ',
    'Status': 'સ્થિતિ',
    'Amount': 'રકમ',
    'Amount Received': 'મળેલી રકમ',
    'Receipt No.': 'પહોંચ નં.',
    'Donor Name': 'દાતાનું નામ',
    'In-kind item': 'વસ્તુ સ્વરૂપે',
    'Paid by': 'ચૂકવનાર',
    'Bapa': 'બાપા',
    'Name': 'નામ',
    'Role': 'ભૂમિકા',
    'Email': 'ઈમેલ',
    'Active': 'સક્રિય',
    '— Select —': '— પસંદ કરો —',

    /* statuses */
    'Pending': 'બાકી',
    'Part paid': 'આંશિક ચૂકવેલ',
    'Paid': 'ચૂકવેલ',
    'Cancelled': 'રદ',
    'Requested': 'વિનંતી',
    'Confirmed': 'નક્કી',
    'Completed': 'પૂર્ણ',
    'Open': 'ખુલ્લું',
    'Closed': 'બંધ',

    /* payments / donations */
    'This month': 'આ મહિને',
    'Day-wise': 'દિવસ પ્રમાણે',
    'Show whole month': 'આખો મહિનો બતાવો',
    'Whole month': 'આખો મહિનો',
    'All entries this month': 'આ મહિનાની બધી નોંધો',
    'Record Payment': 'ચુકવણી નોંધો',
    'Still due': 'બાકી',
    'Received so far': 'અત્યાર સુધી મળેલ',
    'due': 'બાકી',
    'entries': 'નોંધો',
    'Nothing pending': 'કંઈ બાકી નથી',
    'No payments': 'કોઈ ચુકવણી નથી',
    'No donations': 'કોઈ દાન નથી',
    'All collections are recorded as cash.': 'બધી રકમ રોકડ તરીકે નોંધાય છે.',

    /* visits */
    'Bappa / Bhuvaji Padhramni': 'બાપા / ભુવાજી પધરામણી',
    "Visits to devotees' homes and shops": 'ભક્તોના ઘર અને દુકાને પધરામણી',
    'Upcoming': 'આગામી',
    'All': 'બધા',
    'No padhramni': 'કોઈ પધરામણી નથી',

    /* misc */
    'Devotees': 'ભક્તો',
    'Donations': 'દાન',
    'Nothing scheduled': 'કંઈ નક્કી નથી',
    'Could not load': 'લોડ થઈ શક્યું નહીં',
    'Start typing': 'લખવાનું શરૂ કરો',
    'No match': 'કંઈ મળ્યું નહીં',
    'Signed in as': 'આ નામે કાર્યરત',
    'Users': 'વપરાશકર્તાઓ',
    'Audit Trail': 'કાર્ય નોંધ',
    'Temple Identity': 'મંદિર ઓળખ',
    'Managed Lists': 'સંચાલિત યાદીઓ',
    'Existing': 'હાલના',
    'Language': 'ભાષા',
    'English': 'English',
    'ગુજરાતી': 'ગુજરાતી',
  };

  /* Phrases built around a number can't be looked up whole, so they are
     matched by shape. Anchored, so a partial sentence never matches. */
  const PATTERNS = [
    [/^(.+) sevarthi pending$/, '$1 સેવાર્થી બાકી'],
    [/^(.+) devotees registered$/, '$1 ભક્તો નોંધાયેલા'],
    [/^(.+) devotee$/, '$1 ભક્ત'],
    [/^(.+) devotees$/, '$1 ભક્તો'],
    [/^(.+) today$/, 'આજે $1'],
    [/^target (.+)$/, 'લક્ષ્ય $1'],
    [/^(.+) received$/, '$1 મળ્યા'],
    [/^of (.+)$/, '$1 માંથી'],
    [/^(.+) patla booked$/, '$1 પાટલા નોંધાયા'],
    [/^(.+) patla$/, '$1 પાટલા'],
    [/^(.+) still open$/, '$1 હજી ખાલી'],
    [/^(.+) open$/, '$1 ખાલી'],
    [/^(.+) joined$/, '$1 જોડાયા'],
    [/^(.+) entries$/, '$1 નોંધો'],
    [/^(.+) entr(?:y|ies)$/, '$1 નોંધ'],
    [/^(.+) sevarthi joined · open seating$/, '$1 સેવાર્થી જોડાયા · ખુલ્લી બેઠક'],
    [/^(.+) sevarthi$/, '$1 સેવાર્થી'],
    [/^by (.+) sevarthi$/, '$1 સેવાર્થી દ્વારા'],
    [/^(.+) pooja$/, '$1 પૂજા'],
    [/^(.+) poojas$/, '$1 પૂજાઓ'],
    [/^(.+) day$/, '$1 દિવસ'],
    [/^(.+) days$/, '$1 દિવસ'],
    [/^(.+) payment$/, '$1 ચુકવણી'],
    [/^(.+) payments$/, '$1 ચુકવણી'],
    [/^(.+) seva$/, '$1 સેવા'],
    [/^still to collect$/, 'હજી લેવાના'],
    [/^no target set$/, 'લક્ષ્ય નક્કી નથી'],
    [/^of this month$/, 'આ મહિનાના'],
  ];

  function applyPatterns(s) {
    for (const [re, out] of PATTERNS) {
      if (re.test(s)) return s.replace(re, out);
    }
    return null;
  }

  const KEY = 'svmds_lang';
  let current = 'en';
  try { current = localStorage.getItem(KEY) || 'en'; } catch (e) { /* private mode */ }

  /** Translate one label. Unknown strings fall through unchanged. */
  function t(s) {
    if (current === 'en') return s;
    return GU[s] || s;
  }

  function lang() { return current; }

  function setLang(code) {
    current = code === 'gu' ? 'gu' : 'en';
    try { localStorage.setItem(KEY, current); } catch (e) { /* ignore */ }
    document.documentElement.lang = current;
    document.documentElement.classList.toggle('lang-gu', current === 'gu');
    if (typeof refreshPage === 'function') refreshPage();
    paintStaticLabels();
  }

  /** Re-label the parts of the shell that live in index.html. */
  function paintStaticLabels() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
  }

  /* Names, amounts and anything else a person typed must never be
     translated — only the app's own wording. */
  const DATA_SELECTOR = '.row-title, .cat-name, .stat-value, .row-amount, .banner-title,' +
                        ' .brand-text, input, textarea, [data-no-i18n]';

  /** Translate the app's own wording inside a freshly rendered subtree.
      Only exact, whole-string matches from the table above are touched. */
  function translateTree(root) {
    if (current === 'en' || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const s = node.nodeValue.trim();
        if (!s) return NodeFilter.FILTER_REJECT;
        if (!GU[s] && !applyPatterns(s)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement && node.parentElement.closest(DATA_SELECTOR)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const hits = [];
    while (walker.nextNode()) hits.push(walker.currentNode);
    for (const node of hits) {
      const s = node.nodeValue.trim();
      const out = GU[s] || applyPatterns(s);
      if (out) node.nodeValue = node.nodeValue.replace(s, out);
    }
    // placeholders too
    root.querySelectorAll('[placeholder]').forEach((el) => {
      const p = el.getAttribute('placeholder');
      if (GU[p]) el.setAttribute('placeholder', GU[p]);
    });
  }

  global.Lang = { t, lang, setLang, paintStaticLabels, translateTree, dictionary: GU };
  global.t = t;    // short alias used across the page modules
})(window);
