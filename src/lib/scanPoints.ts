/**
 * "Forensic 3D scan" look for the crime scene: the modelled room is turned
 * into a coloured point cloud, like the output of the terrestrial laser
 * scanners (LiDAR) used to document real scenes. Surfaces are sampled with
 * their real texture colours (tiles, wood grain, rug), and a brass scan wave
 * sweeps the cloud once from the scanner's position.
 *
 * Human figures are baked offline into small binary point clouds
 * (scripts/scan/bake-figures.mjs → public/scan/*.bin).
 */
import {
  BufferAttribute, BufferGeometry, Color, Matrix3, Mesh, Points, ShaderMaterial, Texture, Vector2, Vector3,
  type Material, type MeshStandardMaterial,
} from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

const BONE = new Color(0.94, 0.91, 0.85);
const LIGHT = new Vector3(-0.35, 0.85, 0.4).normalize();

/** Point material: round points sized in metres, revealed by a scan wave. */
export function scanMaterial(opts: { size: number; scale: number; opacity?: number }) {
  return new ShaderMaterial({
    uniforms: {
      uSize: { value: opts.size }, // point diameter in metres
      uScale: { value: opts.scale }, // px per metre at 1 m (viewport height / 2 / tan(fov / 2))
      uOrigin: { value: new Vector3() },
      uRadius: { value: 1e4 }, // scan wave radius (m): the glowing front travels outwards
      uDim: { value: 1 }, // overall brightness (luminol mode darkens the cloud)
      uOpacity: { value: opts.opacity ?? 1 },
      uWave: { value: new Color(0xe3c27a) }, // brass glow on the wave front
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      uniform float uSize, uScale, uRadius;
      uniform vec3 uOrigin;
      varying vec3 vColor;
      varying float vFront;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        float d = distance(world.xyz, uOrigin);
        vFront = 1.0 - smoothstep(0.0, 0.45, abs(uRadius - d));
        vColor = color;
        vec4 mv = viewMatrix * world;
        gl_Position = projectionMatrix * mv;
        float px = uSize * uScale / max(-mv.z, 0.05);
        gl_PointSize = clamp(px, 1.0, 9.0) * (1.0 + vFront * 0.8);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDim, uOpacity;
      uniform vec3 uWave;
      varying vec3 vColor;
      varying float vFront;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = dot(c, c);
        if (r > 0.25) discard;
        vec3 col = mix(vColor * uDim, uWave * 1.25, vFront);
        gl_FragColor = vec4(col, uOpacity);
      }`,
    toneMapped: false,
  });
}

/** Average texture texels, read once per canvas texture. */
const texCache = new WeakMap<Texture, { data: Uint8ClampedArray; w: number; h: number } | null>();
function texels(t: Texture) {
  if (texCache.has(t)) return texCache.get(t)!;
  let out: { data: Uint8ClampedArray; w: number; h: number } | null = null;
  const img = t.image as HTMLCanvasElement | undefined;
  if (img && 'getContext' in img) {
    const g = img.getContext('2d');
    if (g) out = { data: g.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
  }
  texCache.set(t, out);
  return out;
}

const triArea = (a: Vector3, b: Vector3, c: Vector3) => new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).length() / 2;

/** World-space surface area of a mesh. */
function worldArea(m: Mesh) {
  const g = m.geometry;
  const p = g.attributes.position;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  let s = 0;
  const n = g.index ? g.index.count : p.count;
  const at = (i: number) => (g.index ? g.index.getX(i) : i);
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, at(i)).applyMatrix4(m.matrixWorld);
    b.fromBufferAttribute(p, at(i + 1)).applyMatrix4(m.matrixWorld);
    c.fromBufferAttribute(p, at(i + 2)).applyMatrix4(m.matrixWorld);
    s += triArea(a, b, c);
  }
  return s;
}

/**
 * Sample meshes into one coloured point cloud (world space).
 * `weight` lets big flat surfaces (the floor) take fewer points per m².
 */
export function sampleMeshes(
  meshes: Mesh[], budget: number, rand: () => number,
  weight: (m: Mesh) => number = () => 1, tone: (m: Mesh) => number = () => 1,
) {
  const areas = meshes.map((m) => worldArea(m) * weight(m));
  const total = areas.reduce((x, y) => x + y, 0) || 1;
  const pos: number[] = [];
  const col: number[] = [];
  const p = new Vector3(), n = new Vector3(), uv = new Vector2(), c = new Color(), nm = new Matrix3();
  meshes.forEach((m, k) => {
    const count = Math.max(4, Math.round((budget * areas[k]) / total));
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as MeshStandardMaterial;
    const base = (mat as { color?: Color }).color ?? BONE;
    const map = (mat as { map?: Texture | null }).map ?? null;
    const tx = map ? texels(map) : null;
    const k2 = tone(m);
    const sampler = new MeshSurfaceSampler(m);
    // Deterministic sampling (typed loosely: older typings lack setRandomGenerator).
    (sampler as unknown as { setRandomGenerator(r: () => number): void }).setRandomGenerator(rand);
    sampler.build();
    nm.getNormalMatrix(m.matrixWorld);
    for (let i = 0; i < count; i++) {
      sampler.sample(p, n, undefined, uv);
      p.applyMatrix4(m.matrixWorld);
      n.applyMatrix3(nm).normalize();
      c.copy(base);
      if (map && tx) {
        map.transformUv(uv);
        const x = Math.min(tx.w - 1, Math.floor(uv.x * tx.w));
        const y = Math.min(tx.h - 1, Math.floor(uv.y * tx.h));
        const o = (y * tx.w + x) * 4;
        if (tx.data[o + 3] < 110) continue; // transparent part of a decal (stain edges): nothing to scan
        c.setRGB((tx.data[o] / 255) * base.r, (tx.data[o + 1] / 255) * base.g, (tx.data[o + 2] / 255) * base.b);
      } else {
        c.convertLinearToSRGB();
      }
      // Scanner look: real colour pulled towards a warm white, lit by a fixed light.
      const shade = 0.36 + 0.5 * Math.max(0, n.dot(LIGHT)) + (rand() - 0.5) * 0.06;
      c.lerp(BONE, 0.12).multiplyScalar(shade * k2);
      pos.push(p.x, p.y, p.z);
      col.push(c.r, c.g, c.b);
    }
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  return geo;
}

/**
 * A flat floor scanned on a jittered grid (clean, even rows like a real scan
 * instead of random clumps), coloured from its texture.
 */
export function gridFloor(size: number, step: number, map: Texture | null, tone: number, rand: () => number) {
  const tx = map ? texels(map) : null;
  const pos: number[] = [];
  const col: number[] = [];
  const uv = new Vector2();
  const c = new Color();
  const n = Math.floor(size / step);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = -size / 2 + (i + 0.5 + (rand() - 0.5) * 0.35) * step;
      const z = -size / 2 + (j + 0.5 + (rand() - 0.5) * 0.35) * step;
      c.copy(BONE);
      if (map && tx) {
        uv.set(x / size + 0.5, 0.5 - z / size);
        map.transformUv(uv);
        const o = (Math.min(tx.h - 1, Math.floor(uv.y * tx.h)) * tx.w + Math.min(tx.w - 1, Math.floor(uv.x * tx.w))) * 4;
        c.setRGB(tx.data[o] / 255, tx.data[o + 1] / 255, tx.data[o + 2] / 255);
      }
      c.lerp(BONE, 0.12).multiplyScalar(tone * (0.9 + (rand() - 0.5) * 0.08));
      pos.push(x, 0.002, z);
      col.push(c.r, c.g, c.b);
    }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  return geo;
}

/**
 * Box-shaped meshes (walls) scanned on a jittered grid over each face, for
 * clean even surfaces. Colour: the material colour, lit per face.
 */
export function gridBoxes(meshes: Mesh[], step: number, tone: number, rand: () => number) {
  const pos: number[] = [];
  const col: number[] = [];
  const p = new Vector3(), n = new Vector3(), c = new Color();
  for (const m of meshes) {
    const { width: W, height: H, depth: D } = (m.geometry as unknown as { parameters: { width: number; height: number; depth: number } }).parameters;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as MeshStandardMaterial;
    const base = mat.color.clone().convertLinearToSRGB();
    const nm = new Matrix3().getNormalMatrix(m.matrixWorld);
    // Each face: normal axis, the two in-plane axes and their sizes.
    const faces: [Vector3, number, number, number, number][] = [
      [new Vector3(1, 0, 0), W / 2, D, H, 0], [new Vector3(-1, 0, 0), W / 2, D, H, 0],
      [new Vector3(0, 0, 1), D / 2, W, H, 1], [new Vector3(0, 0, -1), D / 2, W, H, 1],
      [new Vector3(0, 1, 0), H / 2, W, D, 2], [new Vector3(0, -1, 0), H / 2, W, D, 2],
    ];
    for (const [nrm, off, a, b, kind] of faces) {
      if (kind === 2 && nrm.y < 0) continue; // never seen from below
      const na = Math.max(1, Math.round(a / step)), nb = Math.max(1, Math.round(b / step));
      n.copy(nrm).applyMatrix3(nm).normalize();
      const shade = (0.36 + 0.5 * Math.max(0, n.dot(LIGHT))) * tone;
      for (let i = 0; i < na; i++)
        for (let j = 0; j < nb; j++) {
          const u = -a / 2 + (i + 0.5 + (rand() - 0.5) * 0.35) * (a / na);
          const v = -b / 2 + (j + 0.5 + (rand() - 0.5) * 0.35) * (b / nb);
          if (kind === 0) p.set(nrm.x * off, v, u);
          else if (kind === 1) p.set(u, v, nrm.z * off);
          else p.set(u, nrm.y * off, v);
          p.applyMatrix4(m.matrixWorld);
          c.copy(base).lerp(BONE, 0.12).multiplyScalar(shade * (0.94 + (rand() - 0.5) * 0.1));
          pos.push(p.x, p.y, p.z);
          col.push(c.r, c.g, c.b);
        }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  return geo;
}

/** Load a baked figure (int16 mm xyz + uint8 shade per point) tinted with `tint`. */
export async function loadFigure(url: string, tint: Color) {
  const buf = await (await fetch(url)).arrayBuffer();
  const view = new DataView(buf);
  const count = view.getUint32(0, true);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const o = 4 + i * 7;
    pos[i * 3] = view.getInt16(o, true) / 1000;
    pos[i * 3 + 1] = view.getInt16(o + 2, true) / 1000;
    pos[i * 3 + 2] = view.getInt16(o + 4, true) / 1000;
    const s = (view.getUint8(o + 6) / 255) * 1.1;
    col[i * 3] = tint.r * s;
    col[i * 3 + 1] = tint.g * s;
    col[i * 3 + 2] = tint.b * s;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  return geo;
}

export function pointsOf(geo: BufferGeometry, material: Material) {
  const p = new Points(geo, material);
  p.frustumCulled = false;
  return p;
}
