/**
 * Solid people for the 3D crime scene and the scanner "wave".
 *
 * Figures: forensic mannequins with real human proportions, posed and baked
 * offline (scripts/figures/bake-figures.mjs → public/figures/*.bin, ~130 KB each).
 *
 * Scan wave: a brass band that sweeps over every surface from the 3D laser
 * scanner's position when the scene appears, like the scanner documenting
 * the room. Injected into the standard materials (no extra render pass).
 */
import { BufferAttribute, BufferGeometry, Color, Mesh, Vector3, type Material } from 'three';

/** Load a baked figure: one mesh, two groups (0 = body surface, 1 = joints). */
export async function loadFigure(url: string, surface: Material, joints: Material) {
  const buf = await (await fetch(url)).arrayBuffer();
  const view = new DataView(buf);
  const nv = view.getUint32(0, true);
  const ni = view.getUint32(4, true);
  const nSurface = view.getUint32(8, true);
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  let o = 12;
  for (let i = 0; i < nv; i++, o += 6) {
    pos[i * 3] = view.getInt16(o, true) / 1000;
    pos[i * 3 + 1] = view.getInt16(o + 2, true) / 1000;
    pos[i * 3 + 2] = view.getInt16(o + 4, true) / 1000;
  }
  for (let i = 0; i < nv; i++, o += 4) {
    nrm[i * 3] = view.getInt8(o) / 127;
    nrm[i * 3 + 1] = view.getInt8(o + 1) / 127;
    nrm[i * 3 + 2] = view.getInt8(o + 2) / 127;
  }
  const idx = new Uint16Array(buf, o, ni);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('normal', new BufferAttribute(nrm, 3));
  geo.setIndex(new BufferAttribute(idx, 1));
  geo.addGroup(0, nSurface, 0);
  geo.addGroup(nSurface, ni - nSurface, 1);
  const mesh = new Mesh(geo, [surface, joints]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Shared uniforms of the scan wave (origin, radius in metres, colour). */
export const scanWave = {
  uScanOrigin: { value: new Vector3() },
  uScanRadius: { value: 1e4 },
  uScanColor: { value: new Color(0xe3c27a) },
};

/** Add the scan wave to a standard/physical material. */
export function withScanWave(material: Material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    Object.assign(shader.uniforms, scanWave);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vScanWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvScanWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vScanWorld;\nuniform vec3 uScanOrigin;\nuniform float uScanRadius;\nuniform vec3 uScanColor;',
      )
      .replace(
        '#include <dithering_fragment>',
        `float scanD = distance(vScanWorld, uScanOrigin) - uScanRadius;
        float scanBand = exp(-scanD * scanD * 18.0);
        float scanLines = 0.55 + 0.45 * step(0.5, fract(vScanWorld.y * 14.0));
        gl_FragColor.rgb += uScanColor * scanBand * scanLines * 0.9;
        #include <dithering_fragment>`,
      );
  };
  material.needsUpdate = true;
}
