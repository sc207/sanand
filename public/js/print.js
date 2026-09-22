/* Print / save-as-PDF window that carries the real styles.css so printed
   output matches the on-screen design exactly (a linked stylesheet always
   applies, even offline — unlike serialising CSS rules with JS). */
(function (global) {
  'use strict';

  function xesc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  global.openPrintDoc = function (opt) {
    opt = opt || {};
    const w = window.open('', '_blank');
    if (!w) { UI.toast('Please allow pop-ups to print / save as PDF.', 'err'); return null; }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${xesc(opt.title || 'Temple Document')}</title>
<link rel="stylesheet" href="/css/styles.css">
<link rel="stylesheet" href="/css/app-extras.css">
<style>
/* styles.css opens with html, body { height: 100%; max-width: 100vw;
   overflow-x: hidden } — correct for an app shell, ruinous for print:
   height:100% is exactly one page box, so a long table was clipped at
   the first page and Chrome reported "Total: 1 page" however many rows
   it had. Undo the shell geometry here, before anything else, or the
   printed copy silently loses records.
   The viewport units go too: a print window opened from a phone would
   otherwise size itself from that phone's screen, and the same report
   would come out differently on different devices. */
html,body{
  background:#fff;margin:0;padding:0;
  height:auto;min-height:0;max-height:none;
  width:auto;max-width:none;overflow:visible;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;
}
body{font-family:Inter,system-ui,sans-serif}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{
  html,body{background:#fff;height:auto;min-height:0;max-width:none;overflow:visible}
}
${opt.css || ''}
</style></head><body>
<div class="${opt.wrapClass || 'print-wrap'}">${opt.inner || ''}</div>
<script>(function(){
  var d=false;
  function go(){ if(d) return; d=true; try{window.focus()}catch(e){} try{window.print()}catch(e){} }
  function cssReady(){
    var ls=document.querySelectorAll('link[rel="stylesheet"]');
    for (var i=0;i<ls.length;i++){ var s; try{s=ls[i].sheet}catch(e){return false} if(!s) return false; try{ if(!s.cssRules||!s.cssRules.length) return false }catch(e){} }
    return true;
  }
  function imgReady(){ var im=document.images; for(var i=0;i<im.length;i++){ if(!im[i].complete) return false } return true; }
  function whenReady(){ var n=0; (function poll(){ n++;
    var fontsOk = (!document.fonts) || document.fonts.status === 'loaded' || n > 40;
    if ((cssReady() && imgReady() && fontsOk) || n > 60) setTimeout(go, 250); else setTimeout(poll, 100);
  })(); }
  if (document.readyState === 'complete') whenReady(); else window.addEventListener('load', whenReady);
  setTimeout(go, 9000);
})();<\/script></body></html>`;

    w.document.open(); w.document.write(html); w.document.close();
    return w;
  };
})(window);
