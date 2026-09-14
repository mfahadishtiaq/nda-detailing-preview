/* Coverflow — vanilla port of the React reference Fahad supplied (2026-08-08).
   No framework, no dependencies: this site is static HTML from generate.py.

   The mechanism is all in `paint()`. A fractional index `pos` is the single
   source of truth; every card derives its transform from its distance to it.
   Looping folds that distance into the shorter way round the ring, so there
   are no cloned nodes and the DOM never shuffles. */

const CFG = {
  rotate: 44,      // degrees the first neighbour tilts
  depth: 0.6,      // how far it recedes, as a fraction of card width
  falloff: 0.56,   // exponent on distance; below 1 the rake eases off
  fade: 0.1,       // opacity lost per step out
  edgeSteps: 2.5,  // the last visible card fades out over this many steps.
                   // 2.5 is DERIVED, not picked: it is the value at which a big
                   // rake's outermost FULLY-VISIBLE card lands on 0.40, which is
                   // what the 5-card exterior rake already produced from its ring
                   // edge alone. 3.5 was tried first and put the fade one card
                   // too far out — the faded cards were the slivers hanging off
                   // the viewport, and the last card actually on screen still sat
                   // at 0.80. Measure "fully inside the viewport", not "near it".
  gap: 0.05,       // space between cards, as a fraction of card width
  ease: 0.16,      // exponential settle, not a spring
  maxTilt: 82,     // short of edge-on, so a far card never turns its back
  hydrate: 3,      // load a card's photo once it is within this many steps
};

function initCoverflow(root) {
  // Idempotent: the script tag is injected per page, and a stray double
  // include would otherwise attach two handler sets and two rAF loops.
  if (root.dataset.cfInit) return;
  root.dataset.cfInit = '1';

  const track = root.querySelector('.cf-track');
  const cards = Array.from(root.querySelectorAll('.cf-card'));
  const cap = root.querySelector('.cf-cap');
  const capT = root.querySelector('.cf-title');
  const capS = root.querySelector('.cf-sub');
  // The details list, when this rake has one. Positional: cards carry only the
  // VALUES, pipe-separated, against labels emitted once in the markup.
  const facts = Array.from(root.querySelectorAll('.cf-fact dd'));
  const dots = Array.from(root.querySelectorAll('.cf-dot'));
  const counter = root.querySelector('.cf-n');   // shown instead of dots past DOTS_MAX
  const count = cards.length;
  if (!count) return;

  // Read live, not once: toggling Reduce Motion with the page open must take
  // effect on the next settle rather than at the next reload.
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

  // The teleport mask assumes there is a far side of the ring to hide a card
  // on. Below four cards there is not: at 2 the second card is masked to zero
  // forever, at 1 the only card sits at half opacity. Keep every card solid.
  const maskEdges = count >= 4;

  let pos = 0;      // live fractional position
  let target = 0;   // where the settle is headed — stepping off `pos` would
                    // swallow a keypress that lands mid-flight
  let width = 0;
  let raf = null;
  let drag = null;
  let selected = -1;

  const indexAt = (p) => ((Math.round(p) % count) + count) % count;

  function setCaption(i) {
    if (i === selected) return;
    selected = i;
    const card = cards[i];
    if (capT) capT.textContent = card.dataset.title || '';
    // With dates stripped (2026-08-16) the FT and interior rakes carry no sub
    // at all, so the element is hidden rather than left as an empty line that
    // still occupies its leading under every caption.
    if (capS) {
      const sub = card.dataset.sub || '';
      capS.textContent = sub;
      capS.hidden = !sub;
    }
    /* innerHTML, not textContent, and ONLY because these values are generated
       by generate.py and can carry the site's `.nf` chip for a fact that is
       still outstanding. Nothing here is user input. A value containing a pipe
       would split wrongly; none do, and generate.py is the only writer. */
    if (facts.length) {
      const parts = (card.dataset.facts || '').split('|');
      facts.forEach((dd, n) => { dd.innerHTML = parts[n] || ''; });
    }
    dots.forEach((d, n) => {
      d.classList.toggle('is-on', n === i);
      d.setAttribute('aria-current', n === i ? 'true' : 'false');
    });
    if (counter) counter.textContent = String(i + 1);
  }

  /* Deferred photo loading.

     `loading="lazy"` is USELESS on this rake: every card is absolutely
     positioned at the same left:50%;top:0, so the browser considers all of
     them in-viewport and fetches the lot. On the Full Treatment page that is
     34 frames and 12.8MB on first paint. So cards past the opening spread ship
     with data-src and no src, and get promoted here as they come near the
     centre. The card-stack this replaced solved the same problem by windowing
     the DOM to six; this keeps every card in the DOM (so the no-JS strip still
     shows all of them) and windows only the network. */
  function hydrate(card, distance) {
    if (distance > CFG.hydrate) return;
    const img = card.querySelector('img');
    if (!img || !img.dataset.src) return;
    img.src = img.dataset.src;
    delete img.dataset.src;
  }

  function paint() {
    if (!width) return;
    const pitch = width * (1 + CFG.gap);

    cards.forEach((card, index) => {
      // Fold to the shorter way round the ring — this IS the looping.
      let offset = index - pos;
      offset = ((offset % count) + count) % count;
      if (offset > count / 2) offset -= count;

      const distance = Math.abs(offset);
      // Tilt and recession both ease off as cards travel out. A linear ramp
      // folds the second card shut; this keeps it readable.
      const ramp = Math.pow(distance, CFG.falloff);
      const tilt = Math.min(CFG.rotate * ramp, CFG.maxTilt) * Math.sign(offset);

      // transform is the only thing that genuinely changes every frame.
      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-CFG.depth * width * ramp}px) rotateY(${-tilt}deg)`;

      /* TWO EDGES, AND THE RAKE TAKES WHICHEVER BITES FIRST.

         The RING edge is the original: a card is teleported across the ring at
         exactly half a turn out, so it has to be invisible by then or the jump
         shows. It is a function of the ring's SIZE, which is why it only ever
         did anything on a small rake — at 5 cards it starts at distance 2.5 and
         visibly fades the outermost card, at 32 it starts at 16 and never
         touches anything a visitor can see. That is the whole reason the
         exterior gallery looked like it had a fade and the Full Treatment one
         did not (Fahad, 2026-08-22). Nothing had regressed: the 12-card interior
         rake, untouched all session, measured the same 0.70 as the 32-card one.

         The WINDOW edge is the fix: the last card a visitor can actually see
         should fade out whatever the ring size, so the rake ends in air instead
         of stopping at a hard 0.7 tile. `edgeSteps` is the visible half-window.

         min(), NOT multiply. Multiplying would double-darken a small rake where
         both terms are already under 1 — exterior's outermost card would drop
         from 0.40 to 0.20 and stop matching the reference Fahad pointed at. */
      const ringEdge = maskEdges ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
      const windowEdge = Math.min(1, Math.max(0, CFG.edgeSteps - distance));
      const edge = Math.min(ringEdge, windowEdge);
      const opacity = (Math.max(0, 1 - CFG.fade * distance) * edge).toFixed(3);
      const z = String(100 - Math.round(distance));
      const hidden = distance > 0.5 ? 'true' : 'false';

      // The rest are written only when they actually change. Re-stamping
      // aria-hidden sixty times a second invalidates the accessibility tree
      // just as often, which is the difference between a usable and an
      // unusable rake with a screen reader running -- and this page has 34
      // cards, not 12.
      const last = card._cf || (card._cf = {});
      if (last.opacity !== opacity) { card.style.opacity = opacity; last.opacity = opacity; }
      if (last.z !== z) { card.style.zIndex = z; last.z = z; }
      if (last.hidden !== hidden) { card.setAttribute('aria-hidden', hidden); last.hidden = hidden; }

      hydrate(card, distance);
    });
  }

  function settle(to) {
    if (raf !== null) cancelAnimationFrame(raf);
    target = to;
    setCaption(indexAt(to));

    if (motionQuery.matches) { pos = to; paint(); raf = null; moving(false); return; }

    moving(true);
    const step = () => {
      const remaining = target - pos;
      if (Math.abs(remaining) < 0.0004) {
        pos = target;
        paint();
        raf = null;
        moving(false);
        return;
      }
      pos += remaining * CFG.ease;
      paint();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  /* will-change promotes a compositor layer per card and holds it for as long
     as it is set. Left on permanently that is 34 layers at 300x533 CSS px,
     retained while the section sits thousands of pixels off screen. One class
     on the root turns them on for the duration of a gesture instead -- and it
     is one class write, not 34 style writes. */
  function moving(on) { root.classList.toggle('is-moving', on); }

  const nudge = (by) => settle(Math.round(target) + by);

  function goTo(index) {
    // Shorter way round rather than unwinding the whole ring.
    settle(index + Math.round((target - index) / count) * count);
  }

  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;      // a right-click must not kill an in-flight settle
    if (drag || !e.isPrimary) return; // a second finger must not hijack the gesture
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    track.setPointerCapture(e.pointerId);
    target = pos;
    drag = { id: e.pointerId, x: e.clientX, pos, v: 0, t: performance.now(),
             card: e.target.closest('.cf-card'), moved: 0 };
    root.classList.add('is-dragging');
    moving(true);
    // The caption changes once per card the drag passes. Those are not
    // announcements to queue and read back after the gesture; only the settled
    // position is. Silence the live region until release.
    if (cap) cap.setAttribute('aria-live', 'off');
  });

  track.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const pitch = width * (1 + CFG.gap);
    if (!pitch) return;
    const now = performance.now();
    const prev = pos;
    const dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    pos = drag.pos - dx / pitch;
    drag.v = ((pos - prev) / Math.max(now - drag.t, 1)) * 1000; // cards/sec
    drag.t = now;
    setCaption(indexAt(pos));
    paint();
  });

  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    root.classList.remove('is-dragging');
    if (cap) cap.setAttribute('aria-live', 'polite');

    if (e.type === 'pointercancel') {
      // The browser reclaimed the gesture (it became a page scroll, or the
      // pointer was lost). That is not a flick -- carrying momentum here
      // advances the rake on a gesture the user never completed.
      settle(Math.round(d.pos));
      return;
    }

    // A tap on an off-centre card centres it. This cannot live on a click
    // listener: setPointerCapture retargets the subsequent click to the track,
    // so per-card click handlers never fire at all. The 6px guard keeps a
    // drag that happens to end over a card from reading as a tap.
    if (d.moved < 6 && d.card) {
      const i = cards.indexOf(d.card);
      if (i > -1 && i !== indexAt(pos)) { goTo(i); return; }
    }

    // Let a flick carry, but never more than two cards.
    settle(Math.round(pos + Math.max(-2, Math.min(2, d.v * 0.18))));
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
  });

  root.querySelectorAll('[data-cf-nav]').forEach((btn) => {
    btn.addEventListener('click', () => nudge(Number(btn.dataset.cfNav)));
  });
  dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
  // Card taps are handled in endDrag, not here — see the note there.

  // Card width drives pitch, depth and perspective, so it is the only thing
  // worth measuring — and only when the box actually changes.
  const measure = () => {
    const w = cards[0].offsetWidth;
    if (!w) return false;
    width = w;
    paint();
    return true;
  };

  /* .is-live swaps the no-JS scrolling strip for the rake, so it must go on
     before measure() reads a width — measuring a flex child would return the
     strip's width, not the card's. But it must not STAY on unless that read
     actually succeeded: a zero-width measure (the section still display:none,
     a font or layout pass not yet done) would otherwise leave every card
     stacked at left:50% with no fallback and no retry. So commit it, measure,
     and hand the strip back if the measurement did not land. */
  root.classList.add('is-live');
  try {
    if (!measure()) root.classList.remove('is-live');
    setCaption(0);
    new ResizeObserver(() => {
      if (measure()) root.classList.add('is-live');
    }).observe(root);
  } catch (err) {
    root.classList.remove('is-live');
    throw err;
  }
}

document.querySelectorAll('[data-coverflow]').forEach(initCoverflow);
