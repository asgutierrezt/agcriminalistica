/**
 * Evidence shown in the demo crime scene. Positions are in scene metres (x, z on
 * the floor). The same data renders the HTML cards, so the content is readable
 * without WebGL and indexable by search engines.
 */
export interface SceneEvidence {
  n: number;
  title: string;
  text: string;
  pos: [number, number];
  link: { href: string; label: string };
}

export const SCENE_EVIDENCE: SceneEvidence[] = [
  {
    n: 1,
    title: 'Vaina servida',
    text: 'La vaina expulsada por el arma ayuda a estimar la posición del tirador y, con balística comparativa, a identificar el arma que la disparó.',
    pos: [-2.9, 1.2],
    link: { href: '/glosario/#vaina', label: 'Qué es una vaina' },
  },
  {
    n: 2,
    title: 'Huella de calzado',
    text: 'Las huellas de pisada muestran recorridos y número de personas, y pueden cotejarse con el calzado de un sospechoso.',
    pos: [-0.9, 0.3],
    link: { href: '/glosario/#huella-de-calzado', label: 'Huellas de calzado' },
  },
  {
    n: 3,
    title: 'Mancha hemática',
    text: 'La forma y distribución de las manchas de sangre permiten inferir la dinámica, la posición de la víctima y la secuencia de los hechos.',
    pos: [1.1, -0.9],
    link: { href: '/glosario/#mancha-hematica', label: 'Manchas hemáticas' },
  },
  {
    n: 4,
    title: 'Impacto de proyectil',
    text: 'Unir el orificio de impacto con otros puntos de referencia permite reconstruir la trayectoria del disparo y la posición de quien disparó.',
    pos: [2.9, -3.5],
    link: { href: '/glosario/#trayectoria', label: 'Trayectoria balística' },
  },
  {
    n: 5,
    title: 'Teléfono celular',
    text: 'Los dispositivos hallados en la escena son evidencia digital: se aíslan, se preservan y su información se extrae con métodos forenses.',
    pos: [1.9, 1.4],
    link: { href: '/glosario/#evidencia-digital', label: 'Evidencia digital' },
  },
];

export const SCENE_VIEWS = [
  { id: 'orbital', label: 'Orbital' },
  { id: 'cenital', label: 'Cenital' },
  { id: 'testigo', label: 'Testigo' },
  { id: 'trayectoria', label: 'Trayectoria' },
] as const;

export type SceneViewId = (typeof SCENE_VIEWS)[number]['id'];
