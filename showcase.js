/* Showcase ring — vanilla port of the React 3D coverflow reference Fahad
   supplied (2026-09-03). No framework, no dependencies: this site is static
   HTML from generate.py.

   THIS IS NOT coverflow.js AND MUST NOT BE MERGED INTO IT. That one is a
   continuous fractional-index rake with its caption outside the cards, and the
   six service pages depend on it. This is a discrete ring: one integer index,
   every card's appearance derived from its RING DISTANCE to that index, and the
   copy living inside each card.

   THE JS OWNS ONE NUMBER. Everything visual is a `data-pos` attribute the CSS
   styles — so the geometry is readable in one place in home.css instead of being
   spread through inline style writes, and a card's look can be inspected in
   devtools without stepping the animation. The reference wrote inline transforms
   per card per render; that is idiomatic React and wrong for a static page.

   POSITIONS: 0 centre, ±1 first neighbour, ±2 second, and `far` for everything
   beyond, which is parked off-stage rather than removed (removal would make the
   ring re-enter from the wrong side). */

(function () {
  var root = document.querySelector('[data-showcase]');
  if (!root) return;
  /* Idempotent: the tag is injected by page_scripts() and a stray double
     include would otherwise attach two key handlers and two timers. */
  if (root.dataset.scInit) return;
  root.dataset.scInit = '1';

  var cards = Array.prototype.slice.call(root.querySelectorAll('.sc-card'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('.sc-dot'));
  var live = root.querySelector('.sc-live');
  var total = cards.length;
  if (!total) return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var index = 0;
  var timer = null;

  /* 7000ms, not the reference's 5000. The reference cycles a food menu where a
     card is a photograph and a name; each of these carries a make, a model, a
     colour, a date and a link, and 5s is not long enough to read that and then
     decide to click. It also stops on ANY interaction below, permanently. */
  var DELAY = 7000;

  /* Ring distance, signed, folded the short way round: with 10 cards, card 9 is
     at -1 from card 0, not +9. This is what lets the ring loop without cloning
     nodes or reordering the DOM. */
  function delta(i) {
    var d = (i - index + total) % total;
    return d > total / 2 ? d - total : d;
  }

  function paint() {
    for (var i = 0; i < total; i++) {
      var d = delta(i);
      var card = cards[i];
      var pos = Math.abs(d) > 2 ? 'far' : String(d);
      if (card.dataset.pos !== pos) card.dataset.pos = pos;
      /* The centre card is the only one in the tab order and the only one whose
         link is reachable. Leaving five links focusable would mean tabbing
         through cars nobody can see — and the reference simply left them all in
         the DOM with pointer-events off, which stops the mouse but not the
         keyboard. */
      var isCentre = d === 0;
      card.setAttribute('aria-hidden', isCentre ? 'false' : 'true');
      var cta = card.querySelector('.sc-cta');
      if (cta) cta.tabIndex = isCentre ? 0 : -1;
    }
    for (var k = 0; k < dots.length; k++) {
      dots[k].setAttribute('aria-selected', k === index ? 'true' : 'false');
      dots[k].classList.toggle('on', k === index);
    }
    /* Announced, because the arrows and dots change what is on screen without
       moving focus. Reading the card's own label keeps one source of truth. */
    if (live) {
      var lab = cards[index].getAttribute('aria-label') || '';
      if (live.textContent !== lab) live.textContent = lab;
    }
  }

  function go(i) {
    index = ((i % total) + total) % total;
    paint();
  }
  function next() { go(index + 1); }
  function prev() { go(index - 1); }

  /* Autoplay stops for good on the first real interaction. A carousel that
     resumes after a click keeps stealing the card the visitor chose. */
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  function start() {
    if (reduced || total < 2 || timer) return;
    timer = setInterval(next, DELAY);
  }

  root.addEventListener('click', function (e) {
    var dot = e.target.closest('.sc-dot');
    var arrow = e.target.closest('.sc-arrow');
    var card = e.target.closest('.sc-card');
    if (dot) { stop(); go(+dot.dataset.go); return; }
    if (arrow) { stop(); arrow.classList.contains('sc-next') ? next() : prev(); return; }
    /* Clicking a shoulder card brings it to the centre. Clicking the CENTRE card
       must not — the centre card contains the real link, and swallowing that
       click would break the only navigation this component offers. */
    if (card && card.dataset.pos !== '0' && !e.target.closest('.sc-cta')) {
      stop();
      go(cards.indexOf(card));
    }
  });

  /* Arrow keys work only while the ring has focus inside it. Bound to the
     component, NOT to window: the reference put its handler on window, so on a
     page with any other content the left/right keys hijacked the whole document
     — here that would fight the service tiles and the portfolio accordion. */
  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { stop(); prev(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { stop(); next(); e.preventDefault(); }
  });

  /* Touch: a horizontal drag past 45px turns the ring. The threshold check on
     BOTH axes is what the reference lacked — without it a vertical page scroll
     that drifts sideways flips the card under the finger. */
  var sx = 0, sy = 0;
  root.addEventListener('touchstart', function (e) {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  root.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      stop();
      dx < 0 ? next() : prev();
    }
  }, { passive: true });

  /* MOUSE DRAG, 2026-09-03 (Fahad: "customers can change pictures by swiping
     right to left"). Touch already did this; a laptop visitor had no swipe at
     all -- only the arrows, the dots and clicking a shoulder card.

     POINTER EVENTS, FILTERED TO MOUSE. A touch also fires pointer events, so
     an unfiltered handler would run alongside the touchend one above and turn
     the ring TWICE per swipe. Same 45px threshold and same both-axes test, so
     the two inputs cannot disagree about what counts as a swipe.

     THE CLICK AFTER A DRAG IS SWALLOWED, IN THE CAPTURE PHASE. A drag that
     starts on a shoulder card ends with a click on it, which the handler above
     reads as "bring this card to the centre" -- so the ring would turn once for
     the drag and again for the click. On the CENTRE card the same click follows
     the car's link and leaves the page mid-gesture. Capture is what lets this
     run before that handler rather than after it.

     dragstart is cancelled or the browser starts a native image drag instead,
     which shows a ghost of the photo and never fires pointerup. */
  var mx = 0, my = 0, mdown = false, mdragged = false;
  root.addEventListener('dragstart', function (e) { e.preventDefault(); });
  root.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    mdown = true; mdragged = false; mx = e.clientX; my = e.clientY;
  });
  root.addEventListener('pointerup', function (e) {
    if (!mdown || e.pointerType !== 'mouse') return;
    mdown = false;
    var dx = e.clientX - mx, dy = e.clientY - my;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      mdragged = true;
      stop();
      dx < 0 ? next() : prev();
    }
  });
  root.addEventListener('pointercancel', function () { mdown = false; });
  root.addEventListener('click', function (e) {
    if (mdragged) { mdragged = false; e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* Pause while the pointer is over it, and while the tab is hidden — a
     background tab advancing a carousel is work nobody sees, and the visitor
     returns to a card that is not the one they left. */
  root.addEventListener('mouseenter', function () { if (timer) { stop(); root.dataset.scPaused = '1'; } });
  root.addEventListener('mouseleave', function () { if (root.dataset.scPaused) { delete root.dataset.scPaused; start(); } });
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : (root.dataset.scPaused ? null : start());
  });
  /* Focus entering the ring pauses it too: a keyboard visitor reading a card
     should not have it rotated away mid-sentence. */
  root.addEventListener('focusin', function () { stop(); });

  /* `html.sclive` is added ONLY here, so the hidden/stacked state in home.css
     cannot exist without the thing that undoes it (production-rules #31). With
     no JS the cards stay a plain readable column. */
  document.documentElement.classList.add('sclive');
  paint();

  /* Autoplay waits until the ring is actually on screen, and stops again when it
     leaves. Starting on load means the first three cards have already gone by
     before a visitor scrolls down to it. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.isIntersecting ? start() : stop(); });
    }, { threshold: 0.35 }).observe(root);
  } else {
    start();
  }
})();
