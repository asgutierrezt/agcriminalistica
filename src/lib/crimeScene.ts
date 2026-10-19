/**
 * Interactive 3D crime-scene reconstruction used on the home page and the 3D
 * reconstruction service. Loaded on demand by CrimeScene3D.astro; named
 * imports keep the three.js bundle tree-shaken.
 *
 * Visual style: a "clay render" like professional forensic animations, made
 * more photographic with image-based lighting, procedural textures (tiles,
 * plaster, wood grain, fabric), baked contact shadows, forensic floodlights
 * with light beams and floating dust. Full-body mannequins (victim on the
 * floor, shooter at the doorway), evidence tents with photo scales, red
 * trajectory rods and physical traces (casing, blood, shoe prints, phone,
 * bullet hole). A luminol mode reveals cleaned-up blood traces.
 * All textures are drawn on canvases from a fixed seed: no image downloads,
 * and every load looks the same (the static posters match the first frame).
 *
 * The scene plays a short timeline (markers appear, the shooter fades in,
 * trajectories are traced) and exposes a small controller so the HTML around
 * it can switch camera views, scrub the timeline and highlight evidence.
 *
 * In "tour" mode (home page, "Recorre la escena") the page scroll drives a
 * guided camera path instead: from outside the police cordon, through the
 * inspection and the overhead plan, to the reconstructed trajectories.
 */
import {
  ACESFilmicToneMapping, AdditiveBlending, BoxGeometry, BufferGeometry, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, CircleGeometry,
  Color, CylinderGeometry, DirectionalLight, DoubleSide, Fog, Group, HemisphereLight, Line, LineBasicMaterial, Mesh,
  BufferAttribute, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PCFSoftShadowMap,
  PerspectiveCamera, PlaneGeometry, PMREMGenerator, Points, PointsMaterial, Raycaster, RepeatWrapping, RingGeometry,
  Scene, SphereGeometry, Spherical, SpotLight, Sprite, SpriteMaterial, SRGBColorSpace, TubeGeometry, Vector2, Vector3,
  WebGLRenderer, type Material,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SCENE_EVIDENCE, type SceneViewId } from '../data/sceneEvidence';
import { loadFigure, scanWave, withScanWave } from './figures';

export interface CrimeSceneController {
  duration: number;
  setView(view: SceneViewId): void;
  select(index: number | null): void;
  setTime(t: number): void;
  /** Forensic luminol: lights go down and hidden blood traces glow blue. */
  setLuminol(on: boolean): void;
  play(fromStart?: boolean): void;
  pause(): void;
  /** Tour mode: move along the guided path, 0 = outside the cordon, 1 = case closed. */
  scrub(progress: number): void;
  readonly playing: boolean;
}

interface Options {
  onSelect?: (index: number) => void;
  onTime?: (t: number, playing: boolean) => void;
  /** Play the build-up animation on load. Off: start on the finished scene (matches its poster). */
  intro?: boolean;
  /** Guided tour driven by scrub(): no orbiting, camera follows a fixed path. */
  tour?: boolean;
}

const DURATION = 6.5;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

// --- Materials ---------------------------------------------------------------
const mat = (color: number, roughness = 0.85, metalness = 0) => new MeshStandardMaterial({ color, roughness, metalness });

// Deterministic pseudo-random numbers, so procedural textures never change.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // CPU-backed: the forensic-scan sampler reads these pixels back (fast with this hint).
  return { c, g: c.getContext('2d', { willReadFrequently: true })! };
}

function tex(c: HTMLCanvasElement, repeat?: [number, number], color = true) {
  const t = new CanvasTexture(c);
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(...repeat);
  }
  if (color) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Fine speckle noise over the whole canvas. */
function speckle(g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, n: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * rand()})`;
    g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }
}

/** Ceramic floor: 4×4 tiles per texture (0.5 m each) with tone variation, grout and wear. */
function floorTextures() {
  const rand = rng(7);
  const { c, g } = canvas(512);
  const { c: rc, g: rg } = canvas(512);
  rg.fillStyle = '#5a5a5a';
  rg.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const l = 74 + rand() * 6;
      g.fillStyle = `hsl(210 6% ${l}%)`;
      g.fillRect(i * 128, j * 128, 128, 128);
      // Soft marbling inside each tile.
      for (let k = 0; k < 5; k++) {
        const gr = g.createRadialGradient(i * 128 + rand() * 128, j * 128 + rand() * 128, 0, i * 128 + 64, j * 128 + 64, 90);
        gr.addColorStop(0, `rgba(255,255,255,${0.05 + rand() * 0.06})`);
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(i * 128, j * 128, 128, 128);
      }
      const r = Math.round(70 + rand() * 40);
      rg.fillStyle = `rgb(${r},${r},${r})`;
      rg.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
    }
  speckle(g, 512, 512, rand, 9000, 0.06);
  g.strokeStyle = 'rgba(70,74,80,0.55)';
  rg.strokeStyle = '#e6e6e6';
  for (const ctx of [g, rg]) {
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) {
      ctx.moveTo(k * 128, 0); ctx.lineTo(k * 128, 512);
      ctx.moveTo(0, k * 128); ctx.lineTo(512, k * 128);
    }
    ctx.stroke();
  }
  return { map: tex(c, [4, 4]), roughnessMap: tex(rc, [4, 4], false) };
}

/** Painted plaster with faint dirt towards the floor (texture spans the wall height). */
function plasterTexture() {
  const rand = rng(11);
  const { c, g } = canvas(256);
  g.fillStyle = '#e3e5e8';
  g.fillRect(0, 0, 256, 256);
  speckle(g, 256, 256, rand, 5000, 0.05);
  for (let i = 0; i < 26; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const gr = g.createRadialGradient(x, y, 0, x, y, 20 + rand() * 50);
    gr.addColorStop(0, `rgba(120,110,95,${0.03 + rand() * 0.03})`);
    gr.addColorStop(1, 'rgba(120,110,95,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  }
  return tex(c, [2, 1]);
}

function woodTexture(base: string, seed: number) {
  const rand = rng(seed);
  const { c, g } = canvas(256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const y = rand() * 256;
    g.strokeStyle = `rgba(${rand() < 0.5 ? '40,24,10' : '255,230,200'},${0.05 + rand() * 0.1})`;
    g.lineWidth = 0.6 + rand() * 2.2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x / 40 + i) * 3 + (rand() - 0.5) * 2);
    g.stroke();
  }
  speckle(g, 256, 256, rand, 1500, 0.05);
  return tex(c, [1, 1]);
}

function fabricTexture(base: string, seed: number) {
  const rand = rng(seed);
  const { c, g } = canvas(128);
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) {
    g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.05})`;
    g.fillRect(0, y, 128, 1);
  }
  for (let x = 0; x < 128; x += 2) {
    g.fillStyle = `rgba(255,255,255,${0.02 + rand() * 0.04})`;
    g.fillRect(x, 0, 1, 128);
  }
  return tex(c, [3, 3]);
}

function rugTexture() {
  const rand = rng(23);
  const { c, g } = canvas(512, 340);
  g.fillStyle = '#7d4b3a';
  g.fillRect(0, 0, 512, 340);
  g.strokeStyle = '#d8c29a';
  g.lineWidth = 10;
  g.strokeRect(22, 22, 468, 296);
  g.strokeStyle = '#2f3d52';
  g.lineWidth = 6;
  g.strokeRect(44, 44, 424, 252);
  g.fillStyle = 'rgba(216,194,154,0.55)';
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 4; j++) {
      g.save();
      g.translate(96 + i * 54, 100 + j * 46);
      g.rotate(Math.PI / 4);
      g.fillRect(-9, -9, 18, 18);
      g.restore();
    }
  speckle(g, 512, 340, rand, 14000, 0.12);
  return tex(c);
}

/** Irregular stain (blood pool, luminol smear): overlapping soft blobs, color + alpha. */
function stainTexture(seed: number, color: string, blobs = 22) {
  const rand = rng(seed);
  const { c, g } = canvas(256);
  g.translate(128, 128);
  for (let i = 0; i < blobs; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 58;
    const r = 18 + rand() * 40;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(0.7, color);
    gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Satellite droplets.
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const d = 80 + rand() * 40;
    g.fillStyle = color;
    g.beginPath();
    g.arc(Math.cos(a) * d, Math.sin(a) * d, 1.5 + rand() * 3.5, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}

/** Soft dark blob used as baked contact shadow (ambient occlusion) under objects. */
function shadowTexture() {
  const { c, g } = canvas(128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return tex(c, undefined, false);
}

/** Gradient along a strip (wall/floor corner occlusion, light beams). */
function fadeTexture(stops: [number, string][], vertical = true) {
  const { c, g } = canvas(vertical ? 4 : 256, vertical ? 256 : 4);
  const gr = vertical ? g.createLinearGradient(0, 0, 0, 256) : g.createLinearGradient(0, 0, 256, 0);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, c.width, c.height);
  return tex(c, undefined, false);
}

/** Forensic photo scale (ABFO-style ruler): white with black centimetre ticks. */
function scaleTexture() {
  const { c, g } = canvas(256, 32);
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#111';
  for (let i = 0; i <= 50; i++) {
    const h = i % 10 === 0 ? 18 : i % 5 === 0 ? 12 : 7;
    g.fillRect(4 + i * 4.9, 0, 1.4, h);
  }
  for (let i = 0; i < 5; i++) g.fillRect(4 + i * 49 + (i % 2 ? 0 : 0), 24, 24.5, 6);
  return tex(c);
}

function dotTexture() {
  const { c, g } = canvas(32);
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return tex(c);
}

function numberTexture(n: number) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#c9a45c';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#111';
  g.fillRect(0, 0, 128, 12);
  g.font = '800 78px Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 64, 74);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function tapeTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 64;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#f5c400';
  g.fillRect(0, 0, 1024, 64);
  g.fillStyle = '#111';
  g.fillRect(0, 0, 1024, 5);
  g.fillRect(0, 59, 1024, 5);
  g.font = '900 34px Arial, Helvetica, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('ESCENA DEL CRIMEN  ·  NO PASAR  ·  ', 14, 34);
  const t = new CanvasTexture(c);
  t.wrapS = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// --- Mannequin ---------------------------------------------------------------
interface Pose {
  armR?: [number, number, number];
  armL?: [number, number, number];
  foreR?: number;
  foreL?: number;
  legR?: [number, number, number];
  legL?: [number, number, number];
  kneeR?: number;
  kneeL?: number;
  head?: [number, number, number];
}

/** Articulated forensic mannequin (~1.75 m), standing on y=0 and facing +x. */
function mannequin(material: Material, pose: Pose = {}) {
  const root = new Group();
  const part = (geo: BufferGeometry, parent: Object3D, y = 0) => {
    const m = new Mesh(geo, material);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  /** A limb hanging down from its pivot; returns the joint at its end. */
  const limb = (parent: Object3D, at: [number, number, number], length: number, radius: number, rot?: [number, number, number]) => {
    const pivot = new Group();
    pivot.position.set(...at);
    if (rot) pivot.rotation.set(...rot);
    parent.add(pivot);
    part(new CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 6, 12), pivot, -length / 2);
    const end = new Group();
    end.position.y = -length;
    pivot.add(end);
    return { pivot, end };
  };

  const pelvis = new Group();
  pelvis.position.y = 0.93;
  root.add(pelvis);
  const hips = part(new SphereGeometry(0.15, 20, 14), pelvis, 0.02);
  hips.scale.set(0.85, 0.7, 1.15);
  const torso = part(new CapsuleGeometry(0.15, 0.32, 8, 16), pelvis, 0.32);
  torso.scale.set(0.75, 1, 1.25);
  part(new CylinderGeometry(0.045, 0.05, 0.08, 12), pelvis, 0.6);
  const headPivot = new Group();
  headPivot.position.y = 0.68;
  if (pose.head) headPivot.rotation.set(...pose.head);
  pelvis.add(headPivot);
  const head = part(new SphereGeometry(0.105, 24, 18), headPivot, 0.08);
  head.scale.set(0.95, 1.12, 0.9);

  // Arms (from the shoulders) and legs (from the hips).
  const armR = limb(pelvis, [0, 0.55, 0.21], 0.3, 0.048, pose.armR);
  const foreR = limb(armR.end, [0, 0, 0], 0.27, 0.042, [0, 0, pose.foreR ?? 0]);
  part(new SphereGeometry(0.045, 12, 10), foreR.end, -0.03);
  const armL = limb(pelvis, [0, 0.55, -0.21], 0.3, 0.048, pose.armL);
  const foreL = limb(armL.end, [0, 0, 0], 0.27, 0.042, [0, 0, pose.foreL ?? 0]);
  part(new SphereGeometry(0.045, 12, 10), foreL.end, -0.03);
  const legR = limb(pelvis, [0, -0.02, 0.095], 0.45, 0.068, pose.legR);
  const shinR = limb(legR.end, [0, 0, 0], 0.44, 0.055, [0, 0, pose.kneeR ?? 0]);
  const footR = part(new BoxGeometry(0.22, 0.06, 0.09), shinR.end, -0.01);
  footR.position.x = 0.05;
  const legL = limb(pelvis, [0, -0.02, -0.095], 0.45, 0.068, pose.legL);
  const shinL = limb(legL.end, [0, 0, 0], 0.44, 0.055, [0, 0, pose.kneeL ?? 0]);
  const footL = part(new BoxGeometry(0.22, 0.06, 0.09), shinL.end, -0.01);
  footL.position.x = 0.05;

  return { root, handR: foreR.end };
}

export function mountCrimeScene(el: HTMLElement, opts: Options = {}): CrimeSceneController | null {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = el.clientWidth < 640;
  const tour = !!opts.tour;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    return null; // No WebGL: keep the poster image and the HTML evidence list.
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.84;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.background = new Color(0x0e1013);
  scene.fog = new Fog(0x0e1013, 16, 30);
  // Image-based lighting from a neutral studio room: soft reflections and
  // bounce light that make the clay materials read as real surfaces.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();
  const camera = new PerspectiveCamera(36, 1, 0.05, 80);

  // --- Light -------------------------------------------------------------
  const hemi = new HemisphereLight(0xe8f0f8, 0x3a4250, 0.6);
  scene.add(hemi);
  const sun = new DirectionalLight(0xfff1de, 1.7);
  sun.position.set(5, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 25;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const fill = new DirectionalLight(0x9fc9ff, 0.45);
  fill.position.set(-6, 4, 8);
  scene.add(fill);

  const solid = (geo: BufferGeometry, material: Material, x: number, y: number, z: number, parent: Object3D = scene) => {
    const m = new Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const decal = (geo: BufferGeometry, material: Material, x: number, z: number, y = 0.004) => {
    const m = new Mesh(geo, material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // --- Room ----------------------------------------------------------------
  const floor = new Mesh(new PlaneGeometry(8, 8), new MeshStandardMaterial({ ...floorTextures(), roughness: 1, envMapIntensity: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const outside = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ color: 0x15202c, roughness: 1 }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.01;
  outside.receiveShadow = true;
  scene.add(outside);

  const wallMat = new MeshStandardMaterial({ map: plasterTexture(), roughness: 0.93 });
  const H = 2.8;
  const T = 0.12;
  // Back wall (z = -4) with a window opening x 0.6..2.4, y 1.1..2.2.
  solid(new BoxGeometry(4.6, H, T), wallMat, -1.7, H / 2, -4 - T / 2);
  solid(new BoxGeometry(1.6, H, T), wallMat, 3.2, H / 2, -4 - T / 2);
  solid(new BoxGeometry(1.8, 1.1, T), wallMat, 1.5, 0.55, -4 - T / 2);
  solid(new BoxGeometry(1.8, 0.6, T), wallMat, 1.5, 2.5, -4 - T / 2);
  const glass = new Mesh(new PlaneGeometry(1.8, 1.1), new MeshStandardMaterial({ color: 0x7fb6d9, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35 }));
  glass.position.set(1.5, 1.65, -4.04);
  scene.add(glass);
  solid(new BoxGeometry(1.86, 0.05, 0.22), mat(0x9aa3ad), 1.5, 1.1, -3.93);
  // Left wall (x = -4) with a door opening z 1.15..2.25, height 2.1.
  solid(new BoxGeometry(T, H, 5.15), wallMat, -4 - T / 2, H / 2, -1.425);
  solid(new BoxGeometry(T, H, 1.75), wallMat, -4 - T / 2, H / 2, 3.125);
  solid(new BoxGeometry(T, 0.7, 1.1), wallMat, -4 - T / 2, 2.45, 1.7);
  // Door swung open against the wall, clear of the doorway.
  solid(new BoxGeometry(0.04, 2.05, 1.05), new MeshStandardMaterial({ map: woodTexture('#7a5a3c', 5), roughness: 0.6 }), -3.9, 1.025, 2.8);
  // Baseboards.
  const base = mat(0x8b939c, 0.6);
  solid(new BoxGeometry(8, 0.08, 0.02), base, 0, 0.04, -3.99);
  solid(new BoxGeometry(0.02, 0.08, 8), base, -3.99, 0.04, 0);

  // --- Furniture -----------------------------------------------------------
  const wood = new MeshStandardMaterial({ map: woodTexture('#8a6a4a', 3), roughness: 0.55 });
  const table = new Group();
  table.position.set(1.6, 0, -2.6);
  scene.add(table);
  solid(new BoxGeometry(1.6, 0.05, 0.85), wood, 0, 0.74, 0, table);
  for (const [x, z] of [[-0.72, -0.36], [0.72, -0.36], [-0.72, 0.36], [0.72, 0.36]])
    solid(new BoxGeometry(0.06, 0.72, 0.06), wood, x, 0.36, z, table);
  // Laptop on the table.
  solid(new BoxGeometry(0.34, 0.015, 0.24), mat(0x2b2f36, 0.4, 0.4), -0.2, 0.775, 0.05, table);
  const screen = solid(new BoxGeometry(0.34, 0.22, 0.012), mat(0x2b2f36, 0.4, 0.4), -0.2, 0.89, -0.07, table);
  screen.rotation.x = -0.25;

  // Toppled chair (lying on its side).
  const chair = new Group();
  chair.position.set(0.35, 0.22, -1.75);
  chair.rotation.set(0, 0.6, Math.PI / 2);
  scene.add(chair);
  solid(new BoxGeometry(0.44, 0.04, 0.44), wood, 0, 0, 0, chair);
  solid(new BoxGeometry(0.04, 0.48, 0.44), wood, -0.2, 0.26, 0, chair);
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]])
    solid(new BoxGeometry(0.035, 0.42, 0.035), wood, x, -0.21, z, chair);

  // Sofa.
  const fabric = new MeshPhysicalMaterial({ map: fabricTexture('#2c5c80', 9), roughness: 0.95, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new Color(0x8fb4d6) });
  const sofa = new Group();
  sofa.position.set(-2.95, 0, -2.4);
  sofa.rotation.y = Math.PI / 2;
  scene.add(sofa);
  solid(new BoxGeometry(2.0, 0.42, 0.85), fabric, 0, 0.21, 0, sofa);
  solid(new BoxGeometry(2.0, 0.5, 0.2), fabric, 0, 0.62, -0.33, sofa);
  solid(new BoxGeometry(0.18, 0.62, 0.85), fabric, -0.95, 0.31, 0, sofa);
  solid(new BoxGeometry(0.18, 0.62, 0.85), fabric, 0.95, 0.31, 0, sofa);

  // Bookshelf.
  const shelf = new Group();
  // Against the back wall, so it never hides the scene from the open side.
  shelf.position.set(-0.9, 0, -3.75);
  shelf.rotation.y = Math.PI / 2;
  scene.add(shelf);
  solid(new BoxGeometry(0.38, 1.9, 1.2), new MeshStandardMaterial({ map: woodTexture('#6f5640', 13), roughness: 0.6 }), 0, 0.95, 0, shelf);
  const bookColors = [0x9c2f2f, 0x2f5f9c, 0xd9b44a, 0x3d7a4f, 0x444b55];
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 7; i++)
      solid(new BoxGeometry(0.22, 0.26 + (i % 3) * 0.03, 0.1), mat(bookColors[(i + row) % 5], 0.8), -0.08, 0.35 + row * 0.55, -0.45 + i * 0.14, shelf);

  // Rug.
  const rug = decal(new PlaneGeometry(2.4, 1.6), mat(0x8c7a64, 1), -0.4, 1.6, 0.003);
  rug.material = new MeshStandardMaterial({ map: rugTexture(), roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });

  // Baked contact shadows (cheap ambient occlusion): soft dark patches where
  // objects meet the floor, and a gradient along the wall/floor corners.
  const aoMat = new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, toneMapped: false });
  aoMat.color.set(0x000000);
  for (const [x, z, w, d, r] of [
    [1.6, -2.6, 2.1, 1.3, 0], [-2.95, -2.4, 1.35, 2.5, 0], [-0.9, -3.65, 1.7, 0.75, 0], [0.35, -1.75, 0.9, 0.9, 0.6],
    [-0.52, 0.52, 2.1, 0.75, Math.atan2(-0.65, -0.76)],
  ] as const) {
    const ao = decal(new PlaneGeometry(w, d), aoMat, x, z, 0.0045);
    ao.rotation.z = -r;
    ao.receiveShadow = false;
    ao.renderOrder = 1;
  }
  const cornerMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, toneMapped: false,
    alphaMap: fadeTexture([[0, '#5a5a5a'], [1, '#000']]) });
  const corner = (w: number, x: number, z: number, ry: number, floorStrip: boolean) => {
    const m = new Mesh(new PlaneGeometry(w, 0.5), cornerMat);
    if (floorStrip) {
      m.rotation.set(-Math.PI / 2, 0, ry);
      m.position.set(x, 0.0042, z);
    } else {
      m.rotation.set(0, ry, Math.PI); // darker at the bottom
      m.position.set(x, 0.25, z);
    }
    m.renderOrder = 1;
    scene.add(m);
  };
  corner(8, 0, -3.75, 0, true); // floor along the back wall
  corner(8, -3.75, 0, Math.PI / 2, true); // floor along the left wall
  corner(8, 0, -3.985, 0, false);
  corner(8, -3.985, 0, Math.PI / 2, false);

  // --- People ----------------------------------------------------------------
  const victimMat = new MeshPhysicalMaterial({ color: 0xd9dbde, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const victim = mannequin(victimMat, {
    armR: [0.55, 0, 0.15], armL: [-0.75, 0, -0.2], foreL: 0.5,
    legR: [0.18, 0, 0.05], legL: [-0.12, 0, -0.05], kneeL: -0.25,
    head: [0.35, 0, 0],
  });
  // Lying on the back: head towards (0.76, -0.65) on the floor.
  const victimWrap = new Group();
  victim.root.rotation.z = Math.PI / 2;
  victim.root.position.y = 0.14;
  victimWrap.add(victim.root);
  victimWrap.rotation.y = Math.atan2(-0.65, -0.76);
  victimWrap.position.set(-0.52, 0, 0.52);
  scene.add(victimWrap);

  // Shooter at the doorway, aiming at the impact point on the back wall.
  const origin = new Vector3(-3.35, 0, 1.7);
  const impactPoint = new Vector3(3.1, 1.6, -3.94);
  const shooterMat = new MeshPhysicalMaterial({ color: 0x7f9bb8, roughness: 0.5, clearcoat: 0.3, transparent: true, opacity: 0 });
  const shooter = mannequin(shooterMat, {
    armR: [0, 0.32, Math.PI / 2 - 0.05], armL: [0, -0.32, Math.PI / 2 - 0.05],
    legR: [0, 0, -0.12], legL: [0, 0, 0.1],
  });
  shooter.root.position.copy(origin);
  shooter.root.rotation.y = Math.atan2(-(impactPoint.z - origin.z), impactPoint.x - origin.x);
  scene.add(shooter.root);
  solid(new BoxGeometry(0.17, 0.03, 0.03), shooterMat, 0.06, -0.01, -0.18, shooter.handR);
  const grip = solid(new BoxGeometry(0.035, 0.08, 0.028), shooterMat, 0.0, -0.05, -0.18, shooter.handR);
  grip.rotation.z = 0.25;

  // --- Physical traces ------------------------------------------------------
  // Glossy, irregular blood pool with satellite drops, plus a directional spatter.
  const bloodMat = new MeshPhysicalMaterial({
    map: stainTexture(31, 'rgba(92,10,16,1)'), transparent: true, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const pool = decal(new PlaneGeometry(1.0, 1.0), bloodMat, 1.0, -0.8, 0.005);
  pool.rotation.z = 0.6;
  pool.renderOrder = 2;
  const spatterMat = bloodMat.clone();
  spatterMat.map = stainTexture(37, 'rgba(92,10,16,1)', 4);
  const spatter = decal(new PlaneGeometry(0.7, 0.45), spatterMat, 1.42, -1.25, 0.005);
  spatter.rotation.z = 0.75;
  spatter.renderOrder = 2;
  const shoeMat = new MeshBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const [x, z, rot] of [[-0.95, 0.35, 0.9], [-1.25, 0.6, 0.9], [-1.55, 0.82, 0.9]]) {
    // Sole + heel.
    for (const [dy, r, sy] of [[0.04, 0.05, 1.5], [-0.075, 0.04, 1.1]]) {
      const s = decal(new CircleGeometry(r, 18), shoeMat, x, z, 0.004);
      s.scale.set(1, sy, 1);
      s.rotation.z = rot;
      s.position.x += Math.sin(rot) * dy;
      s.position.z += Math.cos(rot) * dy * -1;
    }
  }
  const casing = solid(new CylinderGeometry(0.008, 0.008, 0.024, 12), mat(0xc29a3c, 0.3, 0.9), -2.82, 0.008, 1.12);
  casing.rotation.set(Math.PI / 2, 0, 0.7);
  const phone = solid(new BoxGeometry(0.075, 0.01, 0.155), mat(0x15181d, 0.35, 0.3), 1.98, 0.006, 1.32);
  phone.rotation.y = 0.4;
  const phoneScreen = new Mesh(new PlaneGeometry(0.066, 0.14), new MeshBasicMaterial({ color: 0x3d8fd1 }));
  phoneScreen.rotation.x = -Math.PI / 2;
  phoneScreen.position.y = 0.006;
  phone.add(phoneScreen);
  const hole = new Mesh(new CircleGeometry(0.022, 16), new MeshBasicMaterial({ color: 0x111111 }));
  hole.position.copy(impactPoint);
  scene.add(hole);
  const impact = new Mesh(new RingGeometry(0.06, 0.09, 28), new MeshBasicMaterial({ color: 0xff3b30, side: DoubleSide, transparent: true }));
  impact.position.copy(impactPoint).add(new Vector3(0, 0, 0.005));
  scene.add(impact);

  // --- Police cordon (tour only): posts around the open corner, sagging tape ---
  if (tour) {
    const postMat = mat(0x2b2f36, 0.5, 0.3);
    const tapeMap = tapeTexture();
    const posts: [number, number][] = [[4.7, -3.4], [4.7, 0.6], [4.7, 4.7], [0.6, 4.7], [-3.4, 4.7]];
    for (const [x, z] of posts) {
      solid(new CylinderGeometry(0.028, 0.028, 1.12, 10), postMat, x, 0.56, z);
      solid(new CylinderGeometry(0.16, 0.18, 0.04, 16), postMat, x, 0.02, z);
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const [ax, az] = posts[i];
      const [bx, bz] = posts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      for (const [y, sag] of [[1.0, 0.09], [0.62, 0.06]]) {
        const geo = new PlaneGeometry(len, 0.08, 24, 1);
        const pos = geo.attributes.position;
        for (let v = 0; v < pos.count; v++) {
          const u = (2 * pos.getX(v)) / len;
          pos.setY(v, pos.getY(v) - sag * (1 - u * u));
        }
        geo.computeVertexNormals();
        const map = tapeMap.clone();
        map.repeat.set(len / 2.3, 1);
        map.needsUpdate = true;
        const strip = new Mesh(geo, new MeshStandardMaterial({ map, roughness: 0.6, side: DoubleSide }));
        strip.position.set((ax + bx) / 2, y, (az + bz) / 2);
        strip.rotation.y = -Math.atan2(bz - az, bx - ax);
        strip.castShadow = true;
        scene.add(strip);
      }
    }
  }

  // --- Forensic floodlights on tripods, with a faint visible beam -------------
  const lamps: SpotLight[] = [];
  const beams: MeshBasicMaterial[] = [];
  const lampMetal = mat(0x23272d, 0.45, 0.6);
  const beamTex = fadeTexture([[0, 'rgba(255,255,255,0.9)'], [0.3, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  for (const [x, z] of [[5.5, -2.3], [-2.3, 5.5]] as const) {
    const head = new Vector3(x, 2.25, z);
    const aim = new Vector3(0.2, 0.2, -0.4);
    // Tripod legs and mast.
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const leg = solid(new CylinderGeometry(0.014, 0.014, 1.25, 6), lampMetal, x + Math.cos(a) * 0.22, 0.58, z + Math.sin(a) * 0.22);
      leg.rotation.set(Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32);
    }
    solid(new CylinderGeometry(0.018, 0.018, 1.1, 8), lampMetal, x, 1.65, z);
    const lamp = new Group();
    lamp.position.copy(head);
    lamp.lookAt(aim);
    scene.add(lamp);
    solid(new BoxGeometry(0.42, 0.3, 0.14), lampMetal, 0, 0, -0.02, lamp);
    const face = new Mesh(new PlaneGeometry(0.36, 0.24), new MeshBasicMaterial({ color: 0xfff6e0, toneMapped: false }));
    face.position.z = 0.055;
    lamp.add(face);
    const spot = new SpotLight(0xfff2dc, 6, 16, 0.62, 0.7, 1.4);
    spot.position.copy(head);
    spot.target.position.copy(aim);
    scene.add(spot, spot.target);
    lamps.push(spot);
    // Volumetric-looking cone (additive, no depth write): reads as light in dusty air.
    const len = head.distanceTo(aim) * 0.85;
    const beamMat = new MeshBasicMaterial({ map: beamTex, color: 0xfff1d6, transparent: true, opacity: small ? 0.07 : 0.09,
      blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false });
    const beam = new Mesh(new CylinderGeometry(0.16, 1.5, len, 32, 1, true), beamMat);
    beam.position.set(0, 0, len / 2 + 0.06);
    beam.rotation.x = -Math.PI / 2; // narrow end at the lamp
    lamp.add(beam);
    beams.push(beamMat);
  }

  // Dust floating in the light (drifts slowly while the scene animates).
  const dustCount = small ? 140 : 320;
  const dustPos = new Float32Array(dustCount * 3);
  const dustRand = rng(41);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = -3.6 + dustRand() * 8.6;
    dustPos[i * 3 + 1] = 0.2 + dustRand() * 2.4;
    dustPos[i * 3 + 2] = -3.6 + dustRand() * 8.6;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new BufferAttribute(dustPos, 3));
  const dustMat = new PointsMaterial({ map: dotTexture(), size: 0.022, color: 0xfff4e0, transparent: true, opacity: 0.55,
    depthWrite: false, blending: AdditiveBlending, toneMapped: false });
  const dust = new Points(dustGeo, dustMat);
  scene.add(dust);

  // --- Luminol: cleaned-up traces that only glow in the dark ---------------------
  // A wiped smear by the victim, a drag mark and bloody shoe prints leading to
  // the door, and a smeared hand print on the back wall.
  const luminolMats: MeshBasicMaterial[] = [];
  const glow = (texSeed: number, w: number, d: number, x: number, z: number, rot: number, blobs = 18) => {
    const m = new MeshBasicMaterial({ map: stainTexture(texSeed, 'rgba(120,200,255,1)', blobs), color: 0x5fd0ff,
      transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    luminolMats.push(m);
    const mesh = decal(new PlaneGeometry(w, d), m, x, z, 0.006);
    mesh.rotation.z = rot;
    mesh.renderOrder = 3;
    return mesh;
  };
  glow(51, 2.0, 0.8, 0.25, -0.4, 0.65, 26); // wiped smear
  glow(53, 2.8, 0.6, -1.9, 1.15, 0.38, 30); // drag mark towards the door
  for (let k = 0; k < 6; k++) {
    const x = -1.05 - k * 0.42;
    const z = 0.95 + k * 0.2 + (k % 2 ? 0.1 : -0.06);
    glow(60 + k, 0.17, 0.38, x, z, -1.15, 8);
  }
  const hand = new Mesh(new PlaneGeometry(0.3, 0.42), (() => {
    const m = new MeshBasicMaterial({ map: stainTexture(71, 'rgba(120,200,255,1)', 12), color: 0x5fd0ff,
      transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    luminolMats.push(m);
    return m;
  })());
  hand.position.set(-2.1, 1.05, -3.985);
  scene.add(hand);
  const bgDay = new Color(0x0e1013);
  const bgDark = new Color(0x050607);

  // --- Evidence tents (clickable) ---------------------------------------------
  const tentGeo = new PlaneGeometry(0.16, 0.17);
  const scaleMat = new MeshStandardMaterial({ map: scaleTexture(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 });
  const markers = SCENE_EVIDENCE.map((ev, i) => {
    const g = new Group();
    const face = new MeshStandardMaterial({ map: numberTexture(ev.n), roughness: 0.5, side: DoubleSide });
    for (const sgn of [1, -1]) {
      const p = new Mesh(tentGeo, face);
      p.position.set(0, 0.075, sgn * 0.035);
      p.rotation.x = -sgn * 0.42;
      p.castShadow = true;
      g.add(p);
    }
    // L-shaped photo scale beside the tent, as in forensic photography.
    for (const [w, x, z, r] of [[0.17, 0.11, 0.1, 0], [0.12, 0.025, 0.035, Math.PI / 2]] as const) {
      const ruler = new Mesh(new PlaneGeometry(w, 0.022), scaleMat);
      ruler.rotation.set(-Math.PI / 2, 0, r);
      ruler.position.set(x, 0.002, z);
      ruler.receiveShadow = true;
      g.add(ruler);
    }
    g.position.set(ev.pos[0], 0, ev.pos[1]);
    g.rotation.y = 0.5 + i * 0.4;
    g.traverse((o) => (o.userData.index = i));
    scene.add(g);
    return g;
  });
  const selRing = new Mesh(new RingGeometry(0.26, 0.31, 40), new MeshBasicMaterial({ color: 0xf5b70a, side: DoubleSide, transparent: true, opacity: 0.9 }));
  selRing.rotation.x = -Math.PI / 2;
  selRing.visible = false;
  scene.add(selRing);
  let selected: number | null = null;

  // --- Trajectories (red rods) ---------------------------------------------
  const muzzle = new Vector3();
  scene.updateMatrixWorld(true);
  shooter.handR.getWorldPosition(muzzle);
  muzzle.y += 0.02;
  const rodMat = new MeshBasicMaterial({ color: 0xff3b30 });
  const trajectories = [
    [muzzle.clone(), new Vector3(0.3, 1.58, -1.3), impactPoint.clone()],
    [muzzle.clone(), new Vector3(-1.4, 1.38, 0.55), new Vector3(0.45, 1.3, -0.35)],
  ].map((pts) => {
    const geo = new TubeGeometry(new CatmullRomCurve3(pts), 80, 0.011, 6);
    geo.setDrawRange(0, 0);
    const m = new Mesh(geo, rodMat);
    scene.add(m);
    return m;
  });

  // --- Labels (constant screen size) ------------------------------------------
  const fade: { mat: Material; base: number }[] = [];
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
    const m = new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, opacity: 0 });
    const s = new Sprite(m);
    s.scale.set(scale * (c.width / c.height), scale, 1);
    s.renderOrder = 5;
    scene.add(s);
    return s;
  };
  const e1 = SCENE_EVIDENCE[2].pos;
  const e2 = SCENE_EVIDENCE[4].pos;
  const dist = Math.hypot(e1[0] - e2[0], e1[1] - e2[1]).toFixed(2).replace('.', ',');
  const tape = new Line(
    new BufferGeometry().setFromPoints([new Vector3(e1[0], 0.012, e1[1]), new Vector3(e2[0], 0.012, e2[1])]),
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  scene.add(tape);
  fade.push({ mat: tape.material as Material, base: 0.9 });
  const measureLabel = textSprite(`${dist} m`, '#e9f1f7', 'rgba(8,19,31,.88)', 0.04);
  measureLabel.position.set((e1[0] + e2[0]) / 2, 0.25, (e1[1] + e2[1]) / 2);
  fade.push({ mat: measureLabel.material, base: 1 });
  const impactLabel = textSprite('IMPACTO', '#ffffff', '#d92d20', 0.034);
  impactLabel.position.set(impactPoint.x, 2.05, impactPoint.z + 0.15);
  fade.push({ mat: impactLabel.material, base: 1 });
  const originLabel = textSprite('ORIGEN', '#0e1013', '#d4b979', 0.034);
  originLabel.position.set(origin.x, 2.15, origin.z);

  // --- Forensic 3D scanner + people ---------------------------------------------
  // Terrestrial laser scanner on its tripod. When the scene appears, a brass
  // scan wave sweeps every surface from it, like the scanner documenting the room.
  const scannerAt = new Vector3(-3.15, 1.45, -1.05); // by the sofa, out of the main views
  {
    const metal = mat(0x30353c, 0.4, 0.6);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      const leg = solid(new CylinderGeometry(0.009, 0.009, 1.4, 6), metal, scannerAt.x + Math.cos(a) * 0.24, 0.66, scannerAt.z + Math.sin(a) * 0.24);
      leg.rotation.set(Math.sin(a) * 0.33, 0, -Math.cos(a) * 0.33);
    }
    solid(new CylinderGeometry(0.075, 0.09, 0.2, 24), metal, scannerAt.x, scannerAt.y - 0.02, scannerAt.z);
    const ring = new Mesh(new CylinderGeometry(0.092, 0.092, 0.025, 32, 1, true), new MeshBasicMaterial({ color: 0xe3c27a, toneMapped: false }));
    ring.position.copy(scannerAt).add(new Vector3(0, 0.05, 0));
    scene.add(ring);
  }
  scanWave.uScanOrigin.value.copy(scannerAt);
  let scanRadius = reduceMotion ? 1e4 : 0;
  scanWave.uScanRadius.value = scanRadius;

  // People: solid forensic mannequins with real proportions (baked poses) in
  // place of the simple procedural ones: the victim, the shooter (a hypothesis,
  // faded in with the reconstruction) and a forensic examiner photographing
  // the casing.
  victimWrap.visible = false;
  shooter.root.visible = false;
  const joint = (color: number) => new MeshPhysicalMaterial({ color, roughness: 0.45, metalness: 0.2, clearcoat: 0.4 });
  const shooterFig = [
    new MeshPhysicalMaterial({ color: 0x8ea4bd, roughness: 0.45, clearcoat: 0.3, transparent: true, opacity: 0 }),
    new MeshPhysicalMaterial({ color: 0x3c4756, roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0 }),
  ];
  let shooterMesh: Mesh | null = null;
  const figures: { name: string; mats: Material[]; at: [number, number, number]; rotY: number }[] = [
    { name: 'victim', mats: [new MeshPhysicalMaterial({ color: 0xdcd9d3, roughness: 0.6, clearcoat: 0.25 }), joint(0x4a4f57)], at: [-0.02, 0, 0.1], rotY: Math.atan2(-0.76, 0.65) },
    { name: 'shooter', mats: shooterFig, at: [origin.x, 0, origin.z], rotY: Math.atan2(impactPoint.x - origin.x, impactPoint.z - origin.z) },
    { name: 'perito', mats: [new MeshPhysicalMaterial({ color: 0xf1f2f3, roughness: 0.75, sheen: 0.4 }), joint(0x8a929b)], at: [-2.25, 0, 2.05], rotY: Math.atan2(-0.65, -0.85) },
  ];
  const assetBase = import.meta.env.BASE_URL.replace(/\/$/, '');
  figures.forEach((f) => {
    f.mats.forEach(withScanWave);
    loadFigure(`${assetBase}/figures/${f.name}.bin`, f.mats[0], f.mats[1])
      .then((m) => {
        m.position.set(...f.at);
        m.rotation.y = f.rotY;
        scene.add(m);
        if (f.name === 'shooter') {
          shooterMesh = m;
          applyTime(t);
        }
        wake();
      })
      .catch(() => {});
  });
  // Every lit surface of the room shows the scan wave.
  scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (const mt of Array.isArray(m.material) ? m.material : [m.material])
      if ((mt as MeshStandardMaterial).isMeshStandardMaterial && !mt.userData.scanWave) {
        mt.userData.scanWave = true;
        withScanWave(mt);
      }
  });

  // --- Camera & controls -----------------------------------------------------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // The room is open towards +x/+z; keep the camera on that side of the walls.
  controls.minAzimuthAngle = -0.05;
  controls.maxAzimuthAngle = Math.PI / 2 + 0.05;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = 1.38;
  const orbitTarget = new Vector3(0.3, 0.5, -0.7);
  controls.target.copy(orbitTarget);
  renderer.domElement.style.touchAction = 'pan-y';
  controls.enabled = !tour;

  // Pull back on narrower frames (and look more from above on portrait ones) so the whole room fits.
  const orbitPos = () => {
    const aspect = el.clientWidth / Math.max(el.clientHeight, 1);
    const dist = 10.5 * Math.min(1.6, Math.max(1, Math.pow(1.6 / aspect, 0.8)));
    return new Vector3(7.4, aspect < 1 ? 8.4 : 5.6, 7.4).setLength(dist).add(orbitTarget);
  };
  const VIEWS: Record<SceneViewId, () => { pos: Vector3; target: Vector3 }> = {
    orbital: () => ({ pos: orbitPos(), target: orbitTarget.clone() }),
    cenital: () => ({ pos: new Vector3(0.3, el.clientWidth < 520 ? 14 : 11.5, 0.9), target: new Vector3(0.1, 0, -0.1) }),
    testigo: () => ({ pos: new Vector3(-3.55, 1.62, 3.55), target: new Vector3(0.6, 0.6, -1.2) }),
    // Perpendicular to the line of fire: shooter, both trajectories and the impact in one frame.
    trayectoria: () => ({ pos: new Vector3(5.6, 3.6, 6.2), target: new Vector3(-0.2, 1.0, -1.1) }),
  };
  // Tour path: keyframes at scroll progress p (each act holds its view a moment).
  // A narrow frame pulls the camera back along its line of sight so the room fits.
  const fit = () => Math.min(1.9, Math.pow(Math.max(1, 1.45 / (el.clientWidth / Math.max(el.clientHeight, 1))), 0.75));
  const key = (p: number, pos: Vector3 | [number, number, number], target: [number, number, number] | Vector3) => ({
    p,
    pos: pos instanceof Vector3 ? pos : new Vector3(...pos),
    target: target instanceof Vector3 ? target : new Vector3(...target),
  });
  const path = () => {
    const k = fit();
    const far = (pos: [number, number, number], target: [number, number, number]) => {
      const tg = new Vector3(...target);
      return new Vector3(...pos).sub(tg).multiplyScalar(k).add(tg);
    };
    const orbit = VIEWS.orbital();
    // Wide frames keep the left side for the story cards: step back a little more.
    if (el.clientWidth >= 900 && el.clientWidth > el.clientHeight) orbit.pos.sub(orbit.target).multiplyScalar(1.15).add(orbit.target);
    return [
      key(0, far([9.2, 1.5, 9.2], [0.4, 0.9, 0.4]), [0.4, 0.9, 0.4]),
      key(0.07, far([7.6, 1.7, 7.6], [0.3, 0.7, 0.1]), [0.3, 0.7, 0.1]),
      key(0.17, far([6.0, 3.6, 5.4], [-0.4, 0.2, -0.5]), [-0.4, 0.2, -0.5]),
      key(0.24, far([5.6, 3.9, 4.6], [-0.3, 0.2, -0.6]), [-0.3, 0.2, -0.6]),
      key(0.37, far([3.6, 3.0, 4.4], [-1.3, 0.1, 0.4]), [-1.3, 0.1, 0.4]),
      key(0.44, far([3.3, 3.2, 4.0], [-1.2, 0.1, 0.3]), [-1.2, 0.1, 0.3]),
      key(0.57, far([0.35, 12.5, 0.95], [0.1, 0, -0.1]), [0.1, 0, -0.1]),
      key(0.64, far([0.3, 12.6, 0.9], [0.1, 0, -0.1]), [0.1, 0, -0.1]),
      // Perpendicular to the line of fire: shooter, trajectories and impact in one frame.
      key(0.77, far([4.0, 3.4, 6.6], [-1.5, 1.0, -0.4]), [-1.5, 1.0, -0.4]),
      key(0.84, far([4.4, 3.6, 6.4], [-1.5, 1.0, -0.4]), [-1.5, 1.0, -0.4]),
      key(0.95, orbit.pos, orbit.target),
      key(1, orbit.pos, orbit.target),
    ];
  };
  // Timeline on the same scroll (6 acts, one every 0.2): markers in act 2,
  // luminol in act 3, measurements in act 4, shooter and trajectories in act 5.
  const tourTime = (p: number) =>
    p < 0.08 ? 0 : p < 0.22 ? 2.05 * seg(p, 0.08, 0.22) : p < 0.68 ? 2.05 : 2.05 + (DURATION - 2.05) * seg(p, 0.68, 0.88);
  const tourLumi = (p: number) => ease(seg(p, 0.29, 0.36)) * (1 - ease(seg(p, 0.46, 0.52)));
  const tourMeasure = (p: number) => seg(p, 0.54, 0.62);
  let keys = tour ? path() : [];
  let tourGoal = 0;
  let tourAt = 0;
  const tourCam = new Vector3();
  const tourTarget = new Vector3();
  const placeTour = (p: number) => {
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].p) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const u = ease(seg(p, a.p, b.p));
    tourCam.lerpVectors(a.pos, b.pos, u);
    tourTarget.lerpVectors(a.target, b.target, u);
    camera.position.copy(tourCam);
    controls.target.copy(tourTarget);
    camera.lookAt(tourTarget);
  };

  let view: SceneViewId = 'orbital';
  // Phones, tablets (and reduced motion) render on demand: the scene stays still and only
  // redraws while something moves, so the CPU and battery stay idle.
  // Touch devices (phones, tablets) too: no constant redraw while nobody touches it.
  const onDemand = small || reduceMotion || tour || matchMedia('(pointer: coarse)').matches;
  let sway = !onDemand; // gentle side-to-side drift in the orbital view
  let swayFrom = -1; // time the drift (re)starts, so it begins at the resting angle
  let tween: { from: Vector3; to: Vector3; tFrom: Vector3; tTo: Vector3; start: number } | null = null;

  // --- Timeline & render-loop state (declared before anything calls wake()) --
  const intro = opts.intro !== false && !reduceMotion && !tour;
  let t = intro ? 0 : DURATION;
  let playing = intro;
  let last = performance.now();
  let visible = true;
  let raf = 0;
  let ready = false;
  let lost = false; // WebGL context taken away by the browser (memory, app switch)
  let lumi = 0; // luminol amount, 0 = normal light, 1 = dark with glowing traces
  let lumiGoal = 0;
  const beamBase = beams.map((b) => b.opacity);
  const applyLuminol = (L: number) => {
    const k = 1 - L;
    hemi.intensity = 0.6 * (1 - 0.96 * L);
    sun.intensity = 1.7 * (1 - 0.98 * L);
    fill.intensity = 0.45 * (1 - 0.96 * L);
    scene.environmentIntensity = 0.3 * (1 - 0.96 * L);
    lamps.forEach((l) => (l.intensity = 6 * (1 - 0.97 * L)));
    beams.forEach((b, i) => (b.opacity = beamBase[i] * k));
    dustMat.opacity = 0.55 * (1 - 0.6 * L);
    luminolMats.forEach((m) => (m.opacity = L));
    (scene.background as Color).lerpColors(bgDay, bgDark, L);
    scene.fog!.color.lerpColors(bgDay, bgDark, L);
  };

  const setView = (v: SceneViewId) => {
    view = v;
    sway = v === 'orbital' && !onDemand;
    const { pos, target } = VIEWS[v]();
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
    sway = false;
  });

  const resize = () => {
    const { width, height } = el.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    if (tour) {
      // Leave room for the story cards: scene shifted up on portrait frames
      // (cards at the bottom) and to the right on wide ones (cards on the left).
      if (camera.aspect < 1) camera.setViewOffset(width, height, 0, height * 0.13, width, height);
      else if (width >= 900) camera.setViewOffset(width, height, -width * 0.17, 0, width, height);
      else camera.clearViewOffset();
      keys = path();
      const k = fit();
      scene.fog = new Fog(0x0e1013, 16 * k, 30 * k);
      placeTour(tourAt);
    }
    camera.updateProjectionMatrix();
    wake();
  };
  camera.position.copy(VIEWS.orbital().pos);
  resize();
  new ResizeObserver(resize).observe(el);

  // --- Picking --------------------------------------------------------------
  const ray = new Raycaster();
  const ndc = new Vector2();
  const pick = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(markers.filter((m) => m.visible), true)[0];
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

  // Phones may take the WebGL context away (low memory, app switch): show the
  // poster meanwhile, and carry on when the browser gives it back.
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    cancelAnimationFrame(raf);
    raf = 0;
    el.classList.add('gl-lost');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    lost = false;
    el.classList.remove('gl-lost');
    wake();
  });
  el.appendChild(renderer.domElement);
  el.classList.add('is-live');

  // --- Timeline -------------------------------------------------------------
  const applyTime = (time: number, meas = seg(time, 4.7, 5.3)) => {
    markers.forEach((m, i) => {
      const p = ease(seg(time, 0.4 + i * 0.32, 0.75 + i * 0.32));
      m.visible = p > 0.01;
      // Slightly larger than life (x1.5) so the numbers read in wide views.
      const s = Math.max(0.001, 1.5 * p * (selected === i ? 1.35 : 1));
      m.scale.set(s, s, s);
    });
    const fig = seg(time, 2.1, 2.8);
    // The shooter is a hypothesis: its scanned figure fades in with the reconstruction.
    shooterFig.forEach((m) => {
      m.opacity = fig;
      m.depthWrite = fig > 0.5;
    });
    if (shooterMesh) {
      const sm: Mesh = shooterMesh;
      sm.visible = fig > 0.01;
      sm.castShadow = fig > 0.6;
    }
    originLabel.material.opacity = fig;
    trajectories.forEach((tr, i) => {
      const count = tr.geometry.index ? tr.geometry.index.count : 0;
      const p = ease(seg(time, 2.9 + i * 0.45, 4.2 + i * 0.45));
      tr.geometry.setDrawRange(0, Math.floor((count * p) / 3) * 3);
    });
    (impact.material as Material).opacity = seg(time, 4.1, 4.3);
    fade.forEach(({ mat: m, base }) => (m.opacity = base * meas));
  };

  const sph = new Spherical();
  const tick = (now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (scanRadius < 30) {
      scanRadius = Math.min(30, scanRadius + dt * 7);
      scanWave.uScanRadius.value = scanRadius >= 30 ? 1e4 : scanRadius;
    }
    if (playing) {
      t += dt;
      if (t >= DURATION) {
        t = DURATION;
        playing = false;
      }
      opts.onTime?.(t, playing);
    }
    if (tour) {
      // Glide towards the scroll position instead of jumping with each wheel step.
      tourAt = reduceMotion || Math.abs(tourGoal - tourAt) < 0.0004 ? tourGoal : tourAt + (tourGoal - tourAt) * (1 - Math.exp(-dt * 7));
      t = tourTime(tourAt);
      applyTime(t, tourMeasure(tourAt));
      const L = tourLumi(tourAt);
      if (L !== lumi) applyLuminol((lumi = lumiGoal = L));
      placeTour(tourAt);
    } else applyTime(t);
    if (lumi !== lumiGoal) {
      const step = reduceMotion ? 1 : dt * 1.6;
      lumi = Math.abs(lumiGoal - lumi) <= step ? lumiGoal : lumi + Math.sign(lumiGoal - lumi) * step;
      applyLuminol(lumi);
    }
    if (tween) {
      const p = ease(clamp01((now - tween.start) / 1100));
      camera.position.lerpVectors(tween.from, tween.to, p);
      controls.target.lerpVectors(tween.tFrom, tween.tTo, p);
      if (p >= 1) {
        tween = null;
        swayFrom = -1;
      }
    } else if (sway && view === 'orbital') {
      // Slow drift around the open corner of the room. It starts from the
      // resting angle, which is also the angle of the static poster image.
      if (swayFrom < 0) swayFrom = now;
      const off = camera.position.clone().sub(controls.target);
      sph.setFromVector3(off);
      sph.theta = Math.PI / 4 + Math.sin((now - swayFrom) / 5200) * 0.42;
      camera.position.copy(controls.target).add(new Vector3().setFromSpherical(sph));
    }
    if (selected !== null) {
      const pulse = 1 + Math.sin(now / 260) * 0.08;
      selRing.scale.set(pulse, pulse, 1);
    }
    if (!onDemand) {
      impact.scale.setScalar(1 + Math.sin(now / 330) * 0.12);
      dust.rotation.y = now * 0.000012;
      dust.position.y = Math.sin(now / 4000) * 0.05;
    }
    const moved = !tour && controls.update();
    renderer.render(scene, camera);
    const busy = !onDemand || playing || tween !== null || moved || selected !== null || tourAt !== tourGoal || lumi !== lumiGoal || scanRadius < 30;
    raf = busy && visible && !document.hidden ? requestAnimationFrame(tick) : 0;
  };
  function wake() {
    if (ready && !raf && visible && !document.hidden && !lost) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    wake();
  }).observe(el);
  controls.addEventListener('change', wake); // dragging restarts an idle on-demand loop
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
        selRing.position.set(x, 0.008, z);
        if (t < DURATION) {
          t = DURATION;
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
    setLuminol(on) {
      lumiGoal = on ? 1 : 0;
      wake();
    },
    scrub(progress) {
      tourGoal = clamp01(progress);
      wake();
    },
  };
}
