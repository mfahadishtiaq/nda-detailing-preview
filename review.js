/* =====================================================================
   THE REVIEW OVERLAY — PREVIEW ONLY (2026-09-14). Shah's review round.

   Fahad: "add the review section like we did before, for other sites where
   client can click into certain sections and provide feedback ... Once shah
   provides feedback, we'll push his new edited site on."

   THIS IS ZEF'S BUILD 18 OVERLAY, PORTED, NOT REDESIGNED (ZEF: js/main.js
   "THE REVIEW OVERLAY", generate.py review_overlay(), build-log Build 18).
   A Review tab on every page; on, tapping anything pins a note to that
   element and opens a sheet; General notes takes long-form text with no pin.
   Every note posts to Fahad through the same FormSubmit AJAX shape as the
   client forms, with the page, its address, and a human-readable "Pinned to".

   IT CANNOT REACH nodustallowed.ca, BY CONSTRUCTION. This file and
   review.css are NOT referenced by any page generate.py writes, so the
   committed HTML — which is exactly what production stages — never names
   them. deploy-preview.sh attaches the two tags to the staged pages only
   AFTER its DRY_RUN exit, and deploy-production.sh builds its stage by
   calling deploy-preview.sh WITH DRY_RUN=1, so it exits before the overlay
   is ever attached. Nothing has to be remembered or removed at launch.
   ZEF had to guard this with a verify() rule because its overlay lived in
   the generator; here there is nothing in the generator to forget.

   WHY THE DOM IS BUILT HERE rather than in generate.py (ZEF's shape): the
   markup has to be as absent from production as the script, and the only
   way to guarantee that is for the pages to carry none of it. No JS, no
   overlay, page untouched — same outcome ZEF got from `hidden`.

   PINS ARE NEVER INJECTED INTO CONTENT. Extra children would shift
   :nth-child / :nth-of-type chains, and on this site `home.js` and the
   curtain chain read beat children directly. Every pin lives on the fixed
   .rvlayer and chases its target's getBoundingClientRect on scroll and
   resize, which also keeps pins honest through the home page's sticky
   curtain phases. Lenis drives the real window scroll, so `scroll` fires.

   CLICKS ARE TAKEN IN THE CAPTURE PHASE so review mode wins over every link
   and control — a tap on CALL in the dock pins a note instead of dialling,
   and the film page's anchor handler in main.js never sees the click. The
   overlay's own chrome is exempt.

   THE TAB DOES NOT MOVE ON HOVER. A hover style that moves its own element
   strobes under a resting cursor (the booking-button bug, 2026-09-12).
   ===================================================================== */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('js')) return;
  /* THE ROOT IS `.rvroot`, NOT ZEF'S `.rv`, AND THAT RENAME IS A BUG FIX.
     On this site `.rv` is the SCROLL-REVEAL class (main.js observes every
     `.rv`; 96 elements carry it). Ported verbatim, this guard found a reveal
     element, concluded the overlay already existed, and silently never built
     it — and the capture handler's `closest('.rv')` exemption would have
     refused a pin on every revealed section of every page. Caught by the
     first end-to-end run, not by reading. Do not rename it back. */
  if (document.querySelector('.rvroot')) return;

  /* Split and joined at runtime, the same as the client forms. */
  var ENDPOINT = 'https://formsubmit.co/ajax/';
  var TO_USER = 'm.fahad.ishtiaq', TO_DOMAIN = 'gmail.com';
  var SUBJECT = 'NDA preview: note from the site review';
  var KEY = 'nda-review-pins';

  var root = document.createElement('div');
  root.className = 'rvroot';
  root.innerHTML =
    '<button class="rvtab" type="button" aria-pressed="false">Review</button>' +
    '<button class="rvgeneral" type="button" hidden>General notes</button>' +
    '<p class="rvhint" role="status" hidden>Tap anything on the page to pin a note for Fahad. Tap Review again to go back to browsing.</p>' +
    '<div class="rvlayer" aria-hidden="true"></div>' +
    '<div class="rvsheet" role="dialog" aria-modal="true" aria-label="Send a note to Fahad" hidden>' +
      '<p class="rvwhere"></p>' +
      '<label class="rvlabel" for="rv-note">Your note</label>' +
      '<textarea id="rv-note" rows="5"></textarea>' +
      '<div class="rvrow">' +
        '<button class="rvsend" type="button">Send to Fahad</button>' +
        '<button class="rvcancel" type="button">Cancel</button>' +
        '<button class="rvremove" type="button" hidden>Remove this pin</button>' +
      '</div>' +
      '<p class="rvstatus" role="alert"></p>' +
    '</div>';
  document.body.appendChild(root);

  var tab = root.querySelector('.rvtab');
  var general = root.querySelector('.rvgeneral');
  var hint = root.querySelector('.rvhint');
  var layer = root.querySelector('.rvlayer');
  var sheet = root.querySelector('.rvsheet');
  var where = sheet.querySelector('.rvwhere');
  var note = sheet.querySelector('textarea');
  var send = sheet.querySelector('.rvsend');
  var cancel = sheet.querySelector('.rvcancel');
  var remove = sheet.querySelector('.rvremove');
  var status = sheet.querySelector('.rvstatus');
  var pagePath = location.pathname.split('/').pop() || 'index.html';
  var on = false, ctx = null, busy = false, marks = [];

  function stored() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function persist(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function cssPath(el) {
    var path = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      var seg = el.tagName.toLowerCase(), sib = el, n = 1;
      while ((sib = sib.previousElementSibling)) n += 1;
      path.unshift(seg + ':nth-child(' + n + ')');
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  /* WHICH HEADING NAMES THE SPOT. ZEF read only the enclosing <section>'s
     heading, which is right for ZEF's markup and silently empty on half of
     NDA's: every service page's <h1> lives in `div.page-head`, not a section,
     and so does body prose in places. The first run pinned the Ceramic Coating
     headline and the email said only `"Ceramic Coating" / 88% across` -- no
     section to find it by. So: the heading the tap is inside, then the
     section's own heading, then (INSIDE <main> ONLY) the nearest heading above
     the spot in reading order. Outside <main> there is no fallback on purpose:
     a tap on the contact dock or the footer would otherwise borrow whatever
     heading happens to be last on the page and send Fahad to the wrong place. */
  function headingFor(el) {
    var own = el.closest('h1, h2');
    if (own) return own;
    var section = el.closest('section, footer, header, nav');
    var inside = section && section.querySelector('h1, h2');
    if (inside) return inside;
    if (!el.closest('main')) return null;
    var hs = document.querySelectorAll('main h1, main h2'), best = null;
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = hs[i];
      else break;
    }
    return best;
  }

  function describe(el, xr, yr) {
    var head = headingFor(el);
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text && el.getAttribute) text = el.getAttribute('alt') || el.getAttribute('aria-label') || el.tagName.toLowerCase();
    if (text.length > 70) text = text.slice(0, 67) + '...';
    var parts = [];
    if (head) parts.push((head.textContent || '').replace(/\s+/g, ' ').trim());
    if (text) parts.push('"' + text + '"');
    parts.push(Math.round(xr * 100) + '% across, ' + Math.round(yr * 100) + '% down that element');
    return parts.join(' / ');
  }

  function placeMark(mark) {
    var el = null;
    try { el = document.querySelector(mark.path); } catch (e) {}
    if (!el) { if (mark.dot) mark.dot.hidden = true; return; }
    if (!mark.dot) {
      mark.dot = document.createElement('button');
      mark.dot.type = 'button';
      mark.dot.className = 'rvpin rvpin-mine';
      mark.dot.setAttribute('aria-label', 'Your note here');
      mark.dot.addEventListener('click', function () { openSheet('view', mark); });
      layer.appendChild(mark.dot);
    }
    var r = el.getBoundingClientRect();
    mark.dot.hidden = r.width === 0 && r.height === 0;
    mark.dot.style.left = (r.left + mark.xr * r.width) + 'px';
    mark.dot.style.top = (r.top + mark.yr * r.height) + 'px';
  }
  function placeAll() { marks.forEach(placeMark); }
  window.addEventListener('scroll', placeAll, { passive: true });
  window.addEventListener('resize', placeAll);

  marks = stored().filter(function (m) { return m.page === pagePath; });
  marks.forEach(placeMark);

  function openSheet(mode, data) {
    sheet.hidden = false;
    status.textContent = ''; status.className = 'rvstatus';
    send.hidden = cancel.hidden = remove.hidden = true;
    note.readOnly = false;
    if (mode === 'pin') {
      ctx = data;
      where.textContent = 'Pinned to: ' + data.place;
      note.value = ''; send.hidden = cancel.hidden = false;
      note.focus();
    } else if (mode === 'general') {
      ctx = null;
      where.textContent = 'General notes about this page. Write as much as you like.';
      note.value = ''; send.hidden = cancel.hidden = false;
      note.focus();
    } else {
      ctx = data;
      where.textContent = 'Already sent to Fahad. Pinned to: ' + data.place;
      note.value = data.note; note.readOnly = true;
      cancel.hidden = remove.hidden = false;
    }
  }
  function closeSheet() {
    sheet.hidden = true;
    if (ctx && ctx.temp && ctx.temp.parentNode) { layer.removeChild(ctx.temp); }
    ctx = null;
  }

  function setMode(next) {
    on = next;
    tab.setAttribute('aria-pressed', on ? 'true' : 'false');
    hint.hidden = general.hidden = !on;
    document.body.classList.toggle('rv-on', on);
    if (!on) closeSheet();
  }
  tab.addEventListener('click', function () { setMode(!on); });
  general.addEventListener('click', function () { openSheet('general'); });
  cancel.addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !sheet.hidden) closeSheet();
  });

  remove.addEventListener('click', function () {
    if (!ctx || !ctx.ts) return;
    var keep = stored().filter(function (m) { return m.ts !== ctx.ts; });
    persist(keep);
    marks = marks.filter(function (m) {
      if (m.ts !== ctx.ts) return true;
      if (m.dot && m.dot.parentNode) layer.removeChild(m.dot);
      return false;
    });
    closeSheet();
  });

  // Capture-phase so review mode wins over every link and control on the
  // page; the overlay's own chrome is exempt.
  document.addEventListener('click', function (e) {
    if (!on || !sheet.hidden) return;
    if (e.target.closest('.rvroot')) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target.closest('*');
    if (!el) return;
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    var xr = (e.clientX - r.left) / (r.width || 1);
    var yr = (e.clientY - r.top) / (r.height || 1);
    var temp = document.createElement('span');
    temp.className = 'rvpin';
    temp.style.left = e.clientX + 'px';
    temp.style.top = e.clientY + 'px';
    layer.appendChild(temp);
    openSheet('pin', {
      path: cssPath(el), xr: xr, yr: yr,
      place: describe(el, xr, yr), temp: temp
    });
  }, true);

  send.addEventListener('click', function () {
    if (busy) return;
    var text = (note.value || '').trim();
    if (!text) { note.focus(); return; }
    busy = true;
    send.disabled = true; send.textContent = 'Sending';
    status.textContent = ''; status.className = 'rvstatus';
    var payload = {
      'Page': document.title,
      'Page address': location.href.split('#')[0],
      'Note': text,
      '_subject': SUBJECT,
      '_template': 'box',
      '_captcha': 'false'
    };
    if (ctx) payload['Pinned to'] = ctx.place;
    fetch(ENDPOINT + TO_USER + '@' + TO_DOMAIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function () {
        status.textContent = 'Sent. Fahad has it.';
        status.className = 'rvstatus ok';
        if (ctx) {
          var mark = { page: pagePath, path: ctx.path, xr: ctx.xr, yr: ctx.yr,
                       note: text, place: ctx.place, ts: Date.now() };
          var all = stored(); all.push(mark); persist(all);
          if (ctx.temp && ctx.temp.parentNode) { layer.removeChild(ctx.temp); }
          ctx.temp = null;
          marks.push(mark); placeMark(mark);
        }
        setTimeout(function () { closeSheet(); }, 900);
      })
      .catch(function () {
        status.textContent = 'The send did not go through. Your note is still here. Please try once more.';
        status.className = 'rvstatus bad';
      })
      .then(function () {
        busy = false; send.disabled = false; send.textContent = 'Send to Fahad';
      });
  });
})();
