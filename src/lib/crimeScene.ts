/**
 * Interactive line-art 3D crime scene used on the home page and the 3D
 * reconstruction service. Loaded on demand by CrimeScene3D.astro; named
 * imports keep the three.js bundle tree-shaken.
 *
 * The scene plays a short "reconstruction" timeline (markers appear, the
 * shooter fades in, trajectories are traced) and exposes a small controller
 * so the surrounding HTML can switch camera views, scrub the timeline and
 * highlight evidence.
 */
import {
  BoxGeometry, BufferGeometry, CanvasTexture, CatmullRomCurve3, DoubleSide, EdgesGeometry, Fog, GridHelper, Group,
  Line, LineBasicMaterial, LineDashedMaterial, LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry,
  Raycaster, RingGeometry, Scene, Sprite, SpriteMaterial, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
  type Material,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SCENE_EVIDENCE, type SceneViewId } from '../data/sceneEvidence';

export interface CrimeSceneController {
  duration: number;
  setView(view: SceneViewId): void;
  select(index: number | null): void;
  setTime(t: number): void;
  play(fromStart?: boolean): void;
  pause(): void;
  readonly playing: boolean;
}

interface Options {
  onSelect?: (index: number) => void;
  onTime?: (t: number, playing: boolean) => void;
}

const CYAN = 0x1ba3e0;
const AMBER = 0xf5b70a;
const WHITE = 0xe9f1f7;
const DURATION = 6.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
/** Progress (0..1) of a timeline segment that runs from `a` to `b` seconds. */
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

export function mountCrimeScene(el: HTMLElement, opts: Options = {}): CrimeSceneController | null {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null; // No WebGL: keep the SVG poster and the HTML evidence list.
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  scene.fog = new Fog(0x0a1a2a, 12, 26);
  const camera = new PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(8.5, 6.2, 8.5);

  // Fade-able materials, grouped by the timeline step that reveals them.
  const fade: Record<string, { mat: Material; base: number }[]> = { figure: [], measure: [] };
  const track = (key: string, mat: Material, base: number) => {
    mat.transparent = true;
    fade[key].push({ mat, base });
  };

  const line = (
    pts: number[][],
    color: number,
    o: { opacity?: number; dashed?: boolean; parent?: Group | Scene; group?: string } = {},
  ) => {
    const geo = new BufferGeometry().setFromPoints(pts.map((p) => new Vector3(p[0], p[1], p[2])));
    const opacity = o.opacity ?? 1;
    const mat = o.dashed
      ? new LineDashedMaterial({ color, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity })
      : new LineBasicMaterial({ color, transparent: true, opacity });
    const l = new Line(geo, mat);
    if (o.dashed) l.computeLineDistances();
    (o.parent ?? scene).add(l);
    if (o.group) track(o.group, mat, opacity);
    return l;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, opacity = 0.85) => {
    const edges = new EdgesGeometry(new BoxGeometry(w, h, d));
    const s = new LineSegments(edges, new LineBasicMaterial({ color: CYAN, transparent: true, opacity }));
    s.position.set(x, y + h / 2, z);
    scene.add(s);
    return s;
  };
  const circle = (r: number, segments = 28) =>
    Array.from({ length: segments + 1 }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r, 0];
    });

  const textSprite = (text: string, color: string, bg: string, scale: number) => {
    const font = '700 54px ui-monospace, Menlo, monospace';
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = font;
    const c = document.createElement('canvas');
    c.width = Math.ceil(probe.measureText(text).width + 44);
    c.height = 92;
    const g = c.getContext('2d')!;
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(0, 0, c.width, c.height, 14);
    g.fill();
    g.fillStyle = color;
    g.font = font;
    g.textBaseline = 'middle';
    g.fillText(text, 22, 48);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    // Constant on-screen size, so labels stay readable in close-up views.
    const mat = new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false });
    const s = new Sprite(mat);
    s.scale.set(scale * (c.width / c.height), scale, 1);
    s.renderOrder = 2;
    scene.add(s);
    return s;
  };
  const markerSprite = (n: number) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.shadowColor = 'rgba(0,0,0,.45)';
    g.shadowBlur = 18;
    g.fillStyle = '#f5b70a';
    g.beginPath();
    g.moveTo(128, 16);
    g.lineTo(240, 228);
    g.lineTo(16, 228);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#08131f';
    g.font = '800 104px ui-monospace, Menlo, monospace';
    g.textAlign = 'center';
    g.fillText(String(n), 128, 205);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.renderOrder = 3;
    scene.add(s);
    return s;
  };

  // --- Environment -------------------------------------------------------
  const halo = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(27,163,224,0.32)');
    grad.addColorStop(0.55, 'rgba(27,163,224,0.08)');
    grad.addColorStop(1, 'rgba(27,163,224,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const tex = new CanvasTexture(c);
    const m = new Mesh(new PlaneGeometry(14, 14), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.02;
    scene.add(m);
    return m;
  })();
  void halo;

  const grid = new GridHelper(8, 16, CYAN, CYAN);
  const gridMat = grid.material as Material;
  gridMat.transparent = true;
  gridMat.opacity = 0.18;
  scene.add(grid);
  line([[-4, 0, -4], [4, 0, -4], [4, 0, 4], [-4, 0, 4], [-4, 0, -4]], CYAN, { opacity: 0.65 });
  line([[-4, 0, -4], [-4, 3, -4], [4, 3, -4], [4, 0, -4]], CYAN, { opacity: 0.45 });
  line([[-4, 3, -4], [-4, 3, 4], [-4, 0, 4]], CYAN, { opacity: 0.45 });
  // Door (left wall) and window (back wall).
  line([[-4, 0, 1.15], [-4, 2.1, 1.15], [-4, 2.1, 2.25], [-4, 0, 2.25]], CYAN, { opacity: 0.75 });
  line([[0.6, 1.1, -4], [2.4, 1.1, -4], [2.4, 2.2, -4], [0.6, 2.2, -4], [0.6, 1.1, -4]], CYAN, { opacity: 0.7 });
  line([[1.5, 1.1, -4], [1.5, 2.2, -4]], CYAN, { opacity: 0.4 });

  // Furniture: table, toppled chair, sofa, shelf.
  box(1.8, 0.75, 0.9, 1.6, 0, -2.6);
  const chair = box(0.5, 0.45, 0.5, 0.35, 0, -1.75, 0.7);
  chair.rotation.z = 0.35;
  box(0.9, 0.5, 2.2, -2.9, 0, -2.5, 0.55);
  box(0.4, 1.8, 1.2, 3.75, 0, 1.6, 0.4);

  // Body outline on the floor.
  const bodyPts = [
    [0, 0], [0.18, 0.08], [0.28, 0.3], [0.22, 0.5], [0.45, 0.62], [0.95, 0.95], [0.85, 1.05], [0.35, 0.82],
    [0.3, 1.25], [0.48, 1.95], [0.32, 2.0], [0.12, 1.4], [-0.08, 2.02], [-0.25, 1.98], [-0.18, 1.25],
    [-0.25, 0.8], [-0.7, 1.15], [-0.82, 1.05], [-0.3, 0.6], [-0.24, 0.3], [-0.16, 0.08], [0, 0],
  ];
  const bodyGroup = new Group();
  bodyGroup.rotation.y = 0.5;
  scene.add(bodyGroup);
  line(bodyPts.map(([x, z]) => [x * 1.6 + 0.2, 0.012, z * 1.6 - 1.4]), WHITE, { dashed: true, parent: bodyGroup });
  const headRing = new Mesh(new RingGeometry(0.24, 0.27, 32), new MeshBasicMaterial({ color: WHITE, side: DoubleSide }));
  headRing.rotation.x = -Math.PI / 2;
  headRing.position.set(0.2, 0.014, -1.68);
  bodyGroup.add(headRing);

  // Standing figure (shooter) at the doorway, revealed by the timeline.
  const origin = new Vector3(-3.35, 0, 1.7);
  const impactPoint = new Vector3(3.1, 1.6, -3.99);
  const figure = new Group();
  figure.position.copy(origin);
  figure.rotation.y = Math.atan2(-(impactPoint.z - origin.z), impactPoint.x - origin.x);
  scene.add(figure);
  const fig = (pts: number[][]) => line(pts, CYAN, { parent: figure, group: 'figure', opacity: 0.95 });
  fig([[-0.05, 0, 0.14], [0, 0.95, 0.08], [0, 0.95, -0.08], [0.06, 0, -0.16]]); // legs
  fig([[0, 0.95, 0], [0, 1.42, 0]]); // torso
  fig([[0, 1.4, 0.18], [0, 1.4, -0.18]]); // shoulders
  fig([[0, 1.4, 0.18], [0.5, 1.42, 0.04], [0.62, 1.43, 0]]); // right arm
  fig([[0, 1.4, -0.18], [0.5, 1.42, -0.04], [0.62, 1.43, 0]]); // left arm
  fig([[0.62, 1.43, 0], [0.82, 1.45, 0]]); // weapon
  const headA = fig(circle(0.13).map(([x, y]) => [x, y + 1.6, 0]));
  const headB = fig(circle(0.13).map(([x, y]) => [0, y + 1.6, x]));
  void headA; void headB;
  // Field-of-view cone of the figure, faint.
  line([[0.2, 1.6, 0], [6, 1.2, 1.4]], CYAN, { parent: figure, group: 'figure', opacity: 0.18 });
  line([[0.2, 1.6, 0], [6, 1.2, -1.4]], CYAN, { parent: figure, group: 'figure', opacity: 0.18 });

  // Crime-scene tape.
  const tape = [[-2.6, -3.3], [3.3, -3.3], [3.3, 3.3], [-2.6, 3.3]];
  tape.forEach(([x, z]) => line([[x, 0, z], [x, 1, z]], AMBER, { opacity: 0.9 }));
  line([...tape, tape[0]].map(([x, z]) => [x, 0.95, z]), AMBER, { opacity: 0.8 });

  // Trajectories.
  const muzzle = new Vector3(-3.35 + 0.82 * Math.cos(figure.rotation.y), 1.45, 1.7 - 0.82 * Math.sin(figure.rotation.y));
  const trajectories = [
    [muzzle, new Vector3(0.1, 1.55, -0.95), impactPoint],
    [muzzle.clone().add(new Vector3(0, 0.02, 0)), new Vector3(0.05, 1.15, -0.35)],
  ].map((pts) => {
    const curve = new CatmullRomCurve3(pts);
    const geo = new BufferGeometry().setFromPoints(curve.getPoints(90));
    const l = new Line(geo, new LineDashedMaterial({ color: AMBER, dashSize: 0.22, gapSize: 0.12 }));
    l.computeLineDistances();
    geo.setDrawRange(0, 0);
    scene.add(l);
    return l;
  });
  const impact = new Mesh(new RingGeometry(0.08, 0.13, 28), new MeshBasicMaterial({ color: AMBER, side: DoubleSide, transparent: true }));
  impact.position.copy(impactPoint);
  scene.add(impact);

  // Evidence markers (clickable) and the floor ring of the selected one.
  const markers = SCENE_EVIDENCE.map((ev) => {
    const s = markerSprite(ev.n);
    s.position.set(ev.pos[0], 0.32, ev.pos[1]);
    s.userData.index = ev.n - 1;
    return s;
  });
  const selRing = new Mesh(new RingGeometry(0.34, 0.4, 40), new MeshBasicMaterial({ color: AMBER, side: DoubleSide, transparent: true }));
  selRing.rotation.x = -Math.PI / 2;
  selRing.visible = false;
  scene.add(selRing);
  let selected: number | null = null;

  // Measurement between evidence 3 and 5 (real distance in the model).
  const e1 = SCENE_EVIDENCE[2].pos;
  const e3 = SCENE_EVIDENCE[4].pos;
  const dist = Math.hypot(e1[0] - e3[0], e1[1] - e3[1]).toFixed(2).replace('.', ',');
  line([[e1[0], 0.03, e1[1]], [e3[0], 0.03, e3[1]]], WHITE, { group: 'measure', opacity: 0.7 });
  const measureLabel = textSprite(`${dist} m`, '#e9f1f7', 'rgba(8,19,31,.9)', 0.042);
  measureLabel.position.set((e1[0] + e3[0]) / 2, 0.42, (e1[1] + e3[1]) / 2);
  track('measure', measureLabel.material, 1);
  const impactLabel = textSprite('IMPACTO', '#08131f', '#f5b70a', 0.036);
  impactLabel.position.set(impactPoint.x, 2.05, impactPoint.z + 0.1);
  track('measure', impactLabel.material, 1);
  const originLabel = textSprite('ORIGEN', '#08131f', '#1ba3e0', 0.036);
  originLabel.position.set(origin.x, 2.1, origin.z);
  track('figure', originLabel.material, 1);

  // --- Timeline & render-loop state (declared before anything calls wake()) --
  let t = reduceMotion ? DURATION : 0;
  let playing = !reduceMotion;
  let last = performance.now();
  let visible = true;
  let raf = 0;
  let ready = false; // wake() is a no-op until the render loop below exists

  // --- Camera & controls ---------------------------------------------------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.6;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = 1.35;
  controls.target.set(0, 0.6, 0);
  renderer.domElement.style.touchAction = 'pan-y';

  const orbitDistance = () => (el.clientWidth < 520 ? 13 : 11.5);
  const VIEWS: Record<SceneViewId, () => { pos: Vector3; target: Vector3 }> = {
    orbital: () => ({ pos: new Vector3(8.5, 6.2, 8.5).setLength(orbitDistance()), target: new Vector3(0, 0.6, 0) }),
    cenital: () => ({ pos: new Vector3(0.01, el.clientWidth < 520 ? 15 : 12.5, 0.6), target: new Vector3(0, 0, 0) }),
    testigo: () => ({ pos: new Vector3(-3.75, 1.65, 3.6), target: new Vector3(0.6, 0.8, -1.2) }),
    trayectoria: () => ({ pos: new Vector3(-6.4, 2.4, 4.3), target: new Vector3(1.8, 1.2, -2.6) }),
  };
  let view: SceneViewId = 'orbital';
  let tween: { from: Vector3; to: Vector3; tFrom: Vector3; tTo: Vector3; start: number } | null = null;
  const setView = (v: SceneViewId) => {
    view = v;
    const { pos, target } = VIEWS[v]();
    controls.autoRotate = v === 'orbital' && !reduceMotion;
    if (reduceMotion) {
      camera.position.copy(pos);
      controls.target.copy(target);
    } else {
      tween = { from: camera.position.clone(), to: pos, tFrom: controls.target.clone(), tTo: target, start: performance.now() };
    }
    wake();
  };
  controls.addEventListener('start', () => {
    tween = null;
    controls.autoRotate = false;
  });

  const resize = () => {
    const { width, height } = el.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    wake();
  };
  camera.position.copy(VIEWS.orbital().pos);
  resize();
  new ResizeObserver(resize).observe(el);

  // --- Picking -----------------------------------------------------------
  const ray = new Raycaster();
  const ndc = new Vector2();
  const pick = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(markers.filter((m) => m.visible), false)[0];
    return hit ? (hit.object.userData.index as number) : null;
  };
  let down: { x: number; y: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const i = pick(e);
    if (i !== null) opts.onSelect?.(i);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    renderer.domElement.style.cursor = pick(e) !== null ? 'pointer' : 'grab';
  });

  el.appendChild(renderer.domElement);
  el.classList.add('is-live');

  // --- Timeline & render loop -------------------------------------------

  const applyTime = (time: number) => {
    markers.forEach((m, i) => {
      const p = ease(seg(time, 0.4 + i * 0.32, 0.75 + i * 0.32));
      m.visible = p > 0.01;
      const s = 0.58 * p * (selected === i ? 1.3 : 1);
      m.scale.set(s, s, 1);
    });
    const fig = seg(time, 2.1, 2.8);
    fade.figure.forEach(({ mat, base }) => (mat.opacity = base * fig));
    trajectories.forEach((tr, i) => {
      const n = tr.geometry.attributes.position.count;
      tr.geometry.setDrawRange(0, Math.floor(n * ease(seg(time, 2.9 + i * 0.45, 4.2 + i * 0.45))));
    });
    (impact.material as Material).opacity = seg(time, 4.1, 4.3);
    const meas = seg(time, 4.7, 5.3);
    fade.measure.forEach(({ mat, base }) => (mat.opacity = base * meas));
  };

  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      t += dt;
      if (t >= DURATION) {
        t = DURATION;
        playing = false;
      }
      opts.onTime?.(t, playing);
    }
    applyTime(t);
    if (tween) {
      const p = ease(clamp01((now - tween.start) / 1100));
      camera.position.lerpVectors(tween.from, tween.to, p);
      controls.target.lerpVectors(tween.tFrom, tween.tTo, p);
      if (p >= 1) tween = null;
    }
    if (selected !== null) {
      const pulse = 1 + Math.sin(now / 260) * 0.08;
      selRing.scale.set(pulse, pulse, 1);
    }
    impact.scale.setScalar(1 + (reduceMotion ? 0 : Math.sin(now / 330) * 0.15));
    controls.update();
    renderer.render(scene, camera);
    raf = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
  };
  function wake() {
    if (ready && !raf && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    wake();
  }).observe(el);
  document.addEventListener('visibilitychange', wake);
  ready = true;
  wake();

  return {
    duration: DURATION,
    get playing() {
      return playing;
    },
    setView,
    select(i) {
      selected = i;
      selRing.visible = i !== null;
      if (i !== null) {
        const [x, z] = SCENE_EVIDENCE[i].pos;
        selRing.position.set(x, 0.02, z);
        if (t < DURATION) {
          t = DURATION; // make sure every marker is visible
          playing = false;
          opts.onTime?.(t, playing);
        }
      }
      wake();
    },
    setTime(time) {
      t = Math.min(DURATION, Math.max(0, time));
      playing = false;
      wake();
    },
    play(fromStart = false) {
      if (fromStart || t >= DURATION) t = 0;
      playing = true;
      wake();
    },
    pause() {
      playing = false;
    },
  };
}
