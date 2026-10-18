/**
 * Interactive 3D crime-scene reconstruction used on the home page and the 3D
 * reconstruction service. Loaded on demand by CrimeScene3D.astro; named
 * imports keep the three.js bundle tree-shaken.
 *
 * Visual style: a clean "clay render" like professional forensic animations —
 * lit, shadowed room and furniture, full-body mannequins (victim on the
 * floor, shooter at the doorway), real evidence tents, red trajectory rods
 * and physical traces (casing, blood pool, shoe prints, phone, bullet hole).
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
  ACESFilmicToneMapping, BoxGeometry, BufferGeometry, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, CircleGeometry,
  Color, CylinderGeometry, DirectionalLight, DoubleSide, Fog, Group, HemisphereLight, Line, LineBasicMaterial, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, Raycaster,
  RepeatWrapping, RingGeometry, Scene, SphereGeometry, Spherical, Sprite, SpriteMaterial, SRGBColorSpace, TubeGeometry,
  Vector2, Vector3, WebGLRenderer, type Material,
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

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b9bec4';
  g.fillRect(0, 0, 256, 256);
  // Subtle tile variation + joints (each texture tile = 0.5 m).
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
      g.fillRect(i * 128, j * 128, 128, 128);
    }
  g.strokeStyle = 'rgba(60,70,80,0.35)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  g.beginPath();
  g.moveTo(128, 0); g.lineTo(128, 256);
  g.moveTo(0, 128); g.lineTo(256, 128);
  g.stroke();
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function numberTexture(n: number) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f5b70a';
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
  const g = c.getContext('2d')!;
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
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.background = new Color(0x0d1825);
  scene.fog = new Fog(0x0d1825, 16, 30);
  const camera = new PerspectiveCamera(36, 1, 0.05, 80);

  // --- Light -------------------------------------------------------------
  scene.add(new HemisphereLight(0xe8f0f8, 0x3a4250, 1.15));
  const sun = new DirectionalLight(0xfff4e6, 2.1);
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
  const floor = new Mesh(new PlaneGeometry(8, 8), new MeshStandardMaterial({ map: floorTexture(), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const outside = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ color: 0x15202c, roughness: 1 }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.01;
  outside.receiveShadow = true;
  scene.add(outside);

  const wallMat = mat(0xdcdfe3, 0.95);
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
  solid(new BoxGeometry(0.04, 2.05, 1.05), mat(0x7a5a3c, 0.7), -3.9, 1.025, 2.8);
  // Baseboards.
  const base = mat(0x8b939c, 0.6);
  solid(new BoxGeometry(8, 0.08, 0.02), base, 0, 0.04, -3.99);
  solid(new BoxGeometry(0.02, 0.08, 8), base, -3.99, 0.04, 0);

  // --- Furniture -----------------------------------------------------------
  const wood = mat(0x8a6a4a, 0.65);
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
  const fabric = mat(0x2c5c80, 0.95);
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
  solid(new BoxGeometry(0.38, 1.9, 1.2), mat(0x6f5640, 0.7), 0, 0.95, 0, shelf);
  const bookColors = [0x9c2f2f, 0x2f5f9c, 0xd9b44a, 0x3d7a4f, 0x444b55];
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 7; i++)
      solid(new BoxGeometry(0.22, 0.26 + (i % 3) * 0.03, 0.1), mat(bookColors[(i + row) % 5], 0.8), -0.08, 0.35 + row * 0.55, -0.45 + i * 0.14, shelf);

  // Rug.
  const rug = decal(new PlaneGeometry(2.4, 1.6), mat(0x8c7a64, 1), -0.4, 1.6, 0.003);
  rug.material = new MeshStandardMaterial({ color: 0x8c7a64, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });

  // --- People ----------------------------------------------------------------
  const victimMat = mat(0xd4d7db, 0.55);
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
  const shooterMat = new MeshStandardMaterial({ color: 0x7f9bb8, roughness: 0.5, transparent: true, opacity: 0 });
  const shooter = mannequin(shooterMat, {
    armR: [0, 0.32, Math.PI / 2 - 0.05], armL: [0, -0.32, Math.PI / 2 - 0.05],
    legR: [0, 0, -0.12], legL: [0, 0, 0.1],
  });
  shooter.root.position.copy(origin);
  shooter.root.rotation.y = Math.atan2(-(impactPoint.z - origin.z), impactPoint.x - origin.x);
  scene.add(shooter.root);
  solid(new BoxGeometry(0.17, 0.03, 0.035), shooterMat, 0.06, -0.02, -0.18, shooter.handR);

  // --- Physical traces ------------------------------------------------------
  const bloodMat = new MeshStandardMaterial({ color: 0x5c0b10, roughness: 0.25, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2 });
  const pool = decal(new CircleGeometry(0.34, 40), bloodMat, 0.98, -0.78, 0.005);
  pool.scale.set(1.25, 0.85, 1);
  pool.rotation.z = 0.6;
  for (const [x, z, r] of [[1.3, -1.1, 0.04], [1.42, -1.22, 0.028], [1.2, -1.3, 0.022], [0.55, -0.95, 0.03]])
    decal(new CircleGeometry(r, 16), bloodMat, x, z, 0.005);
  const shoeMat = new MeshBasicMaterial({ color: 0x2a2f36, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const [x, z, rot] of [[-0.95, 0.35, 0.9], [-1.25, 0.6, 0.9], [-1.55, 0.82, 0.9]]) {
    const s = decal(new CircleGeometry(0.055, 18), shoeMat, x, z, 0.004);
    s.scale.set(1, 2.3, 1);
    s.rotation.z = rot;
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

  // --- Evidence tents (clickable) ---------------------------------------------
  const tentGeo = new PlaneGeometry(0.16, 0.17);
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
  const originLabel = textSprite('ORIGEN', '#08131f', '#1ba3e0', 0.034);
  originLabel.position.set(origin.x, 2.15, origin.z);

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
    trayectoria: () => ({ pos: new Vector3(-3.82, 1.95, 2.35), target: new Vector3(1.8, 1.25, -2.6) }),
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
      key(0.12, far([7.6, 1.7, 7.6], [0.3, 0.7, 0.1]), [0.3, 0.7, 0.1]),
      key(0.28, far([6.0, 3.6, 5.4], [-0.4, 0.2, -0.5]), [-0.4, 0.2, -0.5]),
      key(0.38, far([5.6, 3.9, 4.6], [-0.3, 0.2, -0.6]), [-0.3, 0.2, -0.6]),
      key(0.5, far([0.35, 12.5, 0.95], [0.1, 0, -0.1]), [0.1, 0, -0.1]),
      key(0.58, far([0.3, 12.6, 0.9], [0.1, 0, -0.1]), [0.1, 0, -0.1]),
      key(0.7, far([-3.55, 2.7, 3.75], [1.5, 1.05, -2.3]), [1.5, 1.05, -2.3]),
      key(0.8, far([-3.4, 2.9, 3.85], [1.3, 1.0, -2.1]), [1.3, 1.0, -2.1]),
      key(0.93, orbit.pos, orbit.target),
      key(1, orbit.pos, orbit.target),
    ];
  };
  // Timeline on the same scroll: markers in act 2, measurements in act 3,
  // shooter and trajectories in act 4, everything settled by the end.
  const tourTime = (p: number) =>
    p < 0.2 ? 0 : p < 0.38 ? 2.05 * seg(p, 0.2, 0.38) : p < 0.62 ? 2.05 : 2.05 + (DURATION - 2.05) * seg(p, 0.62, 0.86);
  const tourMeasure = (p: number) => seg(p, 0.44, 0.56);
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
  // Phones (and reduced motion) render on demand: the scene stays still and only
  // redraws while something moves, so the CPU and battery stay idle.
  const onDemand = small || reduceMotion || tour;
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
      scene.fog = new Fog(0x0d1825, 16 * k, 30 * k);
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

  el.appendChild(renderer.domElement);
  el.classList.add('is-live');

  // --- Timeline -------------------------------------------------------------
  let shooterShadows = false;
  const applyTime = (time: number, meas = seg(time, 4.7, 5.3)) => {
    markers.forEach((m, i) => {
      const p = ease(seg(time, 0.4 + i * 0.32, 0.75 + i * 0.32));
      m.visible = p > 0.01;
      // Slightly larger than life (x1.5) so the numbers read in wide views.
      const s = Math.max(0.001, 1.5 * p * (selected === i ? 1.35 : 1));
      m.scale.set(s, s, s);
    });
    const fig = seg(time, 2.1, 2.8);
    shooterMat.opacity = fig;
    shooterMat.transparent = fig < 1;
    shooterMat.depthWrite = fig > 0.5;
    shooter.root.visible = fig > 0.01;
    if (fig > 0.6 !== shooterShadows) {
      shooterShadows = fig > 0.6;
      shooter.root.traverse((o) => (o.castShadow = shooterShadows));
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
    if (tour) {
      // Glide towards the scroll position instead of jumping with each wheel step.
      tourAt = reduceMotion || Math.abs(tourGoal - tourAt) < 0.0004 ? tourGoal : tourAt + (tourGoal - tourAt) * (1 - Math.exp(-dt * 7));
      t = tourTime(tourAt);
      applyTime(t, tourMeasure(tourAt));
      placeTour(tourAt);
    } else applyTime(t);
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
    if (!onDemand) impact.scale.setScalar(1 + Math.sin(now / 330) * 0.12);
    const moved = !tour && controls.update();
    renderer.render(scene, camera);
    const busy = !onDemand || playing || tween !== null || moved || selected !== null || tourAt !== tourGoal;
    raf = busy && visible && !document.hidden ? requestAnimationFrame(tick) : 0;
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
    scrub(progress) {
      tourGoal = clamp01(progress);
      wake();
    },
  };
}
