/* NDA Detailing — HOME journey driver (index.html only, ES module).
   REBUILT 2026-08-08 for the RS7 break-apart film (Fahad's plate → Nolan
   stage frames → Seedance 4K). The old hero's code break-apart, wall-logo,
   service labels, atmospherics and motes were all positioned against the
   RETIRED garage-world footage — they are gone, not ported. The film is now
   the whole hero; the poster still is the fallback.

   The scrub stack per design-direction.md "Hub-era rulings": blob-loaded
   (naive static hosts without Range support leave a streamed mp4 unseekable),
   all-intra so a seek costs one frame decode, and SPEED-RAMPED (see below).
   The film is solid from the first pixel — there is no still-to-film swap.

   QA hooks — the pane cannot scroll after load (standing studio finding):
     ?step=0..8   pins journey progress (0 = intact car, 8 = bare shell)
     ?view=<id>   composes a beat at top pre-paint (services|portfolio|about|book)
     ?y=<px>      real scroll jump (normal browsers)
     ?ty=<px>     transform-compose: shifts the document without scrolling,
                  so the pane can screenshot any offset
     ?mode=code   forces the no-film fallback (poster still) */

const clamp01 = t => Math.min(1, Math.max(0, t));
const q = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- stage scaling ---- */
const stage = document.getElementById('stage');
function fit(){
  stage.style.setProperty('--s', Math.max(innerWidth / 1376, innerHeight / 768));
}
addEventListener('resize', fit); fit();

/* ---- curtain chain: pin each beat's BOTTOM once fully read, next beat
   rises over it. The 2026-08-07 void bug was a ONE-SHOT measurement going
   stale (font swap / re-flow / zoom shifted layout after init and a beat
   pinned against its old height, freezing its empty bottom on screen).
   Hardened: a ResizeObserver re-computes every beat's pin the moment its
   box changes, plus viewport resize handling. ---- */
const curtains = Array.from(document.querySelectorAll('.curtain'));
const setCurtainTop = el => {
  el.style.top = Math.min(0, innerHeight - el.offsetHeight) + 'px';
};
const curtainRO = new ResizeObserver(entries =>
  entries.forEach(e => setCurtainTop(e.target)));
curtains.forEach(el => { setCurtainTop(el); curtainRO.observe(el); });
addEventListener('resize', () => curtains.forEach(setCurtainTop));

/* ---- THE GLIDE lives in main.js and is SITE-WIDE (2026-08-21, ported from
   ZEF). It is not started here: main.js runs on every page and owns the one
   Lenis instance, which it publishes on window.NDA.lenis. Two instances would
   both drive window scroll and fight each other every frame.

   The reasoning for why smoothing is safe on this page — the page whose own
   comments ban easing — is recorded at the init site in main.js. Short
   version: Lenis eases the shared scroll POSITION, not the film's playhead,
   so the film and the curtains stay welded to each other. ---- */
const lenis = (window.NDA && window.NDA.lenis) || null;

/* ---- THE WALL'S REGISTRATION (2026-08-21) --------------------------------
   Every beat carries its own copy of the graffiti wall, because the beats are
   opaque black by curtain law and a single body-level layer would be buried the
   moment Services rises. Four copies of one picture only READ as one wall if
   they are all pinned to the same place, so each beat's layer is re-registered
   to the VIEWPORT every frame: `--graf-y` is the beat's own top, negated.

   WHY NOT `position:fixed` INSIDE THE BEAT. It would register for free, and it
   is wrong: a fixed layer is not clipped by its ancestor's overflow, so while
   Services is still rising its wall would fill the WHOLE viewport and paint
   graffiti straight over the hero film above it. Absolute + a negated top is
   clipped by the beat, which is the behaviour the curtain chain needs.

   WHY NOT `background-attachment:fixed`. That registers the picture AND clips
   it in one declaration — but the torch is a MASK, and a mask has no fixed
   attachment. It always resolves against its element's box, so the layer has to
   be viewport-aligned regardless. Once it is, plain `cover` is already correct
   and the fixed attachment buys nothing but a full-layer repaint per scroll
   frame on a page that is already scrubbing a video.

   The write rides the dim's existing rAF loop rather than adding a listener:
   these are the same rects, read once. Beats that never move still get written
   once at seed, so a page that never scrolls is registered too. ---- */
/* 2026-09-11 (Fahad: "parts of the site feel very laggy"): THE OFFSET IS
   WRITTEN ON EACH BEAT'S WALL, NOT ON THE BEAT, AND ALL TOPS ARE READ BEFORE
   ANYTHING IS WRITTEN. On the beat, the inherited custom property restyled that
   beat's entire subtree -- showcase ring, tiles, accordion -- every scroll
   frame, and the read/write/read interleave forced a fresh recalc per beat:
   measured at ~3.6 full style recalcs a frame and 870 ms of style work over an
   11 s scroll of this page. `--graf-y` is registered non-inherited in
   styles.css and only `.curtain > .graf` reads it. The tops are shared with the
   retire below, which needs exactly the same numbers. */
const curtainWalls = curtains.map(c => c.querySelector(':scope > .graf'));
const curtainTops = curtains.map(() => 0);
const readTops = () => {
  for (let i = 0; i < curtains.length; i++) curtainTops[i] = curtains[i].getBoundingClientRect().top;
};
const grafY = () => {
  for (let i = 0; i < curtains.length; i++) {
    if (curtainWalls[i]) curtainWalls[i].style.setProperty('--graf-y', (-curtainTops[i]).toFixed(1) + 'px');
  }
};
/* Exact viewport height, not 100vh: on mobile 100vh is the LARGE viewport, so a
   beat's wall would be taller than the one main.js's fixed layer paints and the
   two would disagree by the browser chrome's height. */
const grafVH = () => document.documentElement.style
  .setProperty('--graf-vh', innerHeight + 'px');
grafVH(); readTops(); grafY();
addEventListener('resize', grafVH);

/* ---- THE RETIRE DIM (2026-08-21, ported from ZEF). Each beat gets a shadow
   layer and a content fade, both driven from how far the NEXT beat has risen
   over it. Geometry from getBoundingClientRect, per frame.

   THE HERO IS NOT IN THIS LIST and must not be. It already retires — the
   `dimmer` in setProgress() darkens the film toward the end of the tear so
   Services rises out of black rather than off a bright frame. That is the
   same effect, driven from film progress instead of coverage, and giving the
   hero a second one would double-darken it.

   THE BOOK BEAT NEVER RETIRES, AND THAT IS DELIBERATE. It is the last beat
   (book_band=False on home — the journey ends at its own Book beat) and the
   only thing after it is the 67px legal footer. Nothing rises over a call to
   action: the last thing a visitor sees should be the booking CTA at full
   strength, not dimmed by a strip of copyright text.

   This is enforced by giving it no `next` rather than left to chance. With
   the footer in the list the arithmetic happens to return 0 today ONLY
   because the footer is short — grow it past ~180px and the booking CTA
   would silently start fading, which is a bug nobody would think to look
   for. Right by intent, not by the footer's current height. ---- */
const dimBeats = curtains;
if (dimBeats.length) {
  /* A dim per beat that HAS a riser, so the last beat gets no layer at all
     rather than an inert one. `nexts[i]` is what rises over `dimBeats[i]`. */
  const nexts = dimBeats.slice(1);
  /* Set alongside seeding the layers, not before: the class IS the statement
     that the dims exist, and home.css hangs both halves of the effect on it. */
  document.documentElement.classList.add('retire');
  const dims = nexts.map((_, i) => {
    const d = document.createElement('div');
    d.className = 'beat-dim';
    d.setAttribute('aria-hidden', 'true');
    /* Every beat already establishes a containing block (they are sticky), so
       inset:0 resolves against the beat itself. */
    dimBeats[i].appendChild(d);
    return d;
  });

  /* THE SCRUB. Targets are written from geometry; the rendered values ease
     toward them with a TIME-BASED lerp, so the feel is identical at 60Hz and
     120Hz. This is the softness in ZEF's reference (GSAP `scrub: 1`) — it
     eases what the STYLES do with the scroll position.

     THIS IS NOT THE EASING THIS PAGE BANNED. The forbidden thing is easing
     the film's playhead while the curtains read raw scroll — two clocks on
     one moment. The dim is not the film and nothing is synchronised to it,
     so easing it desynchronises nothing. The film below still seeks raw.

     Under reduced motion k = 1 writes straight through: the dim survives
     (depth, not travel) but the easing does not. */
  const SCRUB_TAU = 0.28;
  const dimT = [], dimV = [], fadeT = [], fadeV = [];
  for (let i = 0; i < nexts.length; i++) { dimT[i] = 0; dimV[i] = 0; fadeT[i] = 1; fadeV[i] = 1; }

  const measureDim = () => {
    /* The wall re-registers here, off the same pass that measures the dim: one
       set of rect reads answers both questions. kickDim runs on every scroll
       event and Lenis drives the real window scroll, so this is per frame while
       the page is moving and silent when it is not.
       ONE READ PASS, then the wall writes after the loop: `nexts[i]` IS
       `curtains[i + 1]`, so every rect this needs is already in curtainTops. */
    readTops();
    const vh = innerHeight;
    for (let i = 0; i < nexts.length; i++) {
      const selfTop = curtainTops[i];
      const nextTop = curtainTops[i + 1];
      const pinTop = Math.max(selfTop, 0);
      const span = vh - pinTop;
      const raw = span > 0 ? (vh - nextTop) / span : 0;
      /* Dead zone, then ramp — the dead zone is why a beat peeking above the
         fold at REST casts no shadow. The slope is ZEF's corrected one
         (topping out at raw 0.626, not 0.765): a back-loaded ramp only
         reaches full strength once the next page covers three quarters of the
         screen, by which point there is nothing left to watch retire. */
      const p = clamp01((raw - 0.10) * 1.90);
      dimT[i] = 0.55 * p;
      /* The content fade is the half that carries this on a black site. */
      fadeT[i] = 1 - 0.88 * p;
    }
    grafY();
  };
  const writeDim = i => { dims[i].style.opacity = dimV[i].toFixed(3); };
  /* `--retire` GOES ON THE BEAT'S DIRECT CHILDREN -- the elements whose opacity
     reads it -- NOT ON THE BEAT (2026-09-11). On the beat, the inherited
     property restyled the whole subtree on every easing frame. Registered
     non-inherited in home.css, so a child's own descendants are not restyled
     either. The home.css rule is untouched: it still reads var(--retire) on
     `.curtain > *`, and now finds the value on that element. Collected after
     the dims are appended, and the dim and the wall are excluded exactly as
     that selector excludes them. */
  const fadeKids = dimBeats.map(b => Array.from(b.children)
    .filter(el => !el.classList.contains('beat-dim') && !el.classList.contains('graf')));
  const writeFade = i => {
    const v = fadeV[i].toFixed(3);
    for (const el of fadeKids[i]) el.style.setProperty('--retire', v);
  };

  let lastT = 0, running = false;
  const dimFrame = now => {
    /* Clamped so a backgrounded tab returning does not jump the whole elapsed
       time into one frame. */
    const dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 1 / 60;
    lastT = now;
    const k = reduced ? 1 : 1 - Math.exp(-dt / SCRUB_TAU);
    /* Write only what actually moved — restyling every beat every frame
       because ONE is easing is wasted style invalidation. */
    let moving = false, d;
    for (let i = 0; i < dimT.length; i++) {
      d = dimT[i] - dimV[i];
      if (Math.abs(d) < 0.0015) { if (dimV[i] !== dimT[i]) { dimV[i] = dimT[i]; writeDim(i); } }
      else { dimV[i] += d * k; moving = true; writeDim(i); }
      d = fadeT[i] - fadeV[i];
      if (Math.abs(d) < 0.0015) { if (fadeV[i] !== fadeT[i]) { fadeV[i] = fadeT[i]; writeFade(i); } }
      else { fadeV[i] += d * k; moving = true; writeFade(i); }
    }
    if (moving) requestAnimationFrame(dimFrame);
    else { running = false; lastT = 0; }
  };
  const kickDim = () => {
    measureDim();
    if (!running) { running = true; lastT = 0; requestAnimationFrame(dimFrame); }
  };
  addEventListener('scroll', kickDim, { passive: true });
  addEventListener('resize', kickDim);

  /* First paint lands ON the resting state rather than easing into it from
     zero: nothing at rest should animate on load. */
  const settleDim = () => {
    measureDim();
    for (let i = 0; i < dimT.length; i++) {
      dimV[i] = dimT[i]; writeDim(i);
      fadeV[i] = fadeT[i]; writeFade(i);
    }
  };
  settleDim();
  /* QA HOOK, and it is load-bearing on this project. The Claude pane freezes
     rAF, so the eased values never arrive there and every scrolled state
     reads as "resting" — an effect that is working looks identical to one
     that is broken. `NDA.settleDim()` skips the easing and writes the values
     the current geometry implies, which is what makes the retire checkable
     without a real browser. ?y= calls it below after it jumps. */
  window.NDA = Object.assign(window.NDA || {}, { settleDim });
  /* QA: ?nodim strips the effect so a beat can be photographed unwashed.
     Isolating a beat collapses the next one's rect to top:0, which reads as
     "fully covered" and comes back 55% black — that is the harness, never the
     design. ?view= composes beats the same way, so it clears it too. */
  if (q.get('nodim') !== null || q.get('view') !== null) {
    document.documentElement.classList.remove('retire');
    dims.forEach(d => { d.style.display = 'none'; });
  }
}

/* ---- THE SERVICE TILES ARRIVE ONE BY ONE, ROW BY ROW (Fahad, 2026-08-21:
   "Tile should appear one by one. Second row of tiles should appear once you
   scroll down and they actually start to become visible").

   THE STAGGER IS PER ARRIVING BATCH, NOT PER DOM INDEX, and that is the
   whole of the second sentence. Delaying each tile by its position in the
   grid would give the second row 3x, 4x and 5x the step — so a row reached a
   minute later would still be serving a delay earned by the row above it,
   and would trickle in against the scroll instead of landing with it. An
   IntersectionObserver callback hands over everything that crossed in the
   same frame, so each row is staggered from ZERO on its own arrival.

   Sorted into DOM order before staggering: the callback's entry order is not
   specified, so without it a row can arrive right-to-left or out of sequence.

   `html.tilereveal` is added only here, and only when there is an observer
   to drive it, so the hidden state in home.css cannot exist without the
   thing that undoes it (production-rules #31). Under reduced motion the
   tiles are never hidden in the first place — this is travel, not depth, so
   unlike the retire dim it does not survive.

   Unobserved on arrival: these reveal once. ---- */
const tiles = Array.from(document.querySelectorAll('.beat-services .gtile'));
if (tiles.length && 'IntersectionObserver' in window && !reduced) {
  document.documentElement.classList.add('tilereveal');
  /* 230ms between tiles, up from 110 (Fahad, 2026-08-22: "Slow it down").
     The STEP is what makes the arrival read as one-by-one rather than as a
     group: with a 1.15s travel, a short step overlaps the three so heavily
     that they land almost together. Slowing the transition alone would have
     made the row slower AND less separated, which is the opposite of the
     original ruling — so the gap grew with it. A row now takes about 1.6s
     end to end (2 x 230 + 1150). */
  /* 620ms between tiles, up from 230 and originally 110 (Fahad, 2026-08-22:
     "even slower so its like page 1.. page 2.. page 3 > scroll > page 4..
     page 5.. page 6").

     THE GAP IS THE RHYTHM, NOT THE DURATION. At 230ms against a 1.15s travel
     each tile began when the one before it was a fifth of the way in, so all
     three were in flight at once and the row read as one movement however
     long you made it. At 620ms — with an ease that now settles early — a
     tile has visibly landed before the next starts, which is the "one.. two..
     three" being asked for. A row takes ~2.7s (2 x 700 + 1250).

     700, NOT THE 620 THIS WAS FIRST SET TO, AND THE DIFFERENCE WAS MEASURED
     RATHER THAN GUESSED. What matters is not the transition's nominal
     duration but when a tile READS as landed — within ~2px of home and
     essentially opaque — which on this ease is ~700ms, well before the
     1250ms the transition formally runs for. At 620 the second tile began
     84ms BEFORE the first had visually settled and the beat was still
     smeared; at 700 every tile clears the one before it.

     The second row still counts from ZERO on its own arrival, so the beat
     after the scroll is identical to the first, not three tiles further into
     a running clock. */
  const STEP = 700;   /* ms between tiles landing in the same row */
  const tileIO = new IntersectionObserver(entries => {
    const arriving = entries.filter(e => e.isIntersecting).map(e => e.target)
      .sort((a, b) => tiles.indexOf(a) - tiles.indexOf(b));
    arriving.forEach((el, i) => {
      tileIO.unobserve(el);
      setTimeout(() => el.classList.add('in'), i * STEP);
    });
  }, {
    /* A tile must be genuinely ON SCREEN, not merely touching the fold:
       the bottom inset holds the trigger back until it is ~14% of the
       viewport in, and the threshold wants a real slice of the tile itself.
       Together they are "actually start to become visible". */
    rootMargin: '0px 0px -14% 0px',
    threshold: 0.18
  });
  tiles.forEach(t => tileIO.observe(t));
  /* QA: ?tiles=on lands them all immediately, so the beat can be
     photographed composed rather than mid-arrival. */
  if (q.get('tiles') === 'on') tiles.forEach(t => t.classList.add('in'));
}

/* ---- QA: compose a beat at top ---- */
const viewParam = q.get('view');
if (viewParam) {
  document.documentElement.classList.add('view-mode');
  /* DOM order of the beats, and it must MATCH the DOM or ?view=<id> strands
     an earlier beat on screen. 'process' (the "How booking works" block) was
     removed 2026-08-08 and is gone from here with it. */
  const order = ['services', 'portfolio', 'about', 'book'];
  const idx = order.indexOf(viewParam);
  if (idx > 0) order.slice(0, idx).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

/* ---- portfolio accordion + graffiti torch ---- */
const hxs = Array.from(document.querySelectorAll('#hxRow .hx'));
hxs.forEach(el => {
  const on = () => { hxs.forEach(h => h.classList.remove('active')); el.classList.add('active'); };
  el.addEventListener('mouseenter', on);
  el.addEventListener('click', on);
});
/* THE PORTFOLIO-ONLY TORCH IS GONE, AND DELETING IT WAS NOT OPTIONAL (2026-08-21).
   It wrote `--gx`/`--gy` ON THE PORTFOLIO SECTION in SECTION-LOCAL coordinates.
   Custom properties inherit, so once the site-wide wall put a `.graf` inside that
   beat, the section-scoped pair would have shadowed the viewport pair main.js
   writes on :root — and the torch would have landed at the wrong spot on exactly
   one beat of one page, with nothing in the console. The `--gd` parallax went with
   it; it drove the retired `.graffiti-bg` and had been inert since 2026-08-08. */

/* ---- the film layer ---- */
const wrap = document.getElementById('wrap');
const dimmer = document.getElementById('dimmer');
const claim = document.getElementById('claim');
const hint = document.getElementById('hint');
const vid = document.getElementById('bgvid');

let videoMode = false, lastP = 0;

/* The tear occupies p 0.05 → 0.74; the curtain rise starts at 0.762, so the
   film finishes disassembling before Services begins covering the hero. */
const TEAR_IN = 0.05, TEAR_SPAN = 0.69;

/* ---- SPEED RAMP (Fahad 2026-08-08: "speed up the scrolling effect at the
   end when the car frame changes") ----

   Measured on the shipping film, frame-exactly: it holds the correct low RS7
   Sportback until ~2.2 s of 6.5 s — the first THIRD. From ~2.33 s the
   generation morphs the body taller, and that flaw runs to the end.

   A linear playhead spends two thirds of the visitor's scroll inside the
   flawed part. This eases it instead: the clean third now gets 65% of the tear
   scroll, and the remainder is pushed through at up to 2.8x, so the body
   change goes by too fast to study.

   Deliberately a SMOOTH curve, not a two-piece speed change — a hard knee
   reads as a gear shift halfway down the hero. Speed at the top is
   RAMP_BASE x linear and climbs from there; both numbers are eye-tunable.
   ramp(0) = 0 and ramp(1) = 1 always, so the film still starts on frame 0 and
   still finishes exactly as the tear completes. */
const RAMP_BASE = 0.30;   /* playhead speed at the very top, vs linear */
const RAMP_POW = 2.6;     /* how hard it accelerates into the tail */
const ramp = t => RAMP_BASE * t + (1 - RAMP_BASE) * Math.pow(t, 1 + RAMP_POW);

/* The film is ALL-INTRA (-g 1), so every frame is a keyframe and a seek costs
   one frame decode. That is what makes scrubbing viable at all.

   The old driver serialised seeks: one in flight, the next applied only when
   'seeked' fired. That paced the film to seek round-trips instead of to the
   display, which is what read as stepping — and it swallowed the lerp above
   it, because most interpolated values never reached the video.

   Now: scroll writes a target, and ONE rAF loop writes currentTime once per
   frame with the latest value. Never more than one write per displayed frame,
   never a queue, no waiting on events. Snapping to the frame grid stops
   sub-frame seeks that decode without changing the picture. */
const FRAME = 1 / 24;
let wantedT = -1, appliedT = -1;
function seekTo(t){
  if (!isFinite(t) || t < 0) return;
  wantedT = Math.round(t / FRAME) * FRAME;
}
function flushSeek(){
  if (wantedT >= 0 && wantedT !== appliedT && vid.readyState >= 1) {
    appliedT = wantedT;
    vid.currentTime = wantedT;
  }
}
/* HERO_MODE = "still" (generate.py). The wrap carries `.still`, the CSS shows
   the garage frame, and the film must not load OR switch on behind it —
   otherwise an 8.2 MB blob is fetched for a video that is display:none and the
   scrub driver keeps writing currentTime to it. One read, used in both gates
   below, so the two can never disagree. */
const stillHero = !!(wrap && wrap.classList.contains('still'));

/* HERO_MODE = "expand" (generate.py): the Aura scroll-expand banner, ported.
   Read the same way as `.still` and for the same reason — the mode is in the
   MARKUP, so there is no frame in which the wrong hero paints.

   THE PANEL FINISHES BEFORE THE RUNWAY DOES. `--p` is the EXPANSION progress,
   not the raw scroll fraction: the panel reaches full bleed at EXPAND_SPAN and
   then simply holds. Driving it to 1.0 over the whole runway would have put the
   payoff — the garage at full bleed, bright — in the same instant as the dim
   into Services, so the picture the whole gesture is building to would never be
   seen clean. It now stands for about a fifth of the runway before the dim
   starts. The dim's own curve is moved to match, below. */
const expandHero = !!(wrap && wrap.classList.contains('expand'));
const EXPAND_SPAN = 0.40;   /* COUPLED TO .scrub-wrap.expand's height in home.css:
                               the curtain starts at 0.667 for a 400vh runway and
                               the panel must be finished well before it. Read that
                               block before changing either number. */

/* THE CLAIM'S REVEAL NEEDS ITS OWN CLOCK, and this is the whole reason `--q`
   exists rather than the reveal being another calc() off `--p`.

   `--p` is EXPANSION progress and it SATURATES: it reaches 1 the instant the
   panel hits full bleed at EXPAND_SPAN and then sits at 1 for the remaining
   60% of the runway. Fahad's brief is "once the image zooms out and becomes
   full the text appears" -- an event that starts exactly where `--p` stops
   moving, so `--p` cannot express it. Driving the reveal off the tail of `--p`
   instead (say .85 -> 1) would start the text while the panel was still
   opening, which is the one thing the brief rules out.

   `--q` is post-expansion progress: 0 at the moment the panel finishes, 1 when
   the claim has fully landed. REVEAL_SPAN 0.07 of a 400vh runway is ~28vh of
   scroll -- long enough to read as a move rather than a pop, short enough that
   the claim is fully lit at p 0.47 and holds clean before the dim begins at
   0.52 and the Services curtain at 0.667. Those two numbers are why this one
   cannot simply be made longer. */
const REVEAL_SPAN = 0.07;

function enableVideo(){
  if (videoMode || reduced || stillHero || expandHero || q.get('mode') === 'code') return;
  videoMode = true;
  document.documentElement.classList.add('video-mode');
  setProgress(lastP, true);
}
/* iOS/Safari decoder unlock */
addEventListener('pointerdown', () => { vid.play().then(() => vid.pause()).catch(() => {}); },
  { once: true, passive: true });

/* THE HERO'S VARIABLES LIVE ON THE HERO, NOT ON :root (2026-09-11, Fahad:
   "parts of the site feel very laggy"). Every reader of --p and --q is inside
   #wrap (checked against the built markup), and an inherited custom property
   written on :root restyles the WHOLE DOCUMENT — every beat, card and tile
   below the hero — on every scroll frame. On #wrap the restyle stops at the
   hero. Every write is also skipped when the value has not changed: --p sits at
   1.0000 for most of the page, and the hint and dimmer rarely move. */
const heroVars = (wrap || document.documentElement).style;
let lastPs = '', lastQs = '', lastHint = '', lastDim = '';

/* THE HEADLINE'S FADE HAS A FLOOR ON ITS DURATION (Fahad, 2026-09-11: "No Dust
   Allowed should appear a bit more faded onto the screen for a fast scroll").
   --q used to follow the scroll exactly, so a flick that crossed the ~28vh
   reveal window inside two or three frames popped the name onto the screen.

   A RATE LIMIT, NOT A LERP. A lerp trails the scroll at every speed, which
   would put a lag on the slow, deliberate scroll this reveal was tuned for.
   Capping how fast --q may RISE leaves a slow scroll exactly as it was (its
   per-frame change is under the cap and writes straight through) and only
   stretches a fast one: a full reveal can never take less than CLAIM_IN_S.
   Headline, subhead and button keep their own slices of --q in home.css, so on
   a fast scroll they still land one after another — now across that second.

   IT FALLS FASTER THAN IT RISES. Scrolling back up, the brief is that the panel
   closes with no words on it, so the exit is allowed to run in CLAIM_OUT_S.

   THIS IS NOT THE EASING THIS PAGE BANNED — nothing is synchronised to the
   claim, and the film and the curtains still read raw scroll. QA pins
   (?step, ?y) and reduced motion write straight through: the pane freezes rAF,
   and a pin that eases never arrives there. */
const CLAIM_IN_S = 0.9, CLAIM_OUT_S = 0.35;
let qTarget = 0, qShown = -1, qRaf = 0, qLast = 0;
const writeQ = v => { const s = v.toFixed(4); if (s !== lastQs) { lastQs = s; heroVars.setProperty('--q', s); } };
const qFrame = now => {
  const dt = qLast ? Math.min((now - qLast) / 1000, 0.05) : 1 / 60;
  qLast = now;
  const d = qTarget - qShown;
  const step = dt / (d > 0 ? CLAIM_IN_S : CLAIM_OUT_S);
  if (Math.abs(d) <= step) { qShown = qTarget; writeQ(qShown); qRaf = 0; qLast = 0; return; }
  qShown += d > 0 ? step : -step;
  writeQ(qShown);
  qRaf = requestAnimationFrame(qFrame);
};
const setQ = (v, immediate) => {
  qTarget = v;
  if (immediate || reduced || qShown < 0) {
    if (qRaf) cancelAnimationFrame(qRaf);
    qRaf = 0; qLast = 0; qShown = v; writeQ(v);
    return;
  }
  if (qRaf) return;                       /* already travelling toward qTarget */
  const d = v - qShown;
  if (Math.abs(d) <= (1 / 60) / (d > 0 ? CLAIM_IN_S : CLAIM_OUT_S)) { qShown = v; writeQ(v); return; }
  qRaf = requestAnimationFrame(qFrame);
};

function setProgress(p, immediate){
  lastP = p;
  /* The scroll cue retires the moment the visitor has scrolled at all. */
  const hv = p > 0.04 ? '0' : '1';
  if (hv !== lastHint) { lastHint = hv; hint.style.opacity = hv; }
  /* THE EXPAND HERO'S ONLY INPUT. Everything the panel and the split do is a
     calc() off this one number in home.css — no geometry is computed here and
     nothing is measured, so the hero cannot desynchronise from the scroll and
     costs one custom-property write per frame. */
  if (expandHero) {
    const ps = clamp01(p / EXPAND_SPAN).toFixed(4);
    if (ps !== lastPs) { lastPs = ps; heroVars.setProperty('--p', ps); }
    setQ(clamp01((p - EXPAND_SPAN) / REVEAL_SPAN), immediate);
  } else {
    /* The headline clears out before the teardown gets busy, so type never
       fights floating panels. .gone is a transform+opacity class (home.css).
       NOT IN EXPAND MODE: there the split IS the claim's exit, and adding
       `.gone` on top of it would pull the headline up and fade it while it is
       still travelling — two exits for one headline. */
    claim.classList.toggle('gone', p > 0.16);
    /* the legibility scrim retires with the headline so the film plays clean */
    document.documentElement.classList.toggle('claim-gone', p > 0.16);
  }
  /* Darken toward the end so the Services curtain rises out of black rather
     than off a bright frame. In expand mode the dim starts only once the panel
     has finished opening (EXPAND_SPAN + a beat), or the reveal and the dim
     would run over each other. */
  const dv = (expandHero
    ? clamp01((p - 0.52) / 0.34) * 0.88
    : clamp01((p - 0.62) / 0.34) * 0.88).toFixed(3);
  if (dv !== lastDim) { lastDim = dv; dimmer.style.opacity = dv; }
  if (videoMode && vid.duration) {
    const tear = clamp01((p - TEAR_IN) / TEAR_SPAN);
    seekTo(ramp(tear) * (vid.duration - FRAME));
    flushSeek();
  }
}

/* ---- QA hooks (the pane cannot render ANY scrolled state) ---- */
const yq = q.get('y');
if (yq !== null) {
  document.documentElement.style.scrollBehavior = 'auto';
  /* Lenis owns the scroll once it is running, and it would glide this jump
     back to its own target within a frame — so it is ASKED, not bypassed.
     `immediate` lands the QA pin instantly instead of animating to it, which
     is the whole point of a pin. */
  if (lenis) lenis.scrollTo(+yq || 0, { immediate: true });
  else scrollTo(0, +yq || 0);
  /* Compose the retire at the pinned position too, or the pane shows a
     scrolled page wearing its resting shadow (rAF is frozen there). */
  if (window.NDA && window.NDA.settleDim) window.NDA.settleDim();
}
const tyq = q.get('ty');
if (tyq !== null) {
  document.body.style.transform = `translateY(-${+tyq || 0}px)`;
}

const step = q.get('step');
if (step !== null && !document.documentElement.classList.contains('view-mode')) {
  setProgress(clamp01((+step || 0) / 8), true);   /* QA pin — direct seek, no lerp */
} else if (reduced || stillHero) {
  setProgress(0, true);                            /* static: rest frame, headline up */
} else {
  /* RAW scrub, one update per displayed frame.

     The lerp that used to live here is gone on purpose. The curtain beats are
     raw CSS driven by real scrollY, so any easing on the film desynchronises
     the film from the curtain — that is the bug this project chased through
     three sessions, and raising the lerp toward 1 was only ever creeping back
     toward raw. Now that seeking is cheap (all-intra) the film can simply BE
     the scroll position, which is also what a scrub should feel like: welded
     to the finger, not trailing it.

     Smoothness now comes from never doing more than one seek per frame and
     never blocking on a seek, not from interpolation. */
  let span = 1;

  /* wrap.offsetHeight was read on every scroll event — a forced synchronous
     layout in the hottest path on the page. Measured once, then only when the
     box actually changes. This is what makes the next part safe. */
  const measure = () => { span = Math.max(1, wrap.offsetHeight - innerHeight); };
  measure();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(wrap);

  /* No rAF loop. setProgress now does no layout READS — it only writes styles
     and one currentTime — so running it straight off the passive scroll event
     is both cheap and the most responsive option. Browsers already coalesce
     scroll to the frame rate, and the frame-grid snap plus the appliedT guard
     make a duplicate event a no-op, so extra events cost nothing.

     Dropping the loop also removes a real fragility: the previous versions
     went through rAF, so anywhere rAF is throttled — a background tab, low
     power mode, some embedded webviews — the hero simply stopped tracking. */
  /* `yq !== null`: under a ?y= pin every update writes straight through, so the
     pinned claim is composed in the pane instead of waiting on a frozen rAF. */
  addEventListener('scroll', () => setProgress(clamp01(scrollY / span), yq !== null),
    { passive: true });
  setProgress(clamp01(scrollY / span), true);   /* land on the resting state, never animate on load */
}

/* ---- film source: fetched as a BLOB (naive static hosts without Range
   support leave a streamed mp4 unseekable). If the fetch fails the poster
   still carries the hero — content is never gated on JS. ----

   THE FILM, rebuilt 2026-08-08. It is now a cut of the 4K master, not the
   720p draft. The master was originally pulled because its chassis morphs
   back into a solid body over the last ~2 s — but that defect sits entirely
   in footage the hero does not need: the break-apart ARC COMPLETES at 6.5 s
   (panels gone, chassis fully skeletal) and the morph only begins after it.
   Cut at 6.5 s, the defect is simply not in the file.

   ALL-INTRA (-g 1), which costs ~3.4x the bytes of a normal GOP and is the
   whole point: every frame is a keyframe, so a seek decodes one frame instead
   of walking a decode chain.

   ONE tier, at 1280, and that is measured rather than thrifty. Seek cost is
   bound by SOURCE resolution, and in-browser it runs:
     old 720p long-GOP   26.2 ms   <- the stepping that was complained about
     1280 all-intra      13.5 ms   <- inside a 60 Hz frame budget
     2560 all-intra      45.9 ms   <- crisper, but ~22 fps: worse than before
   Crispness and scrub smoothness are in direct conflict through decode cost,
   so they are served separately: the 2560 POSTER carries the rest state (what
   a visitor actually looks at, and looks at longest) and the 1280 film carries
   the motion, where detail is the first thing the eye gives up anyway.
   The handover is .bg / .bgvid in home.css. ---- */
const scrubSrc = 'assets/rs7-scrub-1280.mp4';   /* 8.2 MB, all-intra */
vid.addEventListener('loadeddata', enableVideo, { once: true });
if (!reduced && !stillHero && !expandHero && q.get('mode') !== 'code') {
  fetch(scrubSrc)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then(b => { vid.src = URL.createObjectURL(b); })
    .catch(() => {/* film unavailable — the poster still carries the hero */});
}
