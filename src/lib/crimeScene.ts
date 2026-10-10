/**
 * Line-art 3D crime scene used on the home page and the 3D reconstruction
 * service. Loaded on demand by CrimeScene3D.astro; named imports keep the
 * three.js bundle tree-shaken.
 */
import {
  BoxGeometry, BufferGeometry, CanvasTexture, CatmullRomCurve3, DoubleSide, EdgesGeometry, Fog, GridHelper,
  Line, LineBasicMaterial, LineDashedMaterial, LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera,
  RingGeometry, Scene, Sprite, SpriteMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function mountCrimeScene(el: HTMLElement) {
  const CYAN = 0x1ba3e0;
  const AMBER = 0xf5b70a;
  const WHITE = 0xe9f1f7;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return; // No WebGL: keep the SVG poster.
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  scene.fog = new Fog(0x08131f, 11, 22);
  const camera = new PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(8.5, 6.2, 8.5);

  const line = (pts: number[][], color: number, opts: { opacity?: number; dashed?: boolean } = {}) => {
    const geo = new BufferGeometry().setFromPoints(pts.map((p) => new Vector3(p[0], p[1], p[2])));
    const mat = opts.dashed
      ? new LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: opts.opacity ?? 1 })
      : new LineBasicMaterial({ color, transparent: true, opacity: opts.opacity ?? 1 });
    const l = new Line(geo, mat);
    if (opts.dashed) l.computeLineDistances();
    scene.add(l);
    return l;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color = CYAN, opacity = 0.9) => {
    const edges = new EdgesGeometry(new BoxGeometry(w, h, d));
    const seg = new LineSegments(edges, new LineBasicMaterial({ color, transparent: true, opacity }));
    seg.position.set(x, y + h / 2, z);
    scene.add(seg);
    return seg;
  };
  const label = (text: string, color: string, bg: string, x: number, y: number, z: number, scale = 0.55, triangle = false) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = bg;
    if (triangle) {
      g.beginPath(); g.moveTo(128, 18); g.lineTo(238, 230); g.lineTo(18, 230); g.closePath(); g.fill();
      g.fillStyle = color; g.font = '800 104px ui-monospace, monospace'; g.textAlign = 'center'; g.fillText(text, 128, 205);
    } else {
      g.font = '700 54px ui-monospace, monospace';
      const w = g.measureText(text).width + 40;
      c.height = 90; c.width = Math.ceil(w);
      const g2 = c.getContext('2d')!;
      g2.fillStyle = bg; g2.fillRect(0, 0, c.width, c.height);
      g2.fillStyle = color; g2.font = '700 54px ui-monospace, monospace'; g2.textBaseline = 'middle'; g2.fillText(text, 20, 47);
    }
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.position.set(x, y, z);
    s.scale.set(scale * (c.width / c.height), scale, 1);
    scene.add(s);
    return s;
  };

  // Floor grid and room shell (open "dollhouse" walls).
  const grid = new GridHelper(8, 16, CYAN, CYAN);
  const gridMat = grid.material as { transparent: boolean; opacity: number };
  gridMat.transparent = true;
  gridMat.opacity = 0.16;
  scene.add(grid);
  line([[-4, 0, -4], [4, 0, -4], [4, 0, 4], [-4, 0, 4], [-4, 0, -4]], CYAN, { opacity: 0.6 });
  line([[-4, 0, -4], [-4, 3, -4], [4, 3, -4], [4, 0, -4]], CYAN, { opacity: 0.45 });
  line([[-4, 3, -4], [-4, 3, 4], [-4, 0, 4]], CYAN, { opacity: 0.45 });
  // Door on the left wall and a window on the back wall.
  line([[-4, 0, 1.2], [-4, 2.1, 1.2], [-4, 2.1, 2.2], [-4, 0, 2.2]], CYAN, { opacity: 0.7 });
  line([[0.6, 1.1, -4], [2.4, 1.1, -4], [2.4, 2.2, -4], [0.6, 2.2, -4], [0.6, 1.1, -4]], CYAN, { opacity: 0.7 });

  // Furniture.
  box(1.8, 0.75, 0.9, 1.6, 0, -2.6);
  box(0.5, 0.45, 0.5, 0.4, 0, -1.7, CYAN, 0.7);
  line([[0.15, 0.45, -1.95], [0.15, 1.05, -1.95], [0.65, 1.05, -1.95], [0.65, 0.45, -1.95]], CYAN, { opacity: 0.7 });
  box(0.9, 0.5, 2.2, -2.9, 0, -2.6, CYAN, 0.55);

  // Body outline on the floor.
  const body = [
    [0, 0], [0.18, 0.08], [0.28, 0.3], [0.22, 0.5], [0.45, 0.62], [0.95, 0.95], [0.85, 1.05], [0.35, 0.82],
    [0.3, 1.25], [0.48, 1.95], [0.32, 2.0], [0.12, 1.4], [-0.08, 2.02], [-0.25, 1.98], [-0.18, 1.25],
    [-0.25, 0.8], [-0.7, 1.15], [-0.82, 1.05], [-0.3, 0.6], [-0.24, 0.3], [-0.16, 0.08], [0, 0],
  ];
  const bodyLine = line(body.map(([x, z]) => [x * 1.6 + 0.2, 0.01, z * 1.6 - 1.4]), WHITE, { dashed: true });
  bodyLine.rotation.y = 0.5;
  // Head ring, placed just above the neck in the outline's rotated frame.
  const head = new Mesh(
    new RingGeometry(0.24, 0.27, 32),
    new MeshBasicMaterial({ color: WHITE, side: DoubleSide }),
  );
  head.rotation.x = -Math.PI / 2;
  const neck = new Vector3(0.2, 0.012, -1.68).applyAxisAngle(new Vector3(0, 1, 0), bodyLine.rotation.y);
  head.position.copy(neck);
  scene.add(head);

  // Evidence markers.
  const markers = [
    [1.6, -0.2], [-1.1, 0.6], [2.3, 1.5], [-0.6, -1.4], [1.0, 2.6],
  ];
  markers.forEach(([x, z], i) => label(String(i + 1), '#08131f', '#f5b70a', x, 0.3, z, 0.58, true));

  // Crime-scene tape posts and tape.
  const tape = [[-2.4, -3.2], [3.2, -3.2], [3.2, 3.3], [-2.4, 3.3]];
  tape.forEach(([x, z]) => line([[x, 0, z], [x, 1, z]], AMBER, { opacity: 0.9 }));
  line([...tape, tape[0]].map(([x, z]) => [x, 0.95, z]), AMBER, { opacity: 0.85 });

  // Ballistic trajectories, drawn progressively.
  const trajSrc: number[][][] = [
    [[-4, 1.45, 1.7], [0.2, 0.9, -0.4], [3.1, 1.6, -4]],
    [[-4, 1.5, 1.6], [4, 1.25, -1.2]],
  ];
  const trajectories = trajSrc.map((pts) => {
    const curve = new CatmullRomCurve3(pts.map((p) => new Vector3(p[0], p[1], p[2])));
    const geo = new BufferGeometry().setFromPoints(curve.getPoints(80));
    const l = new Line(geo, new LineDashedMaterial({ color: AMBER, dashSize: 0.22, gapSize: 0.12 }));
    l.computeLineDistances();
    geo.setDrawRange(0, 0);
    scene.add(l);
    return l;
  });
  const impact = new Mesh(new RingGeometry(0.08, 0.12, 24), new MeshBasicMaterial({ color: AMBER, side: DoubleSide }));
  impact.position.set(3.1, 1.6, -3.99);
  scene.add(impact);

  // Measurement between markers 1 and 2.
  line([[1.6, 0.02, -0.2], [-1.1, 0.02, 0.6]], WHITE, { opacity: 0.55 });
  label('2,82 m', '#e9f1f7', 'rgba(8,19,31,.85)', 0.25, 0.35, 0.2, 0.3);
  label('IMPACTO', '#08131f', '#f5b70a', 3.1, 2.0, -3.9, 0.26);
  label('ORIGEN', '#08131f', '#1ba3e0', -3.9, 2.0, 1.7, 0.26);

  // Controls: slow auto-orbit, drag to rotate, no zoom/pan.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.7;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.25;
  controls.target.set(0, 0.6, 0);
  renderer.domElement.style.touchAction = 'pan-y';

  const resize = () => {
    const { width, height } = el.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.position.setLength(width < 520 ? 13 : 11.5);
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(el);

  el.appendChild(renderer.domElement);
  el.classList.add('is-live');

  const start = performance.now();
  let visible = true;
  let raf = 0;
  const tick = (now: number) => {
    const t = (now - start) / 1000;
    trajectories.forEach((tr, i) => {
      const n = tr.geometry.attributes.position.count;
      const p = reduceMotion ? 1 : Math.min(1, Math.max(0, (t - 0.6 - i * 1.4) / 1.6));
      tr.geometry.setDrawRange(0, Math.floor(n * p));
    });
    impact.scale.setScalar(1 + (reduceMotion ? 0 : Math.sin(t * 3) * 0.15));
    controls.update();
    renderer.render(scene, camera);
    raf = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
  };
  const play = () => { if (!raf) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) play(); }).observe(el);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) play(); });
  play();
}
