/**
 * Bakes posed human figures into LiDAR-style point clouds for the 3D crime scene.
 *
 * Source model: "Xbot" (Mixamo, distributed with the three.js examples):
 *   https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/models/gltf/Xbot.glb
 * Usage: node scripts/scan/bake-figures.mjs path/to/Xbot.glb [--preview out.json]
 *
 * Each pose is built by aiming limb segments at world directions (character
 * facing +Z, its right hand on −X), the skinned mesh is frozen in that pose,
 * and its surface is sampled. Output: public/scan/<name>.bin
 *   header  : uint32 count
 *   per pt  : int16 x, y, z (millimetres) + uint8 shade (0–255, lambert-ish)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import {
  AnimationMixer, Box3, BufferAttribute, BufferGeometry, Mesh, Quaternion, Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

const [file, flag, previewOut] = process.argv.slice(2);
const buf = readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));

// Deterministic random for the sampler.
let seed = 12345;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function figure() {
  // Fresh copy for every pose.
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', (g) => res(g), rej));
}

const v = (x, y, z) => new Vector3(x, y, z).normalize();

/** Rotate `bone` so the segment bone→child points along world `dir`. */
function aim(root, boneName, childName, dir) {
  const bone = root.getObjectByName('mixamorig' + boneName);
  const child = root.getObjectByName('mixamorig' + childName);
  root.updateMatrixWorld(true);
  const a = bone.getWorldPosition(new Vector3());
  const b = child.getWorldPosition(new Vector3());
  const cur = b.sub(a).normalize();
  const q = new Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
  const boneWorld = bone.getWorldQuaternion(new Quaternion());
  const parentWorld = bone.parent.getWorldQuaternion(new Quaternion());
  bone.quaternion.copy(parentWorld.invert().multiply(q).multiply(boneWorld));
  root.updateMatrixWorld(true);
}

const POSES = {
  // Two-handed aim (weaver stance), slightly forward-leaning.
  shooter: (r) => {
    aim(r, 'Spine', 'Spine1', v(0, 1, 0.08));
    aim(r, 'RightArm', 'RightForeArm', v(0.32, -0.08, 1));
    aim(r, 'RightForeArm', 'RightHand', v(0.12, 0.02, 1));
    aim(r, 'LeftArm', 'LeftForeArm', v(-0.42, -0.12, 1));
    aim(r, 'LeftForeArm', 'LeftHand', v(-0.05, 0.03, 1));
    aim(r, 'LeftUpLeg', 'LeftLeg', v(0.08, -1, 0.18));
    aim(r, 'LeftLeg', 'LeftFoot', v(0.05, -1, 0.02));
    aim(r, 'RightUpLeg', 'RightLeg', v(-0.1, -1, -0.16));
    aim(r, 'RightLeg', 'RightFoot', v(-0.05, -1, -0.08));
  },
  // On the back: one arm by the head, the other out, left knee raised.
  victim: (r) => {
    aim(r, 'RightArm', 'RightForeArm', v(-0.75, 0.55, 0.05));
    aim(r, 'RightForeArm', 'RightHand', v(-0.35, 0.9, 0.05));
    aim(r, 'LeftArm', 'LeftForeArm', v(0.85, -0.45, 0.05));
    aim(r, 'LeftForeArm', 'LeftHand', v(0.7, -0.6, 0.25));
    aim(r, 'LeftUpLeg', 'LeftLeg', v(0.12, -0.75, 0.62));
    aim(r, 'LeftLeg', 'LeftFoot', v(0.05, -0.95, -0.3));
    aim(r, 'RightUpLeg', 'RightLeg', v(-0.16, -1, 0));
    aim(r, 'RightLeg', 'RightFoot', v(-0.1, -1, 0.02));
    const head = r.getObjectByName('mixamorigHead');
    head.rotation.y += 0.55;
    r.updateMatrixWorld(true);
  },
  // Forensic examiner photographing evidence: camera held at the face.
  perito: (r) => {
    aim(r, 'Spine', 'Spine1', v(0, 1, 0.22));
    aim(r, 'Neck', 'Head', v(0, 1, 0.3));
    aim(r, 'RightArm', 'RightForeArm', v(-0.35, -0.55, 0.75));
    aim(r, 'RightForeArm', 'RightHand', v(0.45, 0.75, 0.45));
    aim(r, 'LeftArm', 'LeftForeArm', v(0.35, -0.55, 0.75));
    aim(r, 'LeftForeArm', 'LeftHand', v(-0.45, 0.75, 0.45));
    aim(r, 'LeftUpLeg', 'LeftLeg', v(0.1, -1, 0.1));
    aim(r, 'RightUpLeg', 'RightLeg', v(-0.1, -1, -0.05));
  },
};

const COUNTS = { shooter: 8000, victim: 8000, perito: 7000 };
const LIGHT = new Vector3(-0.4, 0.8, 0.45).normalize();
mkdirSync('public/scan', { recursive: true });
const preview = {};

for (const [name, pose] of Object.entries(POSES)) {
  const g = await figure();
  const root = g.scene;
  // Start from the first frame of the "idle" clip (natural rest, arms down).
  const idle = g.animations.find((a) => a.name === 'idle');
  const mixer = new AnimationMixer(root);
  mixer.clipAction(idle).play();
  mixer.update(0);
  root.updateMatrixWorld(true);
  pose(root);

  // Freeze every skinned mesh in the pose.
  const parts = [];
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    const pos = o.geometry.attributes.position;
    const out = new Float32Array(pos.count * 3);
    const t = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      t.fromBufferAttribute(pos, i);
      o.applyBoneTransform(i, t);
      t.applyMatrix4(o.matrixWorld);
      out.set([t.x, t.y, t.z], i * 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(out, 3));
    if (o.geometry.index) geo.setIndex(o.geometry.index);
    geo.computeVertexNormals();
    parts.push(new Mesh(geo));
  });

  // Sample by area across parts.
  const area = (m) => {
    const p = m.geometry.attributes.position, idx = m.geometry.index;
    let s = 0;
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(p, idx.getX(i)); b.fromBufferAttribute(p, idx.getX(i + 1)); c.fromBufferAttribute(p, idx.getX(i + 2));
      s += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    return s;
  };
  const areas = parts.map(area);
  const total = areas.reduce((x, y) => x + y, 0);
  const pts = [];
  parts.forEach((m, k) => {
    const n = Math.round((COUNTS[name] * areas[k]) / total);
    const s = new MeshSurfaceSampler(m).setRandomGenerator(rand).build();
    const p = new Vector3(), nrm = new Vector3();
    for (let i = 0; i < n; i++) {
      s.sample(p, nrm);
      pts.push([p.x, p.y, p.z, Math.max(0, nrm.dot(LIGHT))]);
    }
  });

  // Victim: lay on the back (head towards −Z, face up).
  if (name === 'victim') for (const q of pts) [q[1], q[2]] = [-q[2], q[1]];
  // Feet on the floor, centred on x/z.
  const box = new Box3().setFromPoints(pts.map((q) => new Vector3(q[0], q[1], q[2])));
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, y0 = box.min.y;
  const bin = Buffer.alloc(4 + pts.length * 7);
  bin.writeUInt32LE(pts.length, 0);
  pts.forEach((q, i) => {
    const o = 4 + i * 7;
    bin.writeInt16LE(Math.round((q[0] - cx) * 1000), o);
    bin.writeInt16LE(Math.round((q[1] - y0) * 1000), o + 2);
    bin.writeInt16LE(Math.round((q[2] - cz) * 1000), o + 4);
    bin.writeUInt8(Math.round(60 + 195 * q[3]), o + 6);
  });
  writeFileSync(`public/scan/${name}.bin`, bin);
  console.log(name, pts.length, 'pts', (bin.length / 1024).toFixed(1) + ' KB', 'size', box.getSize(new Vector3()).toArray().map((x) => x.toFixed(2)).join(' x '));
  if (flag === '--preview') preview[name] = pts.map((q) => [q[0] - cx, q[1] - y0, q[2] - cz]);
}
if (flag === '--preview') writeFileSync(previewOut, JSON.stringify(preview));
