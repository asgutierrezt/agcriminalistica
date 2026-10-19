/**
 * Bakes posed human figures (solid, simplified meshes) for the 3D crime scene.
 *
 * Source model: "Xbot" (Mixamo, distributed with the three.js examples):
 *   https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/models/gltf/Xbot.glb
 * Usage: node scripts/scan/bake-figures.mjs path/to/Xbot.glb   (needs the meshoptimizer dev dependency)
 *
 * Each pose is built by aiming limb segments at world directions (character
 * facing +Z, its right hand on −X); the skinned mesh is frozen in that pose and
 * simplified to ~10k triangles. Output: public/figures/<name>.bin
 *   header : uint32 vertexCount, uint32 indexCount, uint32 surfaceIndexCount
 *   data   : int16 x, y, z (mm) per vertex · int8 normal + pad · uint16 indices
 *            (first surfaceIndexCount indices = body surface, the rest = joints)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { AnimationMixer, BufferAttribute, BufferGeometry, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer';

const [file] = process.argv.slice(2);
const buf = readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));

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

const TARGET_TRIS = { surface: 7000, joints: 3000 }; // per figure, after simplification
mkdirSync('public/figures', { recursive: true });
await MeshoptSimplifier.ready;

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

  // Freeze each skinned part (body surface, joints) in the pose, then simplify it.
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
      if (name === 'victim') t.set(t.x, t.z, -t.y); // lay on the back: face up, head towards −Z
      out.set([t.x, t.y, t.z], i * 3);
    }
    const kind = o.name.includes('Joints') ? 'joints' : 'surface';
    const idx = new Uint32Array(o.geometry.index.array);
    const [simple] = MeshoptSimplifier.simplify(idx, out, 3, TARGET_TRIS[kind] * 3, 0.02, ['LockBorder']);
    parts.push({ kind, pos: out, idx: simple });
  });

  // Compact: keep only the vertices the simplified triangles use; surface first, then joints.
  parts.sort((a) => (a.kind === 'surface' ? -1 : 1));
  const verts = [];
  const indices = [];
  const groups = [];
  for (const p of parts) {
    const remap = new Map();
    const startIdx = indices.length;
    for (const i of p.idx) {
      if (!remap.has(i)) {
        remap.set(i, verts.length / 3);
        verts.push(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]);
      }
      indices.push(remap.get(i));
    }
    groups.push([startIdx, indices.length - startIdx]);
  }
  // Normals of the simplified, posed mesh.
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, y0 = box.min.y;
  const nv = verts.length / 3;
  const nrm = geo.attributes.normal;
  // header: uint32 vertexCount, uint32 indexCount, uint32 surfaceIndexCount
  // then int16 xyz (mm) per vertex, int8 xyz normal (+1 pad), uint16 indices.
  const bin = Buffer.alloc(12 + nv * 6 + nv * 4 + indices.length * 2);
  bin.writeUInt32LE(nv, 0);
  bin.writeUInt32LE(indices.length, 4);
  bin.writeUInt32LE(groups[0][1], 8);
  let o = 12;
  for (let i = 0; i < nv; i++, o += 6) {
    bin.writeInt16LE(Math.round((verts[i * 3] - cx) * 1000), o);
    bin.writeInt16LE(Math.round((verts[i * 3 + 1] - y0) * 1000), o + 2);
    bin.writeInt16LE(Math.round((verts[i * 3 + 2] - cz) * 1000), o + 4);
  }
  for (let i = 0; i < nv; i++, o += 4) {
    bin.writeInt8(Math.round(nrm.getX(i) * 127), o);
    bin.writeInt8(Math.round(nrm.getY(i) * 127), o + 1);
    bin.writeInt8(Math.round(nrm.getZ(i) * 127), o + 2);
  }
  for (const i of indices) {
    bin.writeUInt16LE(i, o);
    o += 2;
  }
  writeFileSync(`public/figures/${name}.bin`, bin);
  const size = box.getSize(new Vector3());
  console.log(name, nv, 'verts', indices.length / 3, 'tris', (bin.length / 1024).toFixed(1) + ' KB', 'size', [size.x, size.y, size.z].map((x) => x.toFixed(2)).join(' x '));
}
