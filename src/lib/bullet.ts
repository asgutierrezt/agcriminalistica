/**
 * Photoreal 3D 9×19 mm Parabellum cartridge for the home hero, built from real
 * dimensions (CIP: case 19.15 mm, overall 29.69 mm, groove Ø 9.02 mm, land
 * Ø 8.82 mm, 6 grooves, 1:250 mm right-hand twist). One scene unit = 1 cm.
 *
 * The page scroll drives a short ballistics lesson (see BulletHero.astro):
 *   0  the complete cartridge, turning slowly
 *   1  exploded view: projectile, powder, case and primer
 *   2  the fired case seen from the base: firing pin, extractor and ejector
 *      marks and the headstamp
 *   3  the fired projectile with the land and groove impressions (with their
 *      micro-striations) the barrel engraves on it
 *
 * Every part is turned on a lathe from its real profile, with sharp machined
 * edges, PBR metals lit by an environment map, and textures drawn on canvases
 * from a fixed seed (no downloads; the static poster matches the first frame).
 * Loaded on demand by BulletHero.astro; named imports keep three.js small.
 */
import {
  ACESFilmicToneMapping, BufferAttribute, CanvasTexture, DirectionalLight, DynamicDrawUsage, Group, InstancedMesh,
  LatheGeometry, Matrix4, Mesh, MeshPhysicalMaterial, PerspectiveCamera, PMREMGenerator, Quaternion, RepeatWrapping,
  RingGeometry, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface BulletLabel {
  id: string;
  /** Screen position inside the stage, in CSS pixels. */
  x: number;
  y: number;
  /** 0..1 */
  opacity: number;
  /** On-screen radius of the part at that point (px), so leader lines clear it. */
  reach: number;
}

export interface BulletController {
  /** Scroll progress through the lesson, 0..1. */
  scrub(progress: number): void;
}

interface Options {
  /** Called after each frame with the projected label anchors. */
  onLabels?: (labels: BulletLabel[]) => void;
}

const MM = 0.1; // millimetres → scene units (cm)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

// --- Real dimensions (mm) -------------------------------------------------
const CASE_LEN = 19.15;
const RIM_R = 9.96 / 2;
const BASE_R = 9.93 / 2;
const MOUTH_R = 9.65 / 2;
const GROOVE_R = 4.42; // extractor groove
const POCKET_R = 2.2; // small pistol primer
const BULLET_R = 9.02 / 2;
const BULLET_LEN = 15.5; // 124 gr FMJ round nose
const SEAT = 14.19; // bullet base above the case head (OAL 29.69)
const BEARING = 6.3; // cylindrical bearing surface of the bullet
const TWIST = 250; // mm per turn

// Deterministic pseudo-random numbers, so textures never change between loads.
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
  return { c, g: c.getContext('2d')! };
}

function tex(c: HTMLCanvasElement, color: boolean, wrap = false) {
  const t = new CanvasTexture(c);
  if (color) t.colorSpace = SRGBColorSpace;
  if (wrap) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * Lathe a profile of [radius, height] points (mm). Corners get a micro bevel
 * (two points 0.03 mm apart) so machined edges stay crisp and catch the light,
 * and v is re-mapped to arc length, so textures follow the real surface.
 */
function lathe(profile: [number, number][], segments = 128, smoothFrom = Infinity) {
  const pts: Vector2[] = [];
  profile.forEach(([r, y], i) => {
    const p = new Vector2(r * MM, y * MM);
    if (i === 0 || i === profile.length - 1 || i >= smoothFrom) return void pts.push(p);
    const prev = new Vector2(profile[i - 1][0] * MM, profile[i - 1][1] * MM);
    const next = new Vector2(profile[i + 1][0] * MM, profile[i + 1][1] * MM);
    const b = 0.003;
    pts.push(p.clone().add(prev.sub(p).normalize().multiplyScalar(b)), p.clone().add(next.sub(p).normalize().multiplyScalar(b)));
  });
  const geo = new LatheGeometry(pts, segments);
  // Arc-length v coordinate.
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = len[len.length - 1];
  const uv = geo.attributes.uv as BufferAttribute;
  for (let i = 0; i <= segments; i++)
    for (let j = 0; j < pts.length; j++) uv.setY(i * pts.length + j, len[j] / total);
  return { geo, arc: (j: number) => len[j] / total, pts };
}

// --- Textures ---------------------------------------------------------------

/** Fine circumferential machining marks (roughness), for turned brass and nickel. */
function turnedRoughness(seed: number, base: number) {
  const rand = rng(seed);
  const { c, g } = canvas(16, 512);
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, 16, 512);
  for (let y = 0; y < 512; y++) {
    const v = Math.round(base + (rand() - 0.5) * 70);
    g.fillStyle = `rgba(${v},${v},${v},0.6)`;
    g.fillRect(0, y, 16, 1);
  }
  return tex(c, false);
}

/** Copper jacket of the projectile; fired = with land/groove engravings and striations. */
function jacketTextures(fired: boolean, bearing: [number, number]) {
  const rand = rng(fired ? 91 : 90);
  const W = 1024;
  const H = 1024;
  const { c, g } = canvas(W, H);
  const { c: bc, g: bg } = canvas(W, H);
  const { c: rc, g: rg } = canvas(W, H);
  g.fillStyle = '#c87a4e';
  g.fillRect(0, 0, W, H);
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, W, H);
  rg.fillStyle = '#4a4a4a';
  rg.fillRect(0, 0, W, H);
  // Subtle tone variation and drawing lines along the jacket.
  for (let i = 0; i < 260; i++) {
    const x = rand() * W;
    g.fillStyle = `rgba(${rand() < 0.5 ? '90,40,20' : '255,210,170'},${0.03 + rand() * 0.05})`;
    g.fillRect(x, 0, 1 + rand() * 2, H);
  }
  // Canvas rows: y = (1 - v) * H (textures are flipped).
  const yOf = (v: number) => (1 - v) * H;
  const [v0, v1] = bearing;
  if (fired) {
    // 6 land impressions (grooves engraved by the barrel lands), right-hand twist.
    const landW = (2.49 / (Math.PI * 9.02)) * W;
    const shift = ((BEARING + 2) / TWIST) * W; // horizontal drift over the engraved length
    const top = yOf(Math.min(1, v1 + 0.06));
    const bottom = yOf(v0 + 0.01);
    for (let k = 0; k < 6; k++) {
      const x0 = (k / 6) * W + 40;
      for (const [ctx, fill] of [[g, 'rgba(242,180,140,0.55)'], [bg, '#3a3a3a'], [rg, '#2a2a2a']] as const) {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(x0, bottom);
        ctx.lineTo(x0 + landW, bottom);
        ctx.lineTo(x0 + landW + shift, top);
        ctx.lineTo(x0 + shift, top);
        ctx.closePath();
        ctx.fill();
      }
      // Micro-striations inside each impression: the individual marks compared under the microscope.
      for (let s = 0; s < 34; s++) {
        const o = rand() * landW;
        const w = 0.6 + rand() * 1.6;
        const dark = rand() < 0.5;
        g.strokeStyle = dark ? `rgba(80,30,10,${0.25 + rand() * 0.3})` : `rgba(255,225,200,${0.25 + rand() * 0.35})`;
        bg.strokeStyle = dark ? 'rgba(0,0,0,0.6)' : 'rgba(110,110,110,0.7)';
        for (const ctx of [g, bg]) {
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x0 + o, bottom);
          ctx.lineTo(x0 + o + shift, top);
          ctx.stroke();
        }
      }
    }
  }
  const map = tex(c, true);
  map.wrapS = RepeatWrapping;
  const bumpMap = tex(bc, false);
  bumpMap.wrapS = RepeatWrapping;
  const roughnessMap = tex(rc, false);
  roughnessMap.wrapS = RepeatWrapping;
  return { map, bumpMap, roughnessMap };
}

/** Case head: headstamp letters; fired adds breech-face lines, ejector and extractor marks. */
function headTextures(fired: boolean) {
  const S = 1024;
  const { c, g } = canvas(S);
  const { c: bc, g: bg } = canvas(S);
  g.fillStyle = '#d6a45a';
  g.fillRect(0, 0, S, S);
  bg.fillStyle = '#808080';
  bg.fillRect(0, 0, S, S);
  const rand = rng(fired ? 71 : 70);
  // Radial grain of the stamped head.
  for (let i = 0; i < 400; i++) {
    const a = rand() * Math.PI * 2;
    g.strokeStyle = `rgba(${rand() < 0.5 ? '120,80,30' : '255,230,170'},${0.04 + rand() * 0.05})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(S / 2 + Math.cos(a) * 240, S / 2 + Math.sin(a) * 240);
    g.lineTo(S / 2 + Math.cos(a) * 512, S / 2 + Math.sin(a) * 512);
    g.stroke();
  }
  // Headstamp: stamped letters (darker + recessed in the bump map).
  const text = ['A', 'G', '✦', '9', 'm', 'm', ' ', 'L', 'U', 'G', 'E', 'R', '✦'];
  const r = S * 0.37;
  for (const [ctx, col] of [[g, 'rgba(92,60,20,0.85)'], [bg, '#2a2a2a']] as const) {
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.font = '700 64px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    text.forEach((ch, i) => {
      const a = (i / text.length) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(ch, 0, -r);
      ctx.restore();
    });
    ctx.restore();
  }
  if (fired) {
    // Breech-face marks: fine parallel lines pressed into the head on firing.
    g.save();
    bg.save();
    for (const ctx of [g, bg]) {
      ctx.translate(S / 2, S / 2);
      ctx.rotate(0.5);
    }
    for (let i = -60; i < 60; i++) {
      const y = i * 7 + rand() * 3;
      g.fillStyle = `rgba(90,60,25,${0.08 + rand() * 0.12})`;
      g.fillRect(-500, y, 1000, 1.5);
      bg.fillStyle = `rgba(40,40,40,${0.2 + rand() * 0.3})`;
      bg.fillRect(-500, y, 1000, 1.5);
    }
    g.restore();
    bg.restore();
    // Ejector mark (on the head, near the rim) and extractor mark (at the rim edge).
    const mark = (ang: number, rad: number, w: number, h: number) => {
      for (const [ctx, col] of [[g, 'rgba(70,45,15,0.9)'], [bg, '#1e1e1e']] as const) {
        ctx.save();
        ctx.translate(S / 2 + Math.cos(ang) * rad, S / 2 + Math.sin(ang) * rad);
        ctx.rotate(ang);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 6);
        ctx.fill();
        ctx.restore();
      }
    };
    mark(EJECTOR_ANGLE, S * 0.43, 46, 34);
    mark(EXTRACTOR_ANGLE, S * 0.49, 20, 70);
  }
  // Primer pocket hole in the middle is covered by the primer mesh.
  const map = tex(c, true);
  const bumpMap = tex(bc, false);
  return { map, bumpMap };
}

/** Primer face: fired = firing-pin crater + breech-face lines. */
function primerBump(fired: boolean) {
  const S = 256;
  const { c, g } = canvas(S);
  g.fillStyle = '#909090';
  g.fillRect(0, 0, S, S);
  if (fired) {
    const rand = rng(81);
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(0.5);
    for (let i = -20; i < 20; i++) {
      g.fillStyle = `rgba(40,40,40,${0.25 + rand() * 0.35})`;
      g.fillRect(-150, i * 7, 300, 1.5);
    }
    g.restore();
  }
  return tex(c, false);
}

// Angles on the case head (canvas, y down). In the base view the head is shown
// with these at 12 o'clock (extractor) and 5 o'clock (ejector).
const EJECTOR_ANGLE = 1.05;
const EXTRACTOR_ANGLE = -Math.PI / 2;
const BASE_VIEW_SPIN = 0; // model rotation while the base view is held

export function mountBullet(el: HTMLElement, opts: Options = {}): BulletController | null {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(pointer: coarse)').matches;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null; // No WebGL: the poster image stays.
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  pmrem.dispose();
  scene.environmentIntensity = 1.05;
  const camera = new PerspectiveCamera(26, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  // Studio lighting: warm key, cool steel rim, soft fill.
  const key = new DirectionalLight(0xfff0dc, 2.6);
  key.position.set(-4, 6, 6);
  const rim = new DirectionalLight(0xc7ced8, 2.6);
  rim.position.set(5, 2, -6);
  const fill = new DirectionalLight(0xffffff, 0.5);
  fill.position.set(2, -4, 5);
  scene.add(key, rim, fill);

  // --- Materials ---------------------------------------------------------
  const brass = new MeshPhysicalMaterial({
    color: 0xd9a65e, metalness: 1, roughness: 0.24, roughnessMap: turnedRoughness(3, 150), clearcoat: 0.35, clearcoatRoughness: 0.2,
  });
  const nickel = new MeshPhysicalMaterial({ color: 0xcfd0cc, metalness: 1, roughness: 0.3, bumpScale: 1.2 });
  const bearingV: [number, number] = [0.02, 0.4]; // updated below from the bullet profile
  const head = { clean: headTextures(false), fired: headTextures(true) };
  const headMat = new MeshPhysicalMaterial({ ...head.clean, color: 0xffffff, metalness: 1, roughness: 0.3, bumpScale: 2.2,
    polygonOffset: true, polygonOffsetFactor: -2 });
  const primerFace = { clean: primerBump(false), fired: primerBump(true) };

  // --- Case (with primer pocket, flash hole and real interior) -------------
  const caseProfile: [number, number][] = [
    [0.75, 2.9], [POCKET_R, 2.9], [POCKET_R, 0], [RIM_R - 0.14, 0], [RIM_R, 0.14], [RIM_R, 0.9], [GROOVE_R, 1.35],
    [GROOVE_R, 1.85], [BASE_R, 2.4], [MOUTH_R, CASE_LEN], [MOUTH_R - 0.3, CASE_LEN], [4.5, 7.2], [4.15, 4.4], [1.5, 3.8],
    [0.75, 3.8], [0.75, 2.9],
  ];
  const caseMesh = new Mesh(lathe(caseProfile).geo, brass);
  // Headstamp disc over the case head.
  const headDisc = new Mesh(new RingGeometry(POCKET_R * MM, (RIM_R - 0.14) * MM, 128, 1), headMat);
  headDisc.rotation.x = Math.PI / 2; // faces -y (the head)
  headDisc.position.y = -0.0004;
  // Ring UVs are planar on the disc: map the canvas across the full rim diameter.
  {
    const uv = headDisc.geometry.attributes.uv as BufferAttribute;
    const pos = headDisc.geometry.attributes.position as BufferAttribute;
    const R = RIM_R * MM;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * R), 0.5 + pos.getY(i) / (2 * R));
  }

  // --- Primer (cup with a firing-pin crater once fired) ---------------------
  const primerProfile = (dent: number): [number, number][] => [
    [0, dent], [0.35, dent * 0.92], [0.6, dent * 0.55], [0.82, 0.02], [2.1, 0.0], [2.17, 0.07], [2.17, 2.6], [0, 2.6],
  ];
  const primerClean = new Mesh(lathe(primerProfile(0.0001), 96, 1).geo, nickel);
  const primerFired = new Mesh(lathe(primerProfile(0.32), 96, 1).geo, nickel.clone());
  (primerFired.material as MeshPhysicalMaterial).bumpMap = primerFace.fired;
  // Planar UVs on the face so the breech-face lines run straight.
  for (const m of [primerClean, primerFired]) {
    const uv = m.geometry.attributes.uv as BufferAttribute;
    const pos = m.geometry.attributes.position as BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / 0.5, 0.5 + pos.getZ(i) / 0.5);
  }
  const primer = new Group();
  primer.add(primerClean, primerFired);
  primerFired.visible = false;

  // --- Projectile (124 gr full metal jacket, round nose) --------------------
  const bulletProfile: [number, number][] = [[0, 0], [BULLET_R - 0.25, 0], [BULLET_R, 0.3]];
  for (let k = 1; k <= 8; k++) bulletProfile.push([BULLET_R, 0.3 + ((BEARING - 0.3) * k) / 8]);
  const OGIVE = BULLET_LEN - BEARING;
  for (let k = 1; k <= 40; k++) {
    const s = k / 40;
    // Round-nose ogive with a small flat meplat.
    const r = BULLET_R * Math.pow(1 - Math.pow(s, 2.1), 0.55);
    bulletProfile.push([Math.max(r, k === 40 ? 0 : 0.4), BEARING + OGIVE * s]);
  }
  bulletProfile.push([0, BULLET_LEN]);
  const bl = lathe(bulletProfile, 160, 3);
  bearingV[0] = bl.arc(2);
  bearingV[1] = bl.arc(11);
  const jacket = { clean: jacketTextures(false, bearingV), fired: jacketTextures(true, bearingV) };
  const copper = new MeshPhysicalMaterial({ ...jacket.clean, color: 0xffffff, metalness: 1, roughness: 0.2, bumpScale: 2.5,
    clearcoat: 0.2, clearcoatRoughness: 0.25 });
  const bulletMesh = new Mesh(bl.geo, copper);
  bulletMesh.position.y = SEAT * MM;

  // --- Powder (ball powder grains, graphite-coated) -------------------------
  const GRAINS = touch ? 220 : 420;
  const powderMat = new MeshPhysicalMaterial({ color: 0x23272b, metalness: 0.4, roughness: 0.35, clearcoat: 0.6 });
  const powder = new InstancedMesh(new SphereGeometry(0.028, 10, 8), powderMat, GRAINS);
  powder.instanceMatrix.setUsage(DynamicDrawUsage);
  const pr = rng(5);
  const grains = Array.from({ length: GRAINS }, () => {
    const a = pr() * Math.PI * 2;
    const inR = Math.sqrt(pr()) * 0.38;
    const outR = 0.08 + Math.pow(pr(), 0.7) * 0.75;
    return {
      inside: new Vector3(Math.cos(a) * inR, 0.45 + pr() * 1.3, Math.sin(a) * inR),
      outside: new Vector3(Math.cos(a) * outR, (CASE_LEN + 0.8) * MM + pr() * 0.95, Math.sin(a) * outR),
      s: 0.7 + pr() * 0.7,
      q: new Quaternion().setFromAxisAngle(new Vector3(pr(), pr(), pr()).normalize(), pr() * 6),
    };
  });

  // --- Rig: cartridge axis = local y; "model" spins about it ---------------
  const rig = new Group();
  const model = new Group();
  const caseGroup = new Group();
  caseGroup.add(caseMesh, headDisc, primer);
  const bulletGroup = new Group();
  bulletGroup.add(bulletMesh);
  model.add(caseGroup, bulletGroup, powder);
  rig.add(model);
  scene.add(rig);

  // --- Lesson keyframes (scroll progress) ----------------------------------
  // rx, rz: rig tilt; s: zoom; c: model centre along the axis (cm);
  // ex: explode; po: powder out; bo/co: projectile/case leave; fi: fired.
  type K = { p: number; rx: number; rz: number; s: number; c: number; ex: number; po: number; bo: number; co: number; fi: number };
  const H = Math.PI / 2;
  const KEYS: K[] = [
    { p: 0, rx: 0.32, rz: -H + 0.62, s: 1, c: 1.485, ex: 0, po: 0, bo: 0, co: 0, fi: 0 },
    { p: 0.14, rx: 0.28, rz: -H + 0.5, s: 1, c: 1.485, ex: 0, po: 0, bo: 0, co: 0, fi: 0 },
    { p: 0.24, rx: 0.1, rz: -H, s: 0.9, c: 1.62, ex: 0, po: 0, bo: 0, co: 0, fi: 0 },
    { p: 0.36, rx: 0.12, rz: -H, s: 0.72, c: 1.95, ex: 1, po: 1, bo: 0, co: 0, fi: 0 },
    { p: 0.47, rx: 0.12, rz: -H, s: 0.72, c: 1.95, ex: 1, po: 1, bo: 0, co: 0, fi: 0 },
    // Base view: nearly head-on, the case body behind the head, so labels have room around it.
    { p: 0.56, rx: -H + 0.36, rz: -0.12, s: 1.5, c: 0.25, ex: 0, po: 0, bo: 1, co: 0, fi: 1 },
    { p: 0.68, rx: -H + 0.32, rz: -0.1, s: 1.5, c: 0.25, ex: 0, po: 0, bo: 1, co: 0, fi: 1 },
    { p: 0.79, rx: 0.16, rz: -H, s: 1.45, c: (SEAT + BULLET_LEN / 2) * MM, ex: 0, po: 0, bo: 0, co: 1, fi: 1 },
    { p: 1, rx: 0.16, rz: -H, s: 1.45, c: (SEAT + BULLET_LEN / 2) * MM, ex: 0, po: 0, bo: 0, co: 1, fi: 1 },
  ];
  const stateAt = (p: number): K => {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const u = smooth(seg(p, a.p, b.p));
    const out = { ...a };
    for (const k of Object.keys(a) as (keyof K)[]) out[k] = a[k] + (b[k] - a[k]) * u;
    return out;
  };

  // Label anchors in model space (cm), with the progress window they show in.
  const ANCHORS: { id: string; at: () => Vector3; from: number; to: number; r?: number }[] = [
    // Exploded view: points on the axis; the page draws the label above or below.
    { id: 'proyectil', at: () => new Vector3(0, bulletGroup.position.y + (SEAT + 6) * MM, 0), from: 0.31, to: 0.5, r: BULLET_R * MM },
    { id: 'polvora', at: () => new Vector3(0, (CASE_LEN + 5) * MM, 0), from: 0.31, to: 0.5, r: 0.6 },
    { id: 'vaina', at: () => new Vector3(0, 1.0, 0), from: 0.31, to: 0.5, r: BASE_R * MM },
    { id: 'fulminante', at: () => new Vector3(0, primer.position.y - 0.1, 0), from: 0.31, to: 0.5, r: POCKET_R * MM },
    { id: 'percutor', at: () => new Vector3(0, -0.01, 0), from: 0.54, to: 0.72, r: RIM_R * MM },
    // Head texture angle a (canvas, y down) sits at model (cos a, −sin a) on the head.
    { id: 'eyector', at: () => new Vector3(Math.cos(EJECTOR_ANGLE) * 0.43, -0.01, -Math.sin(EJECTOR_ANGLE) * 0.43), from: 0.54, to: 0.72 },
    { id: 'extractor', at: () => new Vector3(Math.cos(EXTRACTOR_ANGLE) * RIM_R * MM, 0.02, -Math.sin(EXTRACTOR_ANGLE) * RIM_R * MM), from: 0.54, to: 0.72 },
    { id: 'marcaje', at: () => new Vector3(Math.cos(Math.PI) * 0.37, -0.01, -Math.sin(Math.PI) * 0.37), from: 0.54, to: 0.72 },
    { id: 'estria', at: () => new Vector3(0, (SEAT + 3.5) * MM, 0), from: 0.77, to: 1.01, r: BULLET_R * MM },
    { id: 'ojiva', at: () => new Vector3(0, (SEAT + BULLET_LEN - 3) * MM, 0), from: 0.77, to: 1.01, r: 0.33 },
  ];

  // --- State, interaction and render loop ---------------------------------
  let lost = false; // WebGL context taken away by the browser (memory, app switch)
  let goal = 0;
  let at = 0;
  let spin = 0; // idle spin about the cartridge axis
  let drag = 0; // user drag (radians)
  let dragVel = 0;
  let fired = -1;
  let raf = 0;
  let visible = true;
  let last = performance.now();
  const idle = !touch && !reduceMotion;

  const setFired = (f: boolean) => {
    if (fired === Number(f)) return;
    fired = Number(f);
    primerClean.visible = !f;
    primerFired.visible = f;
    Object.assign(headMat, f ? head.fired : head.clean);
    Object.assign(copper, f ? jacket.fired : jacket.clean);
    headMat.needsUpdate = true;
    copper.needsUpdate = true;
  };
  const fade = (mats: MeshPhysicalMaterial[], o: number) => {
    for (const m of mats) {
      m.opacity = o;
      const t = o < 0.999;
      if (m.transparent !== t) {
        m.transparent = t;
        m.needsUpdate = true;
      }
    }
  };
  const tmp = new Matrix4();
  const one = new Vector3();
  let lastPo = -1;
  const placePowder = (po: number) => {
    if (Math.abs(po - lastPo) < 0.002) return;
    lastPo = po;
    powder.visible = po > 0.01;
    const e = smooth(po);
    grains.forEach((gr, i) => {
      one.lerpVectors(gr.inside, gr.outside, e);
      tmp.compose(one, gr.q, new Vector3(gr.s, gr.s * 0.75, gr.s));
      powder.setMatrixAt(i, tmp);
    });
    powder.instanceMatrix.needsUpdate = true;
  };

  const v = new Vector3();
  const v2 = new Vector3();
  const apply = (p: number) => {
    const st = stateAt(p);
    rig.rotation.set(st.rx, 0, st.rz);
    rig.scale.setScalar(st.s);
    model.position.y = -st.c;
    // The base view holds still so its marks and labels can be read; elsewhere it turns.
    const turn = spin + p * Math.PI * 2.2 - BASE_VIEW_SPIN;
    const wrapped = turn - Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
    const hold = Math.min(seg(p, 0.5, 0.56), 1 - seg(p, 0.7, 0.76));
    model.rotation.y = BASE_VIEW_SPIN + wrapped * (1 - smooth(hold)) + drag;
    const ex = smooth(st.ex);
    bulletGroup.position.y = ex * 1.6 + st.bo * 4;
    primer.position.y = -ex * 0.7;
    caseGroup.position.y = -st.co * 4.5;
    fade([copper], 1 - smooth(st.bo));
    fade([brass, headMat, nickel, primerFired.material as MeshPhysicalMaterial], 1 - smooth(st.co));
    bulletGroup.visible = st.bo < 0.995;
    caseGroup.visible = st.co < 0.995;
    placePowder(st.po);
    setFired(st.fi > 0.5);
  };

  const labels = () => {
    if (!opts.onLabels) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    model.updateWorldMatrix(true, true);
    opts.onLabels(
      ANCHORS.map((a) => {
        v.copy(a.at());
        model.localToWorld(v);
        // Screen-space radius: the part's radius measured along the screen's vertical.
        v2.copy(v).add(new Vector3(0, (a.r ?? 0) * rig.scale.x, 0)).project(camera);
        v.project(camera);
        const o = Math.min(seg(at, a.from, a.from + 0.04), 1 - seg(at, a.to - 0.04, a.to));
        return { id: a.id, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, opacity: o, reach: Math.abs(v2.y - v.y) * 0.5 * h };
      }),
    );
  };

  const resize = () => {
    const { width, height } = el.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    // Same framing as the square poster: fit the width on portrait frames, the height on wide ones.
    camera.position.z = 10 * Math.max(1, 1 / camera.aspect);
    camera.updateProjectionMatrix();
    wake();
  };

  const tick = (now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    at = reduceMotion || Math.abs(goal - at) < 0.0004 ? goal : at + (goal - at) * (1 - Math.exp(-dt * 6));
    if (idle) spin += dt * 0.35;
    if (Math.abs(dragVel) > 0.0005 && !dragging) {
      drag += dragVel;
      dragVel *= Math.pow(0.04, dt);
    }
    apply(at);
    renderer.render(scene, camera);
    labels();
    const busy = idle || at !== goal || dragging || Math.abs(dragVel) > 0.0005;
    raf = busy && visible && !document.hidden ? requestAnimationFrame(tick) : 0;
  };
  function wake() {
    if (!raf && visible && !document.hidden && !lost) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  // Drag to turn the cartridge about its axis (horizontal drags only; vertical scrolls the page).
  let dragging = false;
  let px = 0;
  renderer.domElement.style.touchAction = 'pan-y';
  renderer.domElement.addEventListener('pointerdown', (e) => {
    dragging = true;
    px = e.clientX;
    dragVel = 0;
    wake();
  });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const d = (e.clientX - px) * 0.012;
    px = e.clientX;
    drag += d;
    dragVel = d;
  });
  const end = () => (dragging = false);
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);

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
  resize();
  new ResizeObserver(resize).observe(el);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    wake();
  }).observe(el);
  document.addEventListener('visibilitychange', wake);
  apply(0);
  wake();

  return {
    scrub(progress) {
      goal = clamp01(progress);
      wake();
    },
  };
}
