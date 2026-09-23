/* Reading an .xlsx file, with no dependency at all.
   ------------------------------------------------------------
   An .xlsx is a ZIP of XML, and Node ships zlib, so the whole job is
   about 200 lines and nothing has to be downloaded. That matters here
   more than usual: the app must keep working on a laptop at the mandir
   with no connection, and the one library everyone reaches for
   (SheetJS) is published to npm only as a stale build. A parser we own
   also fails in ways we can explain to an operator, which a generic
   one does not.

   What it handles, because real sheets contain all of it:

     - shared strings, including rich text split across several runs
     - inline strings, and formula results (t="str", t="b")
     - DATES, which is the one that cannot be skipped. Excel stores a
       date as a number and puts the date-ness in the cell's STYLE, so
       "04/02/2027" is on disk as 46422 and a reader that ignores
       styles.xml hands the import layer a five-digit number. Both the
       built-in date formats and custom ones are resolved, and both the
       1900 and 1904 epochs.
     - MISSING CELLS. A row with a blank City simply has no <c> for it,
       so cells must be placed by their own r="C5" reference. Reading
       them in document order instead shifts every later column left,
       which silently files a mobile number under "City" — the kind of
       wrong that looks plausible all the way into the database.

   What it does not: formulas (the cached result is read, which is what
   the operator sees), charts, pivot tables, anything write-side.

   Everything comes back as a string, trimmed, with dates already
   normalised to YYYY-MM-DD. Deciding what a value MEANS is the import
   layer's job, not this one's.
*/
const zlib = require('zlib');

/* ------------------------------------------------------------------
   ZIP
   ------------------------------------------------------------------
   Read the central directory rather than walking local headers: when a
   writer streams its output it sets the "data descriptor" flag and
   leaves the sizes in the local header as zero, and only the central
   directory has the real ones.
*/
const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;

function findEOCD(buf) {
  /* The end-of-central-directory record is last, but a trailing
     comment can follow it, so scan back over the largest a comment can
     be (64KB) plus the record itself. */
  const min = Math.max(0, buf.length - 0xffff - 22);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) return i;
  }
  return -1;
}

function unzip(buf) {
  const eocd = findEOCD(buf);
  if (eocd < 0) {
    throw Object.assign(
      new Error('This file is not a readable .xlsx workbook. Save it from Excel as "Excel Workbook (.xlsx)" and try again.'),
      { status: 400 });
  }
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);

  /* 0xFFFFFFFF in either field means the real value lives in a ZIP64
     record. A spreadsheet of registrations never gets near 4GB or
     65535 entries, so rather than implement it, say so plainly. */
  if (at === 0xffffffff || count === 0xffff) {
    throw Object.assign(new Error('This workbook uses the ZIP64 format, which this importer cannot read. Re-save it from Excel and try again.'),
      { status: 400 });
  }

  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== SIG_CEN) break;
    const method = buf.readUInt16LE(at + 10);
    const compressed = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extraLen + commentLen;

    /* The local header repeats the name and extra fields, and its
       extra length often DIFFERS from the central one, so the data
       offset has to be computed from the local header itself. */
    if (localAt + 30 > buf.length) continue;
    const lNameLen = buf.readUInt16LE(localAt + 26);
    const lExtraLen = buf.readUInt16LE(localAt + 28);
    const start = localAt + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compressed);

    try {
      files.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));
    } catch (e) {
      /* One unreadable part need not sink the file — a workbook can
         carry printer settings and thumbnails we never look at. */
    }
  }
  return files;
}

/* ------------------------------------------------------------------
   XML, by scanning rather than parsing
   ------------------------------------------------------------------
   The XML inside an xlsx is machine-written and shallow, so a scan is
   enough and keeps the dependency count at zero. It is never used on
   anything but the file the operator just handed us.
*/
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const n = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[body] !== undefined ? ENTITIES[body] : whole;
  });
}

const attr = (tag, name) => {
  const m = new RegExp(name + '="([^"]*)"').exec(tag);
  return m ? decode(m[1]) : null;
};

/** Every <t> inside one chunk, joined. Rich text splits a single value
    across several runs, and "Rasik" + "bhai" is one name. */
function textOf(chunk) {
  let out = '';
  const re = /<t(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/t>)/g;
  let m;
  while ((m = re.exec(chunk))) out += m[1] === undefined ? '' : decode(m[1]);
  return out;
}

function sharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const re = /<si(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/si>)/g;
  let m;
  while ((m = re.exec(xml))) out.push(m[1] === undefined ? '' : textOf(m[1]));
  return out;
}

/* ------------------------------------------------------------------
   Dates
   ------------------------------------------------------------------ */
const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/** Does this format code draw a date? Quoted runs and the colour/
    condition parts in [brackets] are stripped first, or the "m" in a
    literal like "Month" would make every currency cell a date. */
function isDateFormat(code) {
  if (!code) return false;
  const bare = code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '').replace(/\\./g, '');
  return /[ymdhs]/i.test(bare) && !/^[^ymdhs]*$/i.test(bare);
}

/** styles.xml -> for each cell style index, is it a date? */
function dateStyles(xml) {
  const flags = [];
  if (!xml) return flags;

  const custom = new Map();
  const nf = /<numFmt\s[^>]*\/>/g;
  let m;
  while ((m = nf.exec(xml))) {
    const id = Number(attr(m[0], 'numFmtId'));
    if (Number.isFinite(id)) custom.set(id, attr(m[0], 'formatCode') || '');
  }

  /* Only the <cellXfs> block maps a cell's s="N" to a format; the
     <cellStyleXfs> block above it looks identical and is not it. */
  const block = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (!block) return flags;
  const xf = /<xf\s[^>]*?\/?>/g;
  while ((m = xf.exec(block[1]))) {
    const id = Number(attr(m[0], 'numFmtId'));
    flags.push(Number.isFinite(id) &&
      (BUILTIN_DATE_FMT.has(id) || (custom.has(id) && isDateFormat(custom.get(id)))));
  }
  return flags;
}

/** Excel's serial day -> YYYY-MM-DD.

    The 1900 system counts from 1899-12-31 as day 1 but also believes
    1900 was a leap year, so everything from 1900-03-01 is one day out;
    anchoring at 1899-12-30 absorbs both. Serials below 61 predate that
    fiction and are not dates anyone types into a seva sheet.

    Built with UTC on purpose: a local-time Date around a DST boundary
    lands on the previous evening and files the entry a day early —
    the same trap as toISOString(), from the other side. */
function serialToDate(n, epoch1904) {
  const base = Date.UTC(epoch1904 ? 1904 : 1899, epoch1904 ? 0 : 11, epoch1904 ? 1 : 30);
  const ms = base + Math.round(n * 86400000);
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return String(n);
  const p = (x) => String(x).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

/* ------------------------------------------------------------------
   Cells
   ------------------------------------------------------------------ */
/** "BC7" -> 54 (zero-based column). */
function colOf(ref) {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

function readSheet(xml, strings, dateFlags, epoch1904) {
  const rows = [];
  const rowRe = /<row(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const cells = [];
    if (rm[1]) {
      const cellRe = /<c(\s[^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cm;
      let auto = 0;
      while ((cm = cellRe.exec(rm[1]))) {
        const head = cm[1] || '';
        const body = cm[2] || '';
        const ref = attr(head, 'r');
        /* Place by reference, never by order — see the note at the
           top. Only a cell with no r at all falls back to position. */
        const at = ref ? colOf(ref) : auto;
        auto = at + 1;

        const type = attr(head, 't');
        let value = '';
        if (type === 'inlineStr') {
          value = textOf(body);
        } else {
          const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);
          const raw = v ? decode(v[1]) : '';
          if (type === 's') {
            const i = Number(raw);
            value = strings[i] === undefined ? '' : strings[i];
          } else if (type === 'b') {
            value = raw === '1' ? 'TRUE' : 'FALSE';
          } else if (type === 'e') {
            value = '';                       // #N/A and friends are not data
          } else if (raw !== '' && !Number.isNaN(Number(raw))) {
            const s = Number(attr(head, 's'));
            value = (Number.isFinite(s) && dateFlags[s] && Number(raw) >= 61)
              ? serialToDate(Number(raw), epoch1904) : raw;
          } else {
            value = raw;
          }
        }
        if (at >= 0) cells[at] = String(value).trim();
      }
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
    rows.push(cells);
  }
  return rows;
}

/* ------------------------------------------------------------------
   The entry point
   ------------------------------------------------------------------ */
/** Read the first worksheet of an .xlsx buffer as an array of rows of
    strings. The FIRST sheet is deliberate: the import template ships
    one sheet, and quietly reading a different one because it sorted
    first by filename is how an operator ends up importing last year's
    working notes. */
function readXlsx(buf) {
  const files = unzip(buf);
  const strings = sharedStrings(files.get('xl/sharedStrings.xml') &&
    files.get('xl/sharedStrings.xml').toString('utf8'));
  const styles = files.get('xl/styles.xml');
  const dateFlags = dateStyles(styles && styles.toString('utf8'));

  const wbBuf = files.get('xl/workbook.xml');
  const wb = wbBuf ? wbBuf.toString('utf8') : '';
  const epoch1904 = /date1904="(1|true)"/i.test(wb);

  /* Follow workbook.xml -> the first <sheet> -> its r:id -> the rels
     file -> the part name. Sheet order in the workbook is the order of
     the tabs; the file names inside xl/worksheets/ are not. */
  let part = null;
  const first = /<sheet\s[^>]*\/?>/.exec(wb);
  if (first) {
    const rid = attr(first[0], 'r:id') || attr(first[0], 'id');
    const relsBuf = files.get('xl/_rels/workbook.xml.rels');
    if (rid && relsBuf) {
      const rels = relsBuf.toString('utf8');
      const re = /<Relationship\s[^>]*\/?>/g;
      let m;
      while ((m = re.exec(rels))) {
        if (attr(m[0], 'Id') !== rid) continue;
        let target = attr(m[0], 'Target') || '';
        target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
        part = 'xl/' + target;
        break;
      }
    }
  }
  if (!part || !files.has(part)) {
    part = [...files.keys()].filter((k) => /^xl\/worksheets\/.*\.xml$/.test(k)).sort()[0];
  }
  if (!part) {
    throw Object.assign(new Error('This workbook has no worksheet in it.'), { status: 400 });
  }
  return readSheet(files.get(part).toString('utf8'), strings, dateFlags, epoch1904);
}

module.exports = { readXlsx, serialToDate, isDateFormat };
