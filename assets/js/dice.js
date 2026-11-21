/* ==========================================================================
   RISK — four letter dice that tumble into place on scroll.
   Dark resin cubes, bone letters, an ink outline (inverted hull) so they
   read like blackwork linework.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

const PI = Math.PI;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
function easeOutBounce(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

/** Settle with a small rebound so the quarter-turn lands with weight. */
function easeOutBounceSoft(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = 1.15;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

/** Phase 1 — each die falls and lands showing RISK. */
export const landAt = (p, i) => clamp((p - i * 0.06) / 0.36);
/** Phase 2 — each die rolls a quarter turn to show RICH. */
export const rollAt = (p, i) => clamp((p - 0.6 - i * 0.07) / 0.17);

function faceTexture(letter, { strong = false, rotate = 0 } = {}) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#141312';
  x.fillRect(0, 0, S, S);
  // worn speckle
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(233,228,218,${Math.random() * 0.05})`;
    x.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  }
  // inner bevel line
  x.strokeStyle = 'rgba(233,228,218,0.10)';
  x.lineWidth = 3;
  x.beginPath();
  x.roundRect(22, 22, S - 44, S - 44, 26);
  x.stroke();
  if (letter) {
    x.save();
    x.translate(S / 2, S / 2);
    x.rotate(rotate);
    x.fillStyle = strong ? '#ece7dd' : 'rgba(233,228,218,0.34)';
    x.font = `700 ${strong ? 176 : 150}px "Courier Prime", "Courier New", monospace`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(letter, 0, 10);
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shadowTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export async function createDice(canvas) {
  try { await document.fonts.load('700 120px "Courier Prime"'); } catch (e) { /* fallback font */ }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const camBase = new THREE.Vector3(0, 5.9, 7.3);
  const camRest = camBase.clone();
  camera.position.copy(camBase);
  camera.lookAt(0, 0.3, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x220808, 0.7));
  const key = new THREE.DirectionalLight(0xfff4e8, 2.6);
  key.position.set(-3, 7, 4);
  const rim = new THREE.DirectionalLight(0xff2020, 3.2);
  rim.position.set(4, 2, -6);
  scene.add(key, rim);

  const geo = new RoundedBoxGeometry(1, 1, 1, 5, 0.14);
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xe9e4da, side: THREE.BackSide });
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });

  // Top faces read RISK. The faces that roll up next read RICH (R and I repeat,
  // S becomes C, K becomes H) — exactly like the tattoo.
  const top = ['R', 'I', 'S', 'K'];
  const next = ['R', 'I', 'C', 'H'];
  const sides = ['A', 'N', 'E', 'D', 'O', 'L', 'U', 'T', 'Y', 'M', 'W', 'P'];
  // ascending diagonal, R nearest — as on the arm (photo turned the right way up)
  const finals = [
    { x: -2.0, z: 0.8, yaw: -0.16 },
    { x: -0.67, z: 0.38, yaw: 0.1 },
    { x: 0.67, z: -0.04, yaw: -0.07 },
    { x: 2.0, z: -0.46, yaw: 0.18 },
  ];

  const dice = top.map((L, i) => {
    const m = (letter, opt) => new THREE.MeshStandardMaterial({ map: faceTexture(letter, opt), roughness: 0.5, metalness: 0.1 });
    // BoxGeometry groups: +x, -x, +y, -y, +z, -z
    const mats = [
      m(sides[(i * 3) % sides.length]),
      m(sides[(i * 3 + 1) % sides.length]),
      m(L, { strong: true }),
      m(sides[(i * 3 + 2) % sides.length]),
      m(next[i], { strong: true }),
      m(''),
    ];
    const mesh = new THREE.Mesh(geo, mats);
    mesh.rotation.order = 'YXZ'; // roll about the die's own x axis, then yaw
    const hull = new THREE.Mesh(geo, outlineMat);
    hull.scale.setScalar(1.06);
    mesh.add(hull);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), shadowMat.clone());
    shadow.rotation.x = -PI / 2;
    shadow.position.y = 0.001;
    scene.add(mesh, shadow);
    const f = finals[i];
    return {
      mesh, shadow, f,
      start: {
        x: f.x + (Math.random() - 0.5) * 2.2,
        y: 5.5 + i * 0.9,
        z: f.z - 2.5,
        sx: (2 + Math.floor(Math.random() * 2)) * PI * (Math.random() < 0.5 ? -1 : 1) + (Math.random() - 0.5),
        sy: (Math.random() - 0.5) * 3,
        sz: (1 + Math.floor(Math.random() * 2)) * PI * (Math.random() < 0.5 ? -1 : 1),
      },
    };
  });

  let progress = 0;
  let focusZ = 0.17;
  function layout() {
    let rollSum = 0;
    dice.forEach((d, i) => {
      const local = landAt(progress, i);
      const ey = easeOutBounce(local);
      const ec = easeOutCubic(local);
      const { mesh, shadow, f, start } = d;

      // Phase 2: tip over the back-bottom edge, a quarter turn → the RICH face comes up.
      const r = rollAt(progress, i);
      rollSum += r;
      const th = -(PI / 2) * easeOutBounceSoft(r);
      const ly = 0.5 * Math.cos(th) - 0.5 * Math.sin(th) - 0.5;
      const lz = 0.5 * Math.sin(th) + 0.5 * Math.cos(th) - 0.5;

      mesh.position.set(
        lerp(start.x, f.x, ec) + lz * Math.sin(f.yaw),
        lerp(start.y, 0.5, ey) + ly,
        lerp(start.z, f.z, ec) + lz * Math.cos(f.yaw),
      );
      mesh.rotation.set((1 - ec) * start.sx + th, f.yaw + (1 - ec) * start.sy, (1 - ec) * start.sz);
      const h = mesh.position.y - 0.5;
      shadow.position.x = mesh.position.x;
      shadow.position.z = mesh.position.z;
      shadow.scale.setScalar(1 + h * 0.25);
      shadow.material.opacity = clamp(0.75 - h * 0.14) * clamp(local * 4);
      mesh.visible = local > 0;
    });
    focusZ = 0.17 - rollSum / dice.length;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep all four dice in frame on narrow screens
    camRest.copy(camBase).multiplyScalar(Math.max(1, 1.18 / (w / h)));
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let inView = false;
  new IntersectionObserver(([e]) => (inView = e.isIntersecting), { rootMargin: '100px' }).observe(canvas);

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  canvas.parentElement.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  });
  canvas.parentElement.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });

  let dirty = true;
  resize();
  layout();

  return {
    setProgress(p) { if (p !== progress) { progress = p; dirty = true; } },
    tick() {
      if (!inView) return;
      pointer.sx = lerp(pointer.sx, pointer.x, 0.06);
      pointer.sy = lerp(pointer.sy, pointer.y, 0.06);
      const moving = Math.abs(pointer.sx - pointer.x) > 0.001 || Math.abs(pointer.sy - pointer.y) > 0.001;
      if (!dirty && !moving) return;
      layout();
      camera.position.set(camRest.x + pointer.sx * 0.9, camRest.y - pointer.sy * 0.5, camRest.z + focusZ);
      camera.lookAt(0, 0.3, focusZ);
      renderer.render(scene, camera);
      dirty = false;
    },
  };
}
