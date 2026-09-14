/* NDA Detailing — hero scrub + reveals. Rules: no content visibility gated on
   JS without failsafe (#31); ?step=0..1 pins hero progress for QA (pane can't
   verify live scroll — standing studio finding). */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  /* failsafe: everything visible after 1.5s no matter what */
  setTimeout(function () { root.classList.add('revealed'); }, 1500);

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var pinned = params.has('step') ? Math.max(0, Math.min(1, parseFloat(params.get('step')) || 0)) : null;

  /* ---- THE GLIDE (2026-08-21, ported from ZEF, which took it from Fahad's
     live reference kodeimmersive.com). Lenis 1.3.26, vendored, same settings
     as the reference and as ZEF.

     SITE-WIDE ON PURPOSE, and that is the split ZEF settled on: the GLIDE is
     everywhere, the CURTAIN and its retire are the home page's alone. The
     scroll feel is a property of the site; the takeover is a property of the
     one page built as a journey. A visitor who glides down the home page and
     then hits a portfolio page that scrolls natively feels the site change
     under them.

     WHY THIS IS SAFE ON THE PAGE THAT BANNED EASING (the home hero film).
     home.js records three sessions lost to a desync bug and ends "the film
     can simply BE the scroll position". That ruling stands. What it forbids
     is easing the FILM'S PLAYHEAD while the curtain beats read raw scrollY —
     two clocks on one moment. Lenis adds no second clock: it eases the SCROLL
     POSITION ITSELF, the single value both the film and the sticky curtains
     already read, so they stay welded to each other and the whole page glides
     together. Ease the shared clock, never one hand on it.

     It drives the real window scroll, so scrollY and the scroll event are
     untouched and every existing reader (the film's setProgress, the retire
     dim, these reveals) keeps working. Never starts under reduced motion.
     Wheel and trackpad only — touch stays native, which is why phones are
     unaffected. Exposed on window.NDA so home.js's ?y= pin can ask it rather
     than fight it. ---- */
  window.NDA = window.NDA || {};

  /* ---- A SAME-PAGE ANCHOR ON THE FILM PAGE LANDS, IT DOES NOT TRAVEL
     (2026-09-12, Fahad: "there was a glitch, light flickering thing happening
     when I went to book a slot ... I didnt notice this on every page but I did
     on that one").

     MEASURED, NOT GUESSED, because two earlier scroll-feel diagnoses on this
     site were wrong from reasoning alone. Recording the home page frame by
     frame through a real CTA click, mean luma runs 38 -> 50 -> 73 -> 56 -> 33
     in five frames: a 23-point spike with a direction reversal, which is what
     "flickering" means in numbers. Bisected twice: hiding the hero film drops
     the peak from 72.5 to 38.4, and removing the TRAVEL drops it to 38 -> 20
     and then flat, no reversal at all.

     WHY ONLY THIS PAGE, WHICH IS THE HALF FAHAD ALREADY NOTICED. `#book` sits
     5,880px down and everything above it is the scroll-scrubbed RS7 film. With
     Lenis `anchors:true` the CTA SMOOTH-scrolls, so the film is seeked across
     its entire timeline in about a second — and its frames differ wildly in
     brightness, so the eye gets a strobe rather than a journey. Every other
     page reaches booking through `index.html#book`, a fresh load that lands on
     the anchor with no travel: measured dead flat at luma 20.4, nothing to fix.

     SO THE FIX IS SCOPED TO THE FILM, NOT TO ANCHORS IN GENERAL. Lenis keeps
     its smooth anchors on every page where a short scroll crosses nothing.
     `.scrub-wrap` exists on index.html alone, so this is self-scoping, and
     index.html has exactly ONE same-page anchor — the hero's "Book your detail".
     One interaction on the whole site changes.

     WHAT WAS NOT DONE, AND WHY. Slowing the scrub or holding the film during
     the scroll both mean touching the hero, which Fahad has ruled out twice,
     and neither would work: the four curtain beats still slam past underneath.
     Removing the travel removes the strobe at its source instead of masking it.

     IT MATCHES WHAT LENIS DID, MINUS THE TRAVEL. Lenis's own anchor handling
     sets `location.hash` and pushes a history entry (verified: hash "#book",
     history.length 3). Both are reproduced below, or this would quietly change
     what the URL says and what Back does while claiming to be a flicker fix. */
  var film = document.querySelector('.scrub-wrap');
  var lenis = null;
  if (!reduced && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: !film });
    window.NDA.lenis = lenis;
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  }
  /* Under reduced motion there is nothing to do: Lenis never starts and
     styles.css already sets `scroll-behavior:auto`, so the anchor is instant. */
  if (film && !reduced) {
    document.addEventListener('click', function (e) {
      /* Leave modified clicks to the browser (open in a new tab) and leave
         alone anything another handler has already claimed. */
      if (e.defaultPrevented || e.button !== 0 ||
          e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var hash = a.getAttribute('href');
      if (hash.length < 2) return;                 /* a bare "#" is not a target */
      var t = document.getElementById(hash.slice(1));
      if (!t) return;                              /* let a dead anchor behave as it would */
      e.preventDefault();
      var y = Math.round(t.getBoundingClientRect().top + window.scrollY);
      /* Lenis owns scroll when it is running, so ask IT — `window.scrollTo` is
         a documented no-op on this site. Without it, `instant` is required or
         the sheet's own `scroll-behavior:smooth` reinstates the travel. */
      if (lenis) lenis.scrollTo(y, { immediate: true });
      else window.scrollTo({ top: y, behavior: 'instant' });
      if (location.hash !== hash) history.pushState(null, '', hash);
    });
  }

  /* reveals */
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
  } else {
    root.classList.add('revealed');
  }

  /* ---- THE FULL-SCREEN MENU (2026-08-21, vanilla port of the React/GSAP
     "sterling gate kinetic navigation" reference Fahad supplied).

     The motion is entirely CSS (see the block in styles.css for why GSAP
     earns nothing here). This driver owns only what CSS cannot: the class
     toggle, the accessible name, the focus trap, and the scroll lock.

     `html.navlive` is added ONLY once the button and the menu are both
     found and wired, so the two presentations can never half-apply — no
     JS means no class, which means the ordinary centred bar and no button
     advertising an overlay that cannot open (production-rules #31). ---- */
  var navBtn = document.querySelector('.navbtn');
  var navMenu = document.getElementById('navlinks');
  if (navBtn && navMenu) {
    root.classList.add('navlive');
    /* THE MENU LEAVES THE NAV WHEN IT GOES LIVE, AND IT HAS TO.
       `.nav` carries `backdrop-filter`, and backdrop-filter (like filter and
       transform) makes an element the CONTAINING BLOCK for fixed-position
       descendants. Left inside the bar, the overlay's `position:fixed;
       inset:0` resolved against the 707x64 header instead of the viewport:
       a 63px-tall "full-screen" menu with no backdrop, painting over the
       page. Nothing errors, and a screenshot only shows the symptom -- the
       ancestor's computed style is the only place the cause is visible.

       Moving it is also exactly what the two presentations mean: inside the
       nav it is a bar item, at body level it is an overlay. Same nodes, so
       the links cannot drift, and `aria-controls="navlinks"` still resolves
       by id from wherever the element now lives.

       (Note for QA: home.js's `?ty=` hook transforms <body>, which would
       make BODY a containing block too and re-break a fixed overlay. That
       hook is for composing screenshots, not for testing the menu.) */
    document.body.appendChild(navMenu);
    var navLabel = navBtn.querySelector('.navbtn-label');
    var navScrim = navMenu.querySelector('.navmenu-scrim');
    var navOpen = false;

    var focusables = function () {
      return navMenu.querySelectorAll('a[href], button:not([disabled])');
    };

    /* `keepFocus` is set only when the menu closes because a link inside it
       was activated: the browser is already moving focus to the destination
       (or unloading the page), and pulling it back to the button would fight
       that. Every other close returns focus to the BUTTON rather than to
       whatever was focused when the menu opened. Capturing the previous
       element sounds more faithful but is wrong here — the button is not
       necessarily focused when the menu opens (a programmatic or touch
       activation leaves activeElement on <body>), and restoring <body>
       silently drops a keyboard user back at the top of the document. The
       trigger is always the right place to come back to. */
    var setMenu = function (open, keepFocus) {
      navOpen = open;
      navMenu.classList.toggle('is-open', open);
      navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      /* The visible text swaps in CSS; the accessible NAME has to swap too
         or a screen-reader user hears "Menu" on a button that now closes. */
      if (navLabel) navLabel.textContent = open ? 'Close menu' : 'Menu';
      /* Scroll lock. Lenis owns the wheel when it is running, so it is
         stopped rather than fought — overflow:hidden alone does not stop a
         smooth-scroll library that drives scroll programmatically. */
      if (window.NDA && window.NDA.lenis) {
        open ? window.NDA.lenis.stop() : window.NDA.lenis.start();
      }
      document.body.style.overflow = open ? 'hidden' : '';
      /* The rest of the page is hidden from assistive tech while the menu
         is up, but the NAV is not: the button and the booking chip stay
         reachable, and the menu lives inside the nav. */
      var main = document.querySelector('main');
      if (main) open ? main.setAttribute('aria-hidden', 'true')
                     : main.removeAttribute('aria-hidden');
      if (open) {
        /* The PANEL, not the first link. Focusing a link makes Chrome match
           :focus-visible on it even when the menu was opened by mouse, so the
           first item opened wearing the full wine hover bar and read as
           already selected. The panel carries tabindex="-1" for this. */
        var panel = navMenu.querySelector('.navmenu-panel');
        if (panel) panel.focus(); else { var f0 = focusables()[0]; if (f0) f0.focus(); }
      } else if (!keepFocus) {
        navBtn.focus();
      }
    };

    navBtn.addEventListener('click', function () { setMenu(!navOpen); });
    if (navScrim) navScrim.addEventListener('click', function () { setMenu(false); });
    /* A link inside the menu navigates; on same-page anchors the document
       does not unload, so the menu would still be sitting open on arrival. */
    navMenu.addEventListener('click', function (e) {
      if (e.target.closest('.navmenu-link')) setMenu(false, true);
    });

    document.addEventListener('keydown', function (e) {
      if (!navOpen) return;
      if (e.key === 'Escape') { setMenu(false); return; }
      if (e.key !== 'Tab') return;
      /* Focus trap. Without it Tab walks out of an open full-screen menu
         into the page behind it, which is invisible and unscrollable. */
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      /* Focus rests on the PANEL right after opening, which is inside the
         menu but not in this list. Tab from there would fall through to the
         browser's own default (the page behind), so the container case is
         handled explicitly rather than left to the two edge comparisons
         below, which can never match it. */
      if (Array.prototype.indexOf.call(f, document.activeElement) === -1) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* hero scrub */
  var wrap = document.querySelector('.hero-wrap');
  if (!wrap) return;
  var pieces = wrap.querySelectorAll('.pc');
  function apply(p) {
    /* pieces drift apart as p goes 0 -> 1 */
    pieces.forEach(function (el) {
      var dx = parseFloat(el.dataset.dx || 0) * p;
      var dy = parseFloat(el.dataset.dy || 0) * p;
      var dr = parseFloat(el.dataset.dr || 0) * p;
      el.setAttribute('transform', 'translate(' + dx + ' ' + dy + ') rotate(' + dr + ' ' + (el.dataset.cx || 0) + ' ' + (el.dataset.cy || 0) + ')');
    });
  }
  if (reduced || pinned !== null) {
    wrap.classList.add('static');
    apply(pinned !== null ? pinned : 0);
    return;
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var rect = wrap.getBoundingClientRect();
      var total = wrap.offsetHeight - window.innerHeight;
      var p = total > 0 ? Math.max(0, Math.min(1, -rect.top / total)) : 0;
      apply(p);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* Service tiles are stills as of 2026-08-07 (Fahad: no generated video).
   The hover push-in lives in home.css — no JS needed. */

/* Portfolio lightbox — self-arming: it attaches wherever .pcell thumbs exist,
   so no per-page flag can get injected in the wrong order. Its own IIFE
   because the hero block above returns early on pages with no hero.
   Rule #31: never gate content on JS. The thumbs ARE the gallery; this only
   adds a bigger look, so with JS off the portfolio still works fully. */
(function () {
  var cells = Array.prototype.slice.call(document.querySelectorAll('.pcell'));
  if (!cells.length) return;

  var box = document.createElement('div');
  box.className = 'lbx';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photo viewer');
  box.innerHTML =
    '<img alt="">' +
    '<p class="lbx-cap"></p>' +
    '<button class="lbx-close" type="button" aria-label="Close viewer">&#10005;</button>' +
    '<button class="lbx-prev" type="button" aria-label="Previous photo">&#8249;</button>' +
    '<button class="lbx-next" type="button" aria-label="Next photo">&#8250;</button>';
  document.body.appendChild(box);

  var img = box.querySelector('img');
  var cap = box.querySelector('.lbx-cap');
  var btnClose = box.querySelector('.lbx-close');
  var i = 0, opener = null;

  function show(n) {
    i = (n + cells.length) % cells.length;
    var c = cells[i];
    img.src = c.dataset.full;
    img.alt = c.querySelector('img') ? c.querySelector('img').alt : '';
    cap.textContent = c.dataset.cap + '  ·  ' + (i + 1) + ' / ' + cells.length;
  }
  function open(n) {
    opener = cells[n];
    show(n);
    box.classList.add('on');
    document.body.classList.add('lbx-open');
    btnClose.focus();
  }
  function close() {
    box.classList.remove('on');
    document.body.classList.remove('lbx-open');
    img.removeAttribute('src');
    if (opener) opener.focus();
  }

  cells.forEach(function (c, n) { c.addEventListener('click', function () { open(n); }); });
  btnClose.addEventListener('click', close);
  box.querySelector('.lbx-prev').addEventListener('click', function () { show(i - 1); });
  box.querySelector('.lbx-next').addEventListener('click', function () { show(i + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) close(); });
  document.addEventListener('keydown', function (e) {
    if (!box.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(i - 1);
    else if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === 'Tab') { e.preventDefault(); btnClose.focus(); }
  });
})();

/* ---- Interior rail playback ----------------------------------------------
   The markup carries NO autoplay attribute, so the poster is the rest state.
   Playback is gated on approach instead: two decoders running off-screen is a
   real cost on a phone. pause() and never load() -- pause preserves
   currentTime, so scrolling back up resumes mid-clip rather than snapping to
   frame zero. Own closure: the hero block above returns early on pages with
   no .hero-wrap, which would otherwise skip this. */
(function () {
  var vids = document.querySelectorAll('.svc-rail video');
  if (!vids.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var conn = navigator.connection;
  if (conn && conn.saveData) return;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var v = entry.target;
      if (entry.isIntersecting) {
        // play() rejects if the tab is backgrounded mid-call; that is not an error
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    });
  }, { rootMargin: '200px 0px' });

  Array.prototype.forEach.call(vids, function (v) { io.observe(v); });
})();

/* ---- The before/after slider (headlight rail, 2026-09-11) ----------------
   One value, `--cmp`, written from a real <input type=range> that covers the
   frame; styles.css does everything else off it. The input is the control for
   the same reason the phone deck is CSS: nothing here can be broken by a
   stalled rAF, and the keyboard comes free. `is-drag` only scales the knob.
   Own closure, same reason as the rail playback above. */
(function () {
  var cmps = document.querySelectorAll('.cmp[data-compare]');
  if (!cmps.length) return;
  Array.prototype.forEach.call(cmps, function (cmp) {
    var ctl = cmp.querySelector('.cmp-ctl');
    if (!ctl) return;
    var write = function () { cmp.style.setProperty('--cmp', ctl.value); };
    var up = function () { cmp.classList.remove('is-drag'); };
    ctl.addEventListener('input', write);
    ctl.addEventListener('pointerdown', function () { cmp.classList.add('is-drag'); });
    ctl.addEventListener('pointerup', up);
    ctl.addEventListener('pointercancel', up);
    ctl.addEventListener('blur', up);
    // a drag that ends off the frame still has to let go of the knob
    window.addEventListener('pointerup', up);
    write();
  });
})();

/* ---- THE TORCH (site-wide, 2026-08-21) -----------------------------------
   One listener for the whole site. It writes the pointer position to :root as
   `--gx`/`--gy`; every `.graf .lit` on the page reads that same pair for its
   radial mask. Per-element listeners (what the retired portfolio torch used)
   would mean one handler per beat all computing the same number off their own
   getBoundingClientRect — five reads a frame to answer a question the
   viewport already answers once.

   VIEWPORT COORDINATES, WRITTEN RAW. clientX/clientY are exactly what a mask
   on a viewport-sized layer wants, so there is no rect maths here at all and
   nothing to desync when the page scrolls under a still mouse.

   rAF-COALESCED. A trackpad delivers pointermove far faster than the compositor
   paints; writing a custom property per event restyles every masked layer for
   frames that are never shown. One write per frame, and the write is skipped
   entirely when the value has not moved.

   NOT GATED ON REDUCED MOTION. The torch does not travel or animate on its own
   — it is a highlight that tracks a pointer the user is already moving, which
   is the same class of feedback as :hover. Gating it would take the effect away
   from people who asked for less MOVEMENT, not less contrast. The `.base`
   ground is static either way. ---- */
(function () {
  if (!document.querySelector('.graf')) return;
  var root = document.documentElement;
  var x = -999, y = -999, queued = false, lastX = null, lastY = null;
  /* WRITTEN ON EACH WALL, NOT ON :root (2026-09-11, Fahad: "parts of the site
     feel very laggy"). A custom property is inherited, so a write on :root
     restyles EVERY element on the page -- measured in headless Chrome at
     120-220 full style recalcs and 310-450 ms of style work per 2 s of mouse
     movement, on every page, for a value only the `.graf .lit` masks read.
     Written to each `.graf` instead, the recalc stays inside the walls' own two
     layers. Every wall gets the SAME viewport coordinates, so this is not the
     "section-scoped pair" CLAUDE.md warns about -- that bug is two walls
     holding different values. */
  var walls = document.querySelectorAll('.graf');

  function write() {
    queued = false;
    if (x === lastX && y === lastY) return;
    lastX = x; lastY = y;
    for (var i = 0; i < walls.length; i++) {
      walls[i].style.setProperty('--gx', x + 'px');
      walls[i].style.setProperty('--gy', y + 'px');
    }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(write); } }

  /* pointermove, not mousemove: a pen or a hovering stylus should light the
     wall too. Touch contacts are ignored — the lit layer is already display:none
     on coarse pointers, and letting a tap park the beam would leave a bright
     circle sitting on the page after the finger lifts. */
  addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    x = e.clientX; y = e.clientY; queue();
  }, { passive: true });

  /* Leaving the document parks the beam off-screen rather than freezing it at
     the last edge position, where it would read as a permanent hot spot. */
  addEventListener('pointerout', function (e) {
    if (e.relatedTarget) return;      // still inside the page, just crossing elements
    x = -999; y = -999; queue();
  }, { passive: true });

  /* ---- THE WALL INSIDE AN OPAQUE SECTION -------------------------------
     Any `.graf-host` carries its own copy of the wall because its own ground is
     opaque (see the `.graf-host` block in styles.css). Four copies of one
     picture only read as ONE wall if they are all pinned to the same place, so
     each is re-registered to the viewport: `--graf-y` is the host's own top,
     negated. Identical reasoning to the home page's curtain beats.

     THERE ARE TWO REGISTRARS AND THAT IS DELIBERATE. home.js registers the
     curtain beats INSIDE the retire's existing per-frame measure pass, because
     that pass is already reading those exact rects — adding a second loop there
     would read them twice. Ordinary pages have no such loop to ride, so this is
     theirs. They never touch the same elements: `.curtain > .graf` there,
     `.graf-host > .graf` here.

     `--graf-vh` is written here for the whole site; home.js writes the same
     value for its own use, which is a duplicate write of an identical number
     rather than a disagreement. */
  var grafHosts = document.querySelectorAll('.graf-host');
  root.style.setProperty('--graf-vh', innerHeight + 'px');
  if (grafHosts.length) {
    var grafFrame = null;
    /* THE OFFSET GOES ON THE HOST'S OWN WALL, NOT ON THE HOST (2026-09-11). The
       host is a whole page section, and an inherited custom property written
       there restyled every element inside it on every scroll frame (Full
       Treatment: a full recalc per frame, 120 ms over a 5 s scroll).
       `--graf-y` is registered non-inherited in styles.css and only the wall
       reads it. READS FIRST, THEN WRITES, so no host's write forces a layout
       before the next host is measured. */
    var hostWalls = [], hostTops = [];
    for (var h = 0; h < grafHosts.length; h++) hostWalls[h] = grafHosts[h].querySelector(':scope > .graf');
    var placeWalls = function () {
      grafFrame = null;
      for (var i = 0; i < grafHosts.length; i++) hostTops[i] = grafHosts[i].getBoundingClientRect().top;
      for (var j = 0; j < grafHosts.length; j++) {
        if (hostWalls[j]) hostWalls[j].style.setProperty('--graf-y', (-hostTops[j]).toFixed(1) + 'px');
      }
    };
    var queueWalls = function () {
      if (!grafFrame) grafFrame = requestAnimationFrame(placeWalls);
    };
    placeWalls();
    addEventListener('scroll', queueWalls, { passive: true });
    addEventListener('resize', function () {
      root.style.setProperty('--graf-vh', innerHeight + 'px');
      placeWalls();
    });
  }

  /* QA HOOK, and on this project it is not optional. THE CLAUDE PANE FREEZES rAF,
     so the coalesced write above NEVER LANDS there: a pointermove is dispatched,
     nothing changes, and a torch that works in every real browser reads as dead —
     the same failure mode CLAUDE.md records for the retire. `NDA.torch(x, y)`
     skips the coalescing and writes the position immediately. `?torch=x,y` does
     it from the URL, for a screenshot with the beam parked somewhere specific.

     It writes through the same `write()` the driver uses, so the hook can never
     drift from the real path. */
  window.NDA = window.NDA || {};
  window.NDA.torch = function (nx, ny) { x = nx; y = ny; write(); };

  var t = new URLSearchParams(location.search).get('torch');
  if (t && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(t)) {
    var xy = t.split(',');
    window.NDA.torch(parseFloat(xy[0]), parseFloat(xy[1]));
  }
})();
