/* ==========================================================================
   Fixed WebGL stage — chrome barber shears, ebony comb, straight razor.
   Everything is procedurally modelled (no external models), lit by a
   PMREM room environment with a blood-red rim light.
   Poses are keyframed against scroll progress and damped every frame.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

const PI = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);

/** Interpolate a keyframe list [{p, ...props}] at progress p. */
function sample(keys, p) {
  if (p <= keys[0].p) return { ...keys[0] };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (p <= b.p) {
      const t = smooth(clamp((p - a.p) / (b.p - a.p || 1)));
      const o = {};
      for (const k in a) o[k] = lerp(a[k], b[k] ?? a[k], t);
      return o;
    }
  }
  return { ...keys[keys.length - 1] };
}

/* ---------------------------------------------------------------- models */

function makeScissors(chrome, gun) {
  const root = new THREE.Group();
  const halves = [];

  for (const s of [1, -1]) {
    const half = new THREE.Group();
    const z = 0.05 * s;

    // Blade — flat, tapered, with a gently curved spine.
    const shape = new THREE.Shape();
    shape.moveTo(-0.3, 0.03 * s);
    shape.lineTo(3.3, 0.0);
    shape.quadraticCurveTo(2.5, 0.34 * s, 0.9, 0.33 * s);
    shape.quadraticCurveTo(0.1, 0.32 * s, -0.3, 0.27 * s);
    shape.lineTo(-0.3, 0.03 * s);
    const bladeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018,
      bevelSegments: 3, curveSegments: 32,
    });
    bladeGeo.translate(0, 0, -0.025);
    const blade = new THREE.Mesh(bladeGeo, chrome);
    blade.position.z = z;
    half.add(blade);

    // Shank — forged bar from the pivot to the finger ring.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.15, 0.17 * s, 0),
      new THREE.Vector3(-0.7, 0.02 * s, 0),
      new THREE.Vector3(-1.25, -0.27 * s, 0),
      new THREE.Vector3(-1.62, -0.5 * s, 0),
    ]);
    const shank = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.095, 14, false), chrome);
    shank.position.z = z;
    half.add(shank);

    // Finger ring (slightly oval).
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.09, 20, 64), gun);
    ring.scale.set(1.18, 0.88, 1);
    ring.position.set(-2.08, -0.64 * s, z);
    half.add(ring);

    // Finger tang on the lower half.
    if (s === -1) {
      const tc = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.55, 0.98, 0),
        new THREE.Vector3(-2.95, 1.28, 0),
        new THREE.Vector3(-3.3, 1.2, 0),
        new THREE.Vector3(-3.42, 0.98, 0),
      ]);
      const tang = new THREE.Mesh(new THREE.TubeGeometry(tc, 32, 0.07, 12, false), gun);
      tang.position.z = z;
      half.add(tang);
    }
    root.add(half);
    halves.push({ g: half, s });
  }

  // Pivot screw.
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.24, 40), chrome);
  screw.rotation.x = PI / 2;
  root.add(screw);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.02), gun);
  slot.position.z = 0.125;
  slot.rotation.z = 0.6;
  root.add(slot);

  root.userData.setOpen = (o) => {
    const a = o * 0.36; // radians per half
    for (const h of halves) h.g.rotation.z = h.s * a;
  };
  return root;
}

function makeComb(mat) {
  const root = new THREE.Group();
  const spineShape = new THREE.Shape();
  const L = 3.6, H = 0.36, r = 0.12;
  spineShape.moveTo(-L / 2 + r, 0);
  spineShape.lineTo(L / 2 - r, 0);
  spineShape.quadraticCurveTo(L / 2, 0, L / 2, r);
  spineShape.lineTo(L / 2, H);
  spineShape.lineTo(-L / 2, H);
  spineShape.lineTo(-L / 2, r);
  spineShape.quadraticCurveTo(-L / 2, 0, -L / 2 + r, 0);
  const spineGeo = new THREE.ExtrudeGeometry(spineShape, {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2,
  });
  spineGeo.translate(0, 0, -0.035);
  root.add(new THREE.Mesh(spineGeo, mat));

  // Teeth: fine on one half, wide on the other.
  const xs = [];
  for (let x = -L / 2 + 0.1; x < 0; x += 0.1) xs.push(x);
  for (let x = 0.06; x < L / 2 - 0.05; x += 0.16) xs.push(x);
  const toothGeo = new THREE.BoxGeometry(0.045, 0.62, 0.05);
  toothGeo.translate(0, -0.31 + 0.02, 0);
  const teeth = new THREE.InstancedMesh(toothGeo, mat, xs.length);
  const m = new THREE.Matrix4();
  xs.forEach((x, i) => {
    const tall = x < 0 ? 0.86 : 1;
    m.makeScale(1, tall, 1);
    m.setPosition(x, 0.02, 0);
    teeth.setMatrixAt(i, m);
  });
  root.add(teeth);
  root.children.forEach((c) => (c.position.y -= 0.0));
  return root;
}

function roundedRect(x, y, w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function makeRazor(chrome, ebony, gun) {
  const root = new THREE.Group();

  // Scales (the handle) — two ebony plates.
  const scaleGeo = new THREE.ExtrudeGeometry(roundedRect(-0.3, -0.33, 3.45, 0.66, 0.3), {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 16,
  });
  scaleGeo.translate(0, 0, -0.025);
  for (const z of [0.085, -0.085]) {
    const sc = new THREE.Mesh(scaleGeo, ebony);
    sc.position.z = z;
    root.add(sc);
  }
  for (const x of [0, 2.95]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 20), chrome);
    pin.rotation.x = PI / 2;
    pin.position.x = x;
    root.add(pin);
  }

  // Blade, pivoting on the pin at the origin.
  const bs = new THREE.Shape();
  bs.moveTo(-0.22, 0.12);
  bs.lineTo(0.3, 0.19);
  bs.lineTo(2.7, 0.22);
  bs.quadraticCurveTo(3.08, 0.2, 2.98, -0.2);
  bs.lineTo(2.88, -0.44);
  bs.quadraticCurveTo(1.6, -0.36, 0.42, -0.3);
  bs.lineTo(0.18, -0.12);
  bs.lineTo(-0.22, -0.1);
  bs.lineTo(-0.22, 0.12);
  const bladeGeo = new THREE.ExtrudeGeometry(bs, {
    depth: 0.03, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 3, curveSegments: 24,
  });
  bladeGeo.translate(0, 0, -0.015);
  const blade = new THREE.Mesh(bladeGeo, chrome);
  const pivot = new THREE.Group();
  pivot.add(blade);
  // a thin dark line to suggest the honed edge
  const spine = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.025, 0.05), gun);
  spine.position.set(1.55, 0.2, 0);
  pivot.add(spine);
  root.add(pivot);

  root.userData.setOpen = (o) => {
    pivot.rotation.z = -o * PI * 0.94;
  };
  return root;
}

/* ------------------------------------------------------------ hair bits */

function makeHair(count) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const strands = [];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    strands.push({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), rz: 0, ry: 0, w: 0, len: 0, vr: 0 });
    c.setHSL(0.08, 0.05, rand(0.42, 0.85));
    mesh.setColorAt(i, c);
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, zero);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  let cursor = 0;

  return {
    mesh,
    alive: 0,
    spawn(pos, n, unit) {
      for (let k = 0; k < n; k++) {
        const s = strands[cursor];
        cursor = (cursor + 1) % count;
        s.p.copy(pos).add(new THREE.Vector3(rand(-0.25, 0.25) * unit, rand(-0.05, 0.05) * unit, rand(-0.2, 0.2)));
        s.v.set(rand(-0.6, 0.6) * unit, rand(0.1, 0.9) * unit, rand(-0.3, 0.3));
        s.rz = rand(0, PI * 2);
        s.ry = rand(0, PI);
        s.vr = rand(-5, 5);
        s.len = rand(0.14, 0.34) * unit;
        s.w = 0.016 * unit;
        s.max = s.life = rand(1.3, 2.2);
      }
    },
    update(dt, unit) {
      let alive = 0;
      for (let i = 0; i < count; i++) {
        const s = strands[i];
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) { mesh.setMatrixAt(i, zero); continue; }
        alive++;
        s.v.y -= 2.6 * unit * dt;
        s.v.multiplyScalar(0.986);
        s.p.addScaledVector(s.v, dt);
        s.rz += s.vr * dt;
        s.ry += s.vr * 0.6 * dt;
        const k = Math.min(1, (s.life / s.max) * 2.2);
        e.set(0, s.ry, s.rz);
        q.setFromEuler(e);
        sc.set(s.w * k, s.len * k, 1);
        m.compose(s.p, q, sc);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.alive = alive;
    },
  };
}

/* ----------------------------------------------------------------- stage */

export function createStage(canvas) {
  // Measure the canvas itself (100lvh): stable while a phone's URL bar slides in and out.
  const viewW = () => canvas.clientWidth || innerWidth;
  const viewH = () => canvas.clientHeight || innerHeight;
  const mobile = () => viewW() < 900 || viewW() / viewH() < 0.85;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile() ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-4, 6, 8);
  const rim = new THREE.DirectionalLight(0xff2020, 4.5);
  rim.position.set(6, -3, -5);
  const rim2 = new THREE.DirectionalLight(0xff3a2a, 2.2);
  rim2.position.set(-6, 2, -3);
  scene.add(key, rim, rim2);

  const chrome = new THREE.MeshStandardMaterial({ color: 0xf4f5f7, metalness: 1, roughness: 0.13, envMapIntensity: 1.15 });
  const gun = new THREE.MeshStandardMaterial({ color: 0x2a2a2f, metalness: 1, roughness: 0.28, envMapIntensity: 1 });
  const ebony = new THREE.MeshPhysicalMaterial({
    color: 0x0d0d0e, metalness: 0.15, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.3,
  });

  const steel = new THREE.MeshStandardMaterial({ color: 0xb4b7be, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 });
  const scissors = makeScissors(chrome, gun);
  const comb = makeComb(steel);
  const mirror = new THREE.MeshStandardMaterial({ color: 0xd9dce2, metalness: 1, roughness: 0.07, envMapIntensity: 0.75 });
  const horn = new THREE.MeshPhysicalMaterial({
    color: 0x070707, metalness: 0.1, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.2, envMapIntensity: 0.55,
  });
  const razor = makeRazor(mirror, horn, gun);
  const hair = makeHair(160);
  scene.add(scissors, comb, razor, hair.mesh);
  [scissors, comb, razor].forEach((o) => (o.visible = false));

  /* ---- view metrics ---- */
  let visW = 1, visH = 1, unit = 1;
  let lastW = 0, lastH = 0;
  function resize() {
    const w = viewW(), h = viewH();
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false); // CSS owns the box; only the drawing buffer follows it
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    visH = 2 * camera.position.z * Math.tan((camera.fov * PI) / 360);
    visW = visH * camera.aspect;
    unit = Math.min(visW, visH) / visH; // 1 on landscape, narrower on portrait
    if (mobile()) unit *= 1.25;
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  /* ---- drivers & keyframes ---- */
  const drivers = { hero: () => 0, inter: () => 0, book: () => 0, foot: () => 0 };
  let cutY = 0; // normalized (-1..1) y of the title's cut line
  let introK = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  const heroKeys = () => {
    const m = mobile();
    return [
      { p: 0, x: m ? 0.28 : 0.5, y: m ? 0.42 : 0.07, rx: 0.15, ry: 0.45, rz: PI + 0.6, s: m ? 0.36 : 0.56, open: 0.32, idle: 1, snip: 0 },
      { p: 0.1, x: 0.95, y: cutY, rx: 0, ry: 0.28, rz: PI, s: m ? 0.3 : 0.42, open: 0.35, idle: 0, snip: 1 },
      { p: 0.56, x: -1.6, y: cutY, rx: 0, ry: 0.28, rz: PI, s: m ? 0.3 : 0.42, open: 0.35, idle: 0, snip: 1 },
      { p: 1, x: -1.6, y: cutY, rx: 0, ry: 0.28, rz: PI, s: m ? 0.3 : 0.42, open: 0.35, idle: 0, snip: 1 },
    ];
  };
  const introPose = { x: 0.95, y: -1.6, rx: 1.1, ry: 2.4, rz: PI + 2.2, s: 0.5, open: 0.1, idle: 0, snip: 0 };

  const interScissors = [
    { p: 0, x: 1.5, y: -0.55, rx: 0.3, ry: 1.0, rz: 2.5, s: 0.42, open: 0.3, idle: 1, snip: 0 },
    { p: 0.5, x: 0.3, y: 0.12, rx: 0.1, ry: 0.25, rz: 3.3, s: 0.5, open: 0.3, idle: 1, snip: 0 },
    { p: 1, x: -1.6, y: 0.65, rx: -0.2, ry: -1.6, rz: 4.3, s: 0.42, open: 0.3, idle: 1, snip: 0 },
  ];
  const interComb = [
    { p: 0, x: -1.6, y: 0.6, rx: 0.4, ry: 0.7, rz: -0.5, s: 0.48 },
    { p: 0.5, x: -0.35, y: -0.15, rx: 0.2, ry: -0.3, rz: 0.22, s: 0.55 },
    { p: 1, x: 1.6, y: -0.62, rx: 0, ry: -2.6, rz: 0.9, s: 0.48 },
  ];
  const bookKeys = () => {
    const m = mobile();
    const x = m ? 0 : -0.5, y = 0;
    const s = m ? 0.5 : 0.64;
    return [
      { p: 0, x: x + 0.1, y: -1.2, rx: 0.9, ry: -1.6, rz: 1.3, s: 0.55, open: 0 },
      { p: 0.5, x: x + 0.06, y: y - 0.05, rx: 0.55, ry: -0.75, rz: 0.55, s, open: 0.04 },
      { p: 0.95, x, y, rx: 0.35, ry: -0.55, rz: m ? 0.5 : 0.32, s, open: 1 },
      { p: 1, x, y, rx: 0.35, ry: -0.55, rz: m ? 0.5 : 0.32, s, open: 1 },
    ];
  };

  // Current (damped) poses.
  const cur = {
    sc: { ...introPose, seg: 'intro' },
    cb: { ...interComb[0], seg: 'inter' },
    rz: { ...bookKeys()[0], seg: 'book' },
  };

  function damp(c, t, k, seg) {
    if (c.seg !== seg) { Object.assign(c, t); c.seg = seg; return c; }
    for (const key in t) if (key !== 'seg' && key !== 'p') c[key] = lerp(c[key], t[key], k);
    return c;
  }

  function place(obj, P, extra = {}) {
    const px = P.x + (extra.px || 0), py = P.y + (extra.py || 0);
    obj.position.set((px * visW) / 2, (py * visH) / 2, 0);
    obj.rotation.set(P.rx + (extra.rx || 0), P.ry + (extra.ry || 0), P.rz);
    obj.scale.setScalar(Math.max(P.s * unit, 0.0001));
    obj.visible = P.s > 0.01 && Math.abs(px) < 1.75 && Math.abs(py) < 1.9;
  }

  /* ---- snip & cut tracking ---- */
  let lastSnipIdx = 0;
  const tipLocal = new THREE.Vector3(1.6, 0, 0);
  const cutLocal = new THREE.Vector3(0.7, 0, 0);
  const tmp = new THREE.Vector3();
  const cutInfo = { x: innerWidth, active: 0 };

  let onFrame = null;
  let clock = 0;
  let wasRendering = true;

  function tick(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    clock += dt;
    const k = 1 - Math.exp(-dt * 7.5);

    pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.exp(-dt * 4));
    pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.exp(-dt * 4));

    const hp = drivers.hero(), ip = drivers.inter(), bp = drivers.book(), fp = drivers.foot();

    /* scissors */
    let tSc, seg;
    if (ip > 0 && ip < 1) { tSc = sample(interScissors, ip); seg = 'inter'; }
    else if (ip >= 1) { tSc = { ...interScissors[2] }; seg = 'inter'; }
    else {
      const h = sample(heroKeys(), hp);
      if (introK < 1) {
        const o = {};
        const t = smooth(introK);
        for (const key in h) o[key] = lerp(introPose[key] ?? h[key], h[key], t);
        tSc = o;
      } else tSc = h;
      seg = 'hero';
      if (cur.sc.seg === 'intro') cur.sc.seg = 'hero';
    }
    damp(cur.sc, tSc, seg === 'hero' && hp > 0.08 ? 1 - Math.exp(-dt * 12) : k, seg);

    const P = cur.sc;
    const idleOpen = P.open + P.idle * 0.22 * Math.sin(clock * 2.3);
    const phase = hp * PI * 10;
    const snipOpen = 0.04 + 0.62 * Math.abs(Math.sin(phase));
    scissors.userData.setOpen(lerp(idleOpen, snipOpen, clamp(P.snip)));
    place(scissors, P, {
      py: P.idle * Math.sin(clock * 1.1) * 0.015,
      rx: pointer.sy * 0.22 * P.idle,
      ry: pointer.sx * 0.3 * P.idle,
    });
    scissors.rotation.z += P.idle * Math.sin(clock * 0.7) * 0.04;

    // Hair falls on every closing snip during the cut.
    const snipIdx = Math.floor(phase / PI);
    if (snipIdx !== lastSnipIdx && P.snip > 0.5 && hp > 0.1 && hp < 0.56 && scissors.visible) {
      scissors.updateMatrixWorld();
      tmp.copy(tipLocal);
      scissors.localToWorld(tmp);
      hair.spawn(tmp, 12, unit);
    }
    lastSnipIdx = snipIdx;

    // Where along the screen is the blade's bite? (drives the red cut line)
    scissors.updateMatrixWorld();
    tmp.copy(cutLocal);
    scissors.localToWorld(tmp);
    tmp.project(camera);
    cutInfo.x = ((tmp.x + 1) / 2) * viewW();
    cutInfo.active = hp < 0.1 ? 0 : 1;
    cutInfo.full = hp >= 0.56;

    /* comb */
    const tCb = sample(interComb, clamp(ip));
    damp(cur.cb, tCb, k, 'inter');
    place(comb, cur.cb, { ry: Math.sin(clock * 0.9) * 0.1 });
    comb.visible = comb.visible && ip > 0 && ip < 1;

    /* razor — pinned to the .book__stage box so it scrolls with its section */
    const tRz = sample(bookKeys(), bp);
    const anchor = drivers.bookAnchor ? drivers.bookAnchor() : null;
    if (anchor) {
      // entrance: rise into the box as the section arrives
      tRz.x = anchor.x + (tRz.x - bookKeys()[2].x);
      tRz.y = anchor.y + (tRz.y - bookKeys()[2].y);
    } else tRz.y += fp * 1.9;
    damp(cur.rz, tRz, k, 'book');
    if (anchor && bp > 0.5) { cur.rz.x = tRz.x; cur.rz.y = tRz.y; } // no lag once docked
    razor.userData.setOpen(clamp(cur.rz.open));
    place(razor, cur.rz, {
      py: Math.sin(clock * 1.0) * 0.012,
      rx: pointer.sy * 0.18,
      ry: pointer.sx * 0.35 + Math.sin(clock * 0.5) * 0.08,
    });
    razor.visible = razor.visible && bp > 0.01;

    hair.update(dt, unit);

    const anything = scissors.visible || comb.visible || razor.visible || hair.alive > 0;
    if (anything || wasRendering) renderer.render(scene, camera);
    wasRendering = anything;

    if (onFrame) onFrame(cutInfo);
  }

  return {
    tick,
    setDrivers(d) { Object.assign(drivers, d); },
    setCutY(ny) { cutY = ny; },
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    get height() { return viewH(); },
    onFrame(fn) { onFrame = fn; },
    intro(duration = 1.8) {
      return new Promise((res) => {
        const o = { k: 0 };
        window.gsap.to(o, { k: 1, duration, ease: 'power3.out', onUpdate: () => (introK = o.k), onComplete: res });
      });
    },
    get introDone() { return introK >= 1; },
  };
}
