/* ==========================================================================
   AYHAN — HAIR · interaction & scroll choreography
   GSAP + ScrollTrigger + Lenis, two Three.js scenes (stage.js, dice.js)
   ========================================================================== */
import { createStage } from './stage.js';
import { createDice, rollAt } from './dice.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
root.classList.add('js');

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------ smooth scroll */
let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollTo = (target, opts = {}) => {
  if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' });
  else $(target)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
};

/* ------------------------------------------------------------------- grain */
(() => {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const x = c.getContext('2d');
  const d = x.createImageData(180, 180);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  root.style.setProperty('--noise', `url(${c.toDataURL('image/png')})`);
})();

/* ------------------------------------------------------------------ cursor */
// Mouse-driven parallax only: on phones a scrolling finger also fires pointermove,
// which made the 3D tools sway while you scrolled.
const pointerN = { x: 0, y: 0 };
if (finePointer) {
  addEventListener('pointermove', (e) => {
    pointerN.x = (e.clientX / innerWidth) * 2 - 1;
    pointerN.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
}

if (finePointer) {
  const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
  }, { passive: true });
  gsap.ticker.add(() => {
    rx += (mx - rx) * 0.2;
    ry += (my - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
  });
  document.addEventListener('pointerover', (e) => {
    const view = e.target.closest('[data-cursor]');
    const link = !view && e.target.closest('a, button, .service');
    cur.classList.toggle('is-view', !!view);
    cur.classList.toggle('is-link', !!link);
    if (view) label.textContent = view.dataset.cursorLabel || 'View';
  });
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  document.addEventListener('mouseleave', () => (cur.style.opacity = 0));
  document.addEventListener('mouseenter', () => (cur.style.opacity = 1));
}

/* -------------------------------------------------------------- magnetic */
if (finePointer) {
  $$('.magnetic').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.35);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* -------------------------------------------------------------- anchors */
$$('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (!id || !id.startsWith('#')) return;
  e.preventDefault();
  scrollTo(id === '#top' ? 0 : id);
}));
$('.to-top')?.addEventListener('click', () => scrollTo(0, { duration: 2.4 }));
$$('.service').forEach((s) => s.addEventListener('click', () => scrollTo('#book')));
$('.year').textContent = new Date().getFullYear();

/* ---------------------------------------------------------- WebGL stage */
let stage = null;
try {
  stage = createStage($('#stage'));
  stage.setPointer(0, 0);
  gsap.ticker.add((t, dt) => {
    stage.setPointer(pointerN.x, pointerN.y);
    stage.tick(t, dt);
  });
} catch (err) {
  console.warn('WebGL stage unavailable', err);
  $('#stage')?.remove();
}

/* ------------------------------------------------------ hero cut geometry */
const heroTitle = $('.hero__title');
const cutline = $('.hero__cutline');
function measureCut() {
  // Find the vertical centre of the cap glyphs so the cut runs through the letters' middle.
  const cs = getComputedStyle(heroTitle);
  const fs = parseFloat(cs.fontSize);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
  const m = ctx.measureText('AYHAN');
  const asc = m.fontBoundingBoxAscent ?? fs * 0.9;
  const desc = m.fontBoundingBoxDescent ?? fs * 0.25;
  const lineH = fs; // line-height: 1
  const baseline = (lineH - (asc + desc)) / 2 + asc;
  const capCentre = baseline - m.actualBoundingBoxAscent / 2;
  const f = clamp(capCentre / lineH, 0.2, 0.8);
  root.style.setProperty('--cut-t', `${(f * 100).toFixed(2)}%`);
  root.style.setProperty('--cut-b', `${((1 - f) * 100).toFixed(2)}%`);
  // offsets ignore transforms, so this stays correct mid-animation
  const span = $('.cut--top');
  const yPx = heroTitle.offsetTop + span.offsetTop + span.offsetHeight * f;
  cutline.style.top = `${yPx}px`;
  if (stage) stage.setCutY(1 - (2 * yPx) / stage.height);
}

/* ------------------------------------------------------------- loader */
function imgReady(img) {
  return img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; });
}
function runLoader() {
  const loader = $('.loader');
  const count = $('.loader__count span');
  const sc = $('.loader__scissors');
  const cut = $('.loader__cut');
  const st = { v: 0 };
  const ready = Promise.race([
    Promise.all([document.fonts.ready, imgReady($('.hero__img img'))]),
    new Promise((r) => setTimeout(r, 2600)),
  ]);
  const update = () => {
    count.textContent = String(Math.round(st.v)).padStart(3, '0');
    sc.style.left = `${st.v}%`;
    cut.style.width = `${st.v}%`;
  };
  if (reduceMotion) {
    return ready.then(() => { loader.remove(); });
  }
  return new Promise((resolve) => {
    gsap.to(st, {
      v: 78, duration: 1.5, ease: 'power2.inOut', onUpdate: update,
      onComplete: () => ready.then(() => gsap.to(st, {
        v: 100, duration: 0.55, ease: 'power3.out', onUpdate: update,
        onComplete: () => {
          const tl = gsap.timeline({ onComplete: () => { loader.remove(); } });
          tl.to('.loader__brand, .loader__count, .loader__scissors', { opacity: 0, duration: 0.3 })
            .to('.loader__dash', { opacity: 0, duration: 0.2 }, 0)
            .to('.loader__half--top', { yPercent: -100, duration: 1.15, ease: 'expo.inOut' }, 0.25)
            .to('.loader__half--bottom', { yPercent: 100, duration: 1.15, ease: 'expo.inOut' }, 0.25)
            .to('.loader__cut', { opacity: 0, duration: 0.4 }, 0.55)
            .add(resolve, 0.45);
        },
      })),
    });
  });
}

/* ----------------------------------------------------------- hero intro */
function heroIntro() {
  const tl = gsap.timeline();
  tl.from('.hero__img', { clipPath: 'inset(50% 0% 50% 0%)', duration: 1.5, ease: 'expo.inOut' }, 0)
    .from('.hero__img img', { scale: 1.5, duration: 2, ease: 'expo.out' }, 0.25)
    .from('.cut--top > span', { yPercent: -110, duration: 1.3, stagger: 0.06, ease: 'expo.out' }, 0.35)
    .from('.cut--bottom > span', { yPercent: 110, duration: 1.3, stagger: 0.06, ease: 'expo.out' }, 0.35)
    .from('.hero__fa', { opacity: 0, x: -40, duration: 1.4, ease: 'expo.out' }, 0.7)
    .from('.hero__meta', { opacity: 0, y: 24, duration: 1, stagger: 0.07, ease: 'power3.out' }, 0.9)
    .from('.nav', { opacity: 0, y: -20, duration: 1, ease: 'power3.out', clearProps: 'opacity,transform,translate' }, 0.9)
    .add(() => stage?.intro(1.9), 0.55);
  return tl;
}

/* ------------------------------------------------------- word splitting */
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
          else {
            const s = document.createElement('span');
            s.className = 'word';
            s.textContent = part;
            frag.appendChild(s);
          }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
}

/* ======================================================= scroll scenes */
function buildScenes() {
  /* ---- HERO: pin + the cut ---- */
  const heroTL = gsap.timeline({
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: '+=170%',
      pin: true,
      scrub: 0.8,
      onRefresh: measureCut,
    },
  });
  heroTL
    .to('.hero__meta, .hero__fa', { opacity: 0, duration: 0.12 }, 0.02)
    .to({}, { duration: 0.56 }, 0)
    .to('.cut--top', { yPercent: -16, xPercent: -5, rotate: -3, duration: 0.44, ease: 'power3.in' }, 0.56)
    .to('.cut--bottom', { yPercent: 16, xPercent: 5, rotate: 3, duration: 0.44, ease: 'power3.in' }, 0.56)
    .to('.hero__img', { scale: 0.82, duration: 0.44, ease: 'power2.in' }, 0.56)
    .to('.hero__img img', { filter: 'contrast(1.2) brightness(0.35)', duration: 0.44 }, 0.56)
    .to('.hero__cutline', { opacity: 0, duration: 0.2 }, 0.8);
  const heroST = heroTL.scrollTrigger;

  stage?.onFrame((cut) => {
    let s = 0;
    if (cut.full) s = 1;
    else if (cut.active) s = clamp((innerWidth - cut.x) / innerWidth);
    cutline.style.transform = `scaleX(${s})`;
  });

  /* ---- ABOUT: words light up, images reveal ---- */
  $$('[data-words]').forEach((el) => {
    splitWords(el);
    gsap.to(el.querySelectorAll('.word'), {
      opacity: 1,
      stagger: 0.06,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 42%', scrub: true },
    });
  });

  $$('.reveal-img').forEach((f) => {
    const img = f.querySelector('img');
    gsap.timeline({ scrollTrigger: { trigger: f, start: 'top 88%' } })
      .fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' })
      .fromTo(img, { scale: 1.4 }, { scale: 1, duration: 2, ease: 'expo.out' }, 0.1);
    gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: f, scrub: true } });
  });

  /* ---- INTERLUDE: marquees + flying tools ---- */
  const interST = ScrollTrigger.create({ trigger: '.interlude', start: 'top bottom', end: 'bottom top' });
  const marquees = $$('.marquee').map((m) => {
    const inner = m.querySelector('.marquee__inner');
    inner.innerHTML += inner.innerHTML;
    return { inner, dir: +m.dataset.dir, x: 0, w: 0 };
  });
  const measureMarquees = () => marquees.forEach((m) => (m.w = m.inner.scrollWidth / 2));
  measureMarquees();
  addEventListener('resize', measureMarquees);
  let mDir = 1;
  gsap.ticker.add((t, dt) => {
    if (!interST.isActive) return;
    const v = lenis ? lenis.velocity : 0;
    if (Math.abs(v) > 0.2) mDir = v > 0 ? 1 : -1;
    const speed = (0.05 + Math.min(Math.abs(v) * 0.045, 1.4)) * mDir;
    marquees.forEach((m) => {
      m.x -= m.dir * speed * dt;
      if (m.x <= -m.w) m.x += m.w;
      if (m.x > 0) m.x -= m.w;
      m.inner.style.transform = `translate3d(${m.x}px,0,0)`;
    });
  });

  /* ---- SNIP dividers ---- */
  $$('.snip').forEach((s) => {
    const holder = s.querySelector('.snip__dashes');
    const n = Math.max(24, Math.round(s.offsetWidth / 22));
    for (let i = 0; i < n; i++) holder.appendChild(document.createElement('i'));
    const dashes = [...holder.children];
    const sc = s.querySelector('.snip__scissors');
    const a = sc.querySelector('.sc-a'), b = sc.querySelector('.sc-b');
    ScrollTrigger.create({
      trigger: s, start: 'top 88%', end: 'top 30%', scrub: 0.6,
      onUpdate: (self) => {
        const p = self.progress;
        sc.style.left = `calc(${p * 100}% + ${(0.5 - p) * 58}px)`; // stays inside the row
        const ang = Math.abs(Math.sin(p * Math.PI * 16)) * 20;
        a.style.transform = `rotate(${ang}deg)`;
        b.style.transform = `rotate(${-ang}deg)`;
        dashes.forEach((d, i) => {
          const k = clamp((p - i / n) * 7);
          d.style.transform = k ? `translate(${k * 10}px, ${k * k * 70}px) rotate(${k * 120 * (i % 2 ? 1 : -1)}deg)` : '';
          d.style.opacity = 1 - k;
        });
      },
    });
  });

  /* ---- SERVICES: cursor-follow preview ---- */
  if (finePointer) {
    const prev = $('.services__preview');
    const inner = $('.services__preview-inner');
    const list = $('.services__list');
    let tx = 0, ty = 0, px = 0, py = 0, shown = false, currentSrc = '';
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    gsap.ticker.add(() => {
      if (!shown && !gsap.isTweening(prev)) return;
      px += (tx - px) * 0.14;
      py += (ty - py) * 0.14;
      const rot = clamp((tx - px) * 0.05, -12, 12);
      prev.style.transform = `translate3d(${px + 40}px, ${py}px, 0) translate(0,-50%) rotate(${rot}deg)`;
    });
    $$('.service').forEach((row) => {
      row.addEventListener('pointerenter', () => {
        const src = row.dataset.img;
        if (src === currentSrc) return;
        currentSrc = src;
        const img = new Image();
        img.src = src;
        img.alt = '';
        inner.appendChild(img);
        gsap.fromTo(img, { clipPath: 'inset(100% 0 0 0)', scale: 1.3 }, {
          clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 0.8, ease: 'expo.out',
          onComplete: () => { while (inner.children.length > 1) inner.firstChild.remove(); },
        });
      });
    });
    list.addEventListener('pointerenter', () => {
      if (!shown) { px = tx; py = ty; }
      shown = true;
      gsap.to(prev, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
    });
    list.addEventListener('pointerleave', () => {
      shown = false;
      currentSrc = '';
      gsap.to(prev, { autoAlpha: 0, scale: 0.85, duration: 0.4, ease: 'power3.out' });
    });
  }
  // (li opacity is owned by the CSS hover-dim transition, so fade the children instead)
  const svcTL = gsap.timeline({ scrollTrigger: { trigger: '.services__list', start: 'top 80%' } });
  $$('.service').forEach((row, i) => {
    svcTL.from(row, { y: 60, duration: 1.1, ease: 'expo.out' }, i * 0.08)
      .from(row.children, { opacity: 0, duration: 0.9, ease: 'power2.out' }, i * 0.08);
  });

  /* ---- LOOKBOOK: horizontal ---- */
  const track = $('.lookbook__track');
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  const bar = $('.lookbook__progress span');
  const hTween = gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: '.lookbook',
      start: 'top top',
      end: () => `+=${dist()}`,
      pin: true,
      scrub: 0.8,
      invalidateOnRefresh: true,
      onUpdate: (self) => (bar.style.transform = `scaleX(${self.progress})`),
    },
  });
  $$('.look__frame img').forEach((img) => {
    gsap.fromTo(img, { xPercent: -6 }, {
      xPercent: 6, ease: 'none',
      scrollTrigger: { trigger: img.closest('.look'), containerAnimation: hTween, start: 'left right', end: 'right left', scrub: true },
    });
  });
  $$('.look').forEach((f) => {
    gsap.from(f, {
      yPercent: 12, opacity: 0, duration: 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: f, containerAnimation: hTween, start: 'left 92%' },
    });
  });

  /* ---- INK 01: RISK dice ---- */
  let dice = null;
  const diceP = { p: 0 };
  // The title rolls with the dice: RISK → RICH (S→C, K→H)
  const rolls = $$('.risk-title .roll').map((r, k) => ({ spans: [...r.children], i: k + 2 }));
  const syncTitle = () => rolls.forEach(({ spans, i }) => {
    const r = rollAt(diceP.p, i);
    const e = r < 0.5 ? 4 * r * r * r : 1 - Math.pow(-2 * r + 2, 3) / 2;
    spans.forEach((s) => (s.style.transform = `translateY(${-e * 100}%)`));
  });
  gsap.to(diceP, {
    p: 1, ease: 'none',
    onUpdate: () => { dice?.setProgress(diceP.p); syncTitle(); },
    scrollTrigger: { trigger: '.tattoo--risk .tattoo__art', start: 'top 85%', end: 'center 30%', scrub: 1 },
  });
  createDice($('.dice-canvas')).then((d) => {
    dice = d;
    dice.setProgress(diceP.p);
    gsap.ticker.add(() => dice.tick());
  }).catch((e) => console.warn('dice unavailable', e));

  /* ---- INK 02: stairs, stencil then needle ---- */
  const stairs = $('.stairs');
  const inkG = stairs.querySelector('.ink-group');
  const stencil = inkG.cloneNode(true);
  stencil.classList.remove('ink-group');
  stencil.classList.add('stencil');
  stencil.removeAttribute('filter');
  stairs.insertBefore(stencil, inkG);
  const draws = $$('.draw', inkG);
  draws.forEach((p) => p.setAttribute('pathLength', '1'));
  gsap.set(draws, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.timeline({ scrollTrigger: { trigger: '.tattoo--stairs .tattoo__art', start: 'top 78%', end: 'bottom 55%', scrub: 1 } })
    .from(stencil, { opacity: 0, duration: 0.15 })
    .to(draws, { strokeDashoffset: 0, duration: 0.35, stagger: 0.035, ease: 'power1.inOut' }, 0.1);

  /* ---- INK 03: trust, typed then struck ---- */
  const word = $('.trust__word');
  const ghost = word.cloneNode(true);
  ghost.classList.add('stencil-text');
  ghost.classList.remove('trust__word');
  ghost.removeAttribute('filter');
  word.parentNode.insertBefore(ghost, word);
  const letters = $$('tspan', word);
  const strike = $('.trust__strike');
  gsap.set(letters, { fillOpacity: 0 });
  gsap.set(strike, { strokeDasharray: 1, strokeDashoffset: 1 });
  gsap.timeline({ scrollTrigger: { trigger: '.tattoo--trust .tattoo__art', start: 'top 75%', end: 'bottom 45%', scrub: 1 } })
    .to(letters, { fillOpacity: 1, duration: 0.06, stagger: 0.14, ease: 'none' })
    .to(strike, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' }, '+=0.12')
    .to('.tattoo--trust .tattoo__art', { x: () => (Math.random() < 0.5 ? -1 : 1) * 4, duration: 0.03, yoyo: true, repeat: 3 }, '-=0.1');

  /* ---- INK 04: quote, written by the needle ---- */
  const qSvg = $('.quote');
  const qPaths = [$('#q-line-1'), $('#q-line-2')];
  const qMasks = $$('.q-mask-line', qSvg);
  const qTexts = $$('.q-ink text', qSvg);
  const needle = $('.q-needle', qSvg);
  gsap.set(qMasks, { strokeDasharray: 1, strokeDashoffset: 1 });
  let qGeom = null;
  const measureQuote = () => {
    qGeom = qPaths.map((p, i) => {
      const len = p.getTotalLength();
      let tl = len * 0.9;
      try { tl = qTexts[i].getComputedTextLength(); } catch (e) { /* noop */ }
      const start = Math.max(0, (len - tl) / 2);
      return { p, len, start, tl };
    });
  };
  const qState = { p: 0 };
  const renderQuote = () => {
    if (!qGeom) measureQuote();
    const p = qState.p;
    const locals = [clamp(p / 0.48), clamp((p - 0.52) / 0.48)];
    let head = null;
    locals.forEach((l, i) => {
      const g = qGeom[i];
      const at = g.start + l * g.tl;
      qMasks[i].style.strokeDashoffset = 1 - (l <= 0 ? 0 : at / g.len);
      if (l > 0 && l < 1) head = g.p.getPointAtLength(at);
    });
    if (head) {
      const jx = (Math.random() - 0.5) * 2.2, jy = (Math.random() - 0.5) * 2.2;
      needle.setAttribute('transform', `translate(${head.x + jx} ${head.y + jy - 30})`);
      needle.style.opacity = 1;
    } else needle.style.opacity = 0;
  };
  gsap.to(qState, {
    p: 1, ease: 'none', onUpdate: renderQuote,
    scrollTrigger: {
      trigger: '.tattoo--quote', start: 'top top', end: '+=150%', pin: true, scrub: 0.9,
      onRefresh: () => { measureQuote(); renderQuote(); },
    },
  });

  $$('.tattoo__info').forEach((info) => {
    gsap.from(info.children, {
      y: 40, opacity: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out',
      scrollTrigger: { trigger: info, start: 'top 80%' },
    });
  });

  /* ---- section heads ---- */
  $$('.section-head .display, .book__title').forEach((h) => {
    gsap.from(h, {
      yPercent: 30, opacity: 0, duration: 1.4, ease: 'expo.out',
      scrollTrigger: { trigger: h, start: 'top 85%' },
    });
  });

  /* ---- BOOK: the razor opens ---- */
  const bookST = ScrollTrigger.create({ trigger: '.book', start: 'top bottom', end: 'top top' });
  const footST = ScrollTrigger.create({ trigger: '.footer', start: 'top 70%', end: 'bottom bottom' });
  gsap.to('.strike-red', {
    '--s': 1, duration: 0.9, ease: 'power3.inOut',
    scrollTrigger: { trigger: '.book__title', start: 'top 60%' },
  });

  /* ---- NAV: tuck away while reading down, return on the way up ---- */
  const nav = $('.nav');
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > innerHeight * 0.6),
  });

  /* ---- FOOTER ---- */
  gsap.from('.footer__en', {
    yPercent: 40, opacity: 0, duration: 1.6, ease: 'expo.out',
    scrollTrigger: { trigger: '.footer', start: 'top 80%' },
  });
  gsap.from('.footer__fa', {
    yPercent: 60, opacity: 0, duration: 1.6, delay: 0.1, ease: 'expo.out',
    scrollTrigger: { trigger: '.footer', start: 'top 80%' },
  });

  const bookStage = $('.book__stage');
  stage?.setDrivers({
    hero: () => heroST.progress,
    inter: () => interST.progress,
    book: () => bookST.progress,
    foot: () => footST.progress,
    bookAnchor: () => {
      const r = bookStage.getBoundingClientRect();
      return { x: ((r.left + r.width / 2) / innerWidth) * 2 - 1, y: 1 - ((r.top + r.height / 2) / stage.height) * 2 };
    },
  });
  if (!stage) heroTL.fromTo('.hero__cutline', { scaleX: 0 }, { scaleX: 1, duration: 0.46, ease: 'none' }, 0.1);

  // refresh top-to-bottom so pin spacing above is known to everything below
  ScrollTrigger.sort();
}

/* ================================================================ boot */
measureCut();
buildScenes();

const boot = async () => {
  await runLoader();
  root.classList.remove('is-loading');
  measureCut();
  ScrollTrigger.refresh();
  if (!reduceMotion) heroIntro();
  else stage?.intro(0.01);
  lenis?.start();
};
boot();

document.fonts.ready.then(() => { measureCut(); ScrollTrigger.refresh(); });
addEventListener('load', () => ScrollTrigger.refresh());
// Phones fire resize whenever the URL bar shows/hides — ignore those, only re-layout on real changes.
let rT, lastW = innerWidth, lastH = innerHeight;
addEventListener('resize', () => {
  const w = innerWidth, h = innerHeight;
  if (w === lastW && Math.abs(h - lastH) < 160) return;
  lastW = w; lastH = h;
  clearTimeout(rT);
  rT = setTimeout(() => { measureCut(); ScrollTrigger.refresh(); }, 220);
});
