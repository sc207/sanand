/* ============================================================
   OFFLINE TRANSLATOR — English <-> Gujarati
   ------------------------------------------------------------
   NLLB-200 (distilled 600M, quantized ONNX) running locally via
   transformers.js. The model is downloaded once into models/ and
   after that the mandir needs no internet.

   This handles FREE TEXT a person types (notes, descriptions).
   The app's own labels are not machine translated — see
   public/js/lang.js for why.
   ============================================================ */
const path = require('path');

const MODEL = 'Xenova/nllb-200-distilled-600M';
const CACHE = path.join(__dirname, '..', 'models');

const LANG = { en: 'eng_Latn', gu: 'guj_Gujr' };

let pipe = null;
let loading = null;
let failed = null;

async function getPipeline() {
  if (pipe) return pipe;
  if (failed) throw failed;
  if (loading) return loading;

  loading = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = CACHE;
    env.allowRemoteModels = true;      // only needed for the first download
    const t0 = Date.now();
    console.log('[translate] loading model (first run downloads ~350MB)…');
    pipe = await pipeline('translation', MODEL, { dtype: 'q8' });
    console.log(`[translate] ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return pipe;
  })().catch((e) => {
    failed = e;
    loading = null;
    console.error('[translate] model unavailable:', e.message);
    throw e;
  });

  return loading;
}

/** Is the model already downloaded and loaded? */
function status() {
  return { ready: !!pipe, loading: !!loading && !pipe, error: failed ? failed.message : null };
}

/* A general model transliterates temple vocabulary instead of using the
   real word ("yagna" came back as યગના, not યજ્ઞ). These are the mandir's
   own terms, so we correct them after the model has run. */
/* No \b here: JavaScript word boundaries only know Latin characters, so
   \b never matches around Gujarati text. */
const GLOSSARY_GU = [
  [/યગના|યાગના|યજ્ઞા(?!ન)/g, 'યજ્ઞ'],
  [/સેવારથી|સેવાર્થિ|સેવર્થી|સેવરથી/g, 'સેવાર્થી'],
  [/સનંદ/g, 'સાનંદ'],
  [/પુજા/g, 'પૂજા'],
  [/ભગતો|ભક્તોઓ/g, 'ભક્તો'],
  [/ગ્રીહા શાન્તી|ગૃહશાંતિ|ગ્રહ શાંતિ/g, 'ગૃહ શાંતિ'],
  [/આરતિ/g, 'આરતી'],
  [/પ્રસાદા/g, 'પ્રસાદ'],
  [/મંદીર/g, 'મંદિર'],
  [/પ્રાણ પ્રતિષ્ટા|પ્રાણપ્રતિષ્ઠા/g, 'પ્રાણ પ્રતિષ્ઠા'],
  [/પટલા|પાટલો/g, 'પાટલા'],
  [/ભગવત/g, 'ભાગવત'],
  [/પધરમણી|પધરામની/g, 'પધરામણી'],
  [/મહોસ્તવ|મહોત્સવા/g, 'મહોત્સવ'],
];
const GLOSSARY_EN = [
  [/\bYagna\b/gi, 'Yagna'],
  [/\bSevarthi\b/gi, 'Sevarthi'],
  [/\bPadhramni\b/gi, 'Padhramni'],
];

/* Proper nouns and ritual terms must never be "translated" — a general
   model turned સાનંદ (the town) into "serenity" and પધરામણી into
   "counseling". These are swapped to their English spelling BEFORE the
   model runs, so it simply carries them through untouched. */
const TERMS = [
  ['પ્રાણ પ્રતિષ્ઠા', 'Pran Pratishtha'],
  ['ભાગવત સપ્તાહ', 'Bhagvat Saptah'],
  ['વિહત મેલડી', 'Vihat Meldi'],
  ['પધરામણી', 'Padhramni'],
  ['સેવાર્થી', 'Sevarthi'],
  ['મહોત્સવ', 'Mahotsav'],
  ['ભુવાજી', 'Bhuvaji'],
  ['સાનંદ', 'Sanand'],
  ['પ્રસાદ', 'prasad'],
  ['આરતી', 'aarti'],
  ['પાટલા', 'patla'],
  ['ભાગવત', 'Bhagvat'],
  ['મેલડી', 'Meldi'],
  ['સમાજ', 'samaj'],
  ['યજ્ઞ', 'yagna'],
  ['કથા', 'katha'],
  ['પૂજા', 'pooja'],
  ['સેવા', 'seva'],
  ['દાન', 'donation'],
  ['બાપા', 'Bapa'],
];

/** Swap Gujarati ritual terms for their English spelling before translating. */
function protectTerms(text) {
  let out = text;
  for (const [gu, en] of TERMS) out = out.split(gu).join(en);
  return out;
}

function polish(text, to) {
  let out = text;
  for (const [re, fix] of (to === 'gu' ? GLOSSARY_GU : GLOSSARY_EN)) out = out.replace(re, fix);
  return out;
}

async function translate(text, from, to) {
  const src = LANG[from] || LANG.en;
  const tgt = LANG[to] || LANG.gu;
  if (!text || !String(text).trim()) return '';
  if (src === tgt) return text;

  const p = await getPipeline();
  const input = to === 'en' ? protectTerms(String(text)) : String(text);
  const out = await p(input.slice(0, 1000), {
    src_lang: src,
    tgt_lang: tgt,
    max_new_tokens: 256,
  });
  const raw = (Array.isArray(out) ? out[0] : out).translation_text || '';
  return polish(raw, to);
}

/** Guess which way to translate from the script the text is written in. */
function detect(text) {
  return /[઀-૿]/.test(String(text)) ? 'gu' : 'en';
}

module.exports = { translate, status, getPipeline, detect };
