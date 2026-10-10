/**
 * Curated reading list and basic kit for the "Biblioteca forense".
 * Only well-known titles and generic equipment; no prices are shown (Amazon's
 * rules forbid hard-coded prices).
 */
export type LibraryCategory = 'es' | 'en' | 'equipo';

export interface LibraryItem {
  id: string;
  cat: LibraryCategory;
  title: string;
  author?: string;
  topic: string;
  why: string;
  level?: 'Inicial' | 'Intermedio' | 'Avanzado';
  query?: string;
  asin?: string;
  /** Kindle edition ASIN, shown as a second button (no shipping, instant delivery). */
  kindle?: string;
  /** Format of the linked edition when it matters (e.g. 'Kindle'). */
  format?: string;
  /**
   * Product image URL exactly as Amazon provides it (SiteStripe "Imagen" or the
   * Product Advertising API), e.g. https://m.media-amazon.com/images/I/....jpg.
   * Amazon does not allow downloading and re-hosting its images.
   */
  image?: string;
}

export const LIBRARY_CATEGORIES: { id: LibraryCategory; label: string; desc: string }[] = [
  { id: 'es', label: 'Libros en español', desc: 'Clásicos de la criminalística y la criminología latinoamericana.' },
  { id: 'en', label: 'Libros en inglés', desc: 'Referencias internacionales usadas en laboratorios y universidades.' },
  { id: 'equipo', label: 'Equipo para estudiantes', desc: 'Lo básico para practicar técnicas de campo y fotografía forense.' },
];

export const LIBRARY: LibraryItem[] = [
  // --- Español
  {
    id: 'montiel-criminalistica', cat: 'es', title: 'Criminalística', author: 'Juventino Montiel Sosa', topic: 'Criminalística general', level: 'Inicial',
    why: 'Obra de referencia en Latinoamérica: metodología, escena del crimen e indicios explicados paso a paso. Hoy es difícil de conseguir nuevo; el enlace muestra las ediciones disponibles.',
    query: 'Criminalistica Juventino Montiel Sosa',
  },
  {
    id: 'moreno-introduccion', cat: 'es', title: 'Introducción a la Criminalística', author: 'Rafael Moreno González', topic: 'Criminalística general', level: 'Inicial',
    why: 'Un clásico para empezar: historia, principios y ramas de la criminalística en lenguaje claro.',
    query: 'Introduccion a la Criminalistica Rafael Moreno Gonzalez',
    asin: '9700760928',
  },
  {
    id: 'rodriguez-criminologia', cat: 'es', title: 'Criminología', author: 'Luis Rodríguez Manzanera', topic: 'Criminología', level: 'Inicial', format: 'Kindle',
    why: 'El manual de criminología más usado en universidades de habla hispana.',
    query: 'Criminologia Luis Rodriguez Manzanera',
    asin: 'B0D64LZG34',
  },
  {
    id: 'es-dactiloscopia', cat: 'es', title: 'La dactiloscopia al alcance de todos', topic: 'Dactiloscopia', level: 'Inicial',
    why: 'Introducción accesible en español a la identificación por huellas dactilares.',
    query: 'dactiloscopia libro',
    asin: '849761819X',
  },
  {
    id: 'es-peritaje', cat: 'es', title: 'Libros sobre peritaje e informe pericial', topic: 'Prueba pericial', level: 'Intermedio',
    why: 'Para preparar informes periciales sólidos y defenderlos en audiencia.',
    query: 'peritaje judicial informe pericial libro',
  },
  // --- English
  {
    id: 'saferstein', cat: 'en', title: 'Criminalistics: An Introduction to Forensic Science', author: 'Richard Saferstein', topic: 'Ciencias forenses', level: 'Inicial',
    why: 'El texto introductorio más usado en el mundo: cubre casi todas las disciplinas forenses.',
    query: 'Saferstein Criminalistics An Introduction to Forensic Science',
    asin: '0134477596',
  },
  {
    id: 'james-nordby', cat: 'en', title: 'Forensic Science: An Introduction to Scientific and Investigative Techniques', author: 'Stuart H. James y Jon J. Nordby', topic: 'Ciencias forenses', level: 'Intermedio',
    why: 'Capítulos escritos por especialistas de cada área, de la balística a la entomología.',
    query: 'Forensic Science An Introduction to Scientific and Investigative Techniques James Nordby',
    asin: '1032525215', kindle: 'B0F197ZSQR',
  },
  {
    id: 'fisher', cat: 'en', title: 'Techniques of Crime Scene Investigation', author: 'Barry A. J. Fisher', topic: 'Escena del crimen', level: 'Intermedio',
    why: 'Referencia clásica sobre cómo procesar una escena: búsqueda, documentación y recolección.',
    query: 'Techniques of Crime Scene Investigation Fisher',
    asin: '1498758134', kindle: 'B0CW1K2X4B',
  },
  {
    id: 'geberth', cat: 'en', title: 'Practical Homicide Investigation', author: 'Vernon J. Geberth', topic: 'Investigación de homicidios', level: 'Avanzado',
    why: 'Considerado la "biblia" de la investigación de homicidios por investigadores de todo el mundo.',
    query: 'Practical Homicide Investigation Geberth',
    asin: '1482235072', kindle: 'B0HJHWTL7H',
  },
  {
    id: 'robinson', cat: 'en', title: 'Crime Scene Photography', author: 'Edward M. Robinson', topic: 'Fotografía forense', level: 'Intermedio',
    why: 'Todo sobre fijación fotográfica: encuadres, iluminación, escalas y fotografía de indicios.',
    query: 'Crime Scene Photography Edward Robinson',
    asin: '0128027649',
  },
  {
    id: 'bevel-gardner', cat: 'en', title: 'Bloodstain Pattern Analysis with an Introduction to Crime Scene Reconstruction', author: 'Tom Bevel y Ross M. Gardner', topic: 'Manchas hemáticas', level: 'Avanzado',
    why: 'Texto de referencia para interpretar manchas de sangre y reconstruir la dinámica de los hechos.',
    query: 'Bloodstain Pattern Analysis Bevel Gardner',
    asin: '1032528508', kindle: 'B0F5NCWJXC',
  },
  {
    id: 'heard', cat: 'en', title: 'Handbook of Firearms and Ballistics', author: 'Brian J. Heard', topic: 'Balística', level: 'Avanzado',
    why: 'Balística forense explicada de forma completa: armas, municiones, trayectorias e identificación.',
    query: 'Handbook of Firearms and Ballistics Heard',
    asin: '0470694602', kindle: 'B005UQCXIQ',
  },
  {
    id: 'casey', cat: 'en', title: 'Digital Evidence and Computer Crime', author: 'Eoghan Casey', topic: 'Informática forense', level: 'Intermedio',
    why: 'El libro de cabecera para la evidencia digital y la investigación de delitos informáticos.',
    query: 'Digital Evidence and Computer Crime Eoghan Casey',
    asin: '0123742684',
  },
  {
    id: 'bertino', cat: 'en', title: 'Forensic Science: Fundamentals & Investigations', author: 'Anthony J. Bertino', topic: 'Ciencias forenses', level: 'Inicial',
    why: 'Ideal para empezar: muy visual, con actividades prácticas y casos.',
    query: 'Forensic Science Fundamentals and Investigations Bertino',
    asin: '0357124987',
  },
  // --- Equipment
  {
    id: 'kit-huellas', cat: 'equipo', title: 'Kit de revelado de huellas dactilares', topic: 'Dactiloscopia',
    why: 'Polvos reveladores, brochas y cinta de levantamiento para practicar el revelado de huellas latentes.',
    query: 'fingerprint kit forensic powder brush lifting tape',
  },
  {
    id: 'brocha-magnetica', cat: 'equipo', title: 'Brocha magnética y polvo magnético', topic: 'Dactiloscopia',
    why: 'Revela huellas en superficies difíciles con menos riesgo de dañarlas.',
    query: 'magnetic fingerprint powder wand',
    asin: 'B013J8IWNQ',
  },
  {
    id: 'testigo-metrico', cat: 'equipo', title: 'Testigo métrico (escala fotográfica forense)', topic: 'Fotografía forense',
    why: 'Escala fotomacrográfica en L (n.º 2, métrica) para fotografiar indicios con referencia de tamaño real.',
    query: 'forensic photo scale ruler L-shaped evidence',
    asin: 'B00UVX8MEW',
  },
  {
    id: 'linterna-uv', cat: 'equipo', title: 'Linterna UV de 365 nm recargable', topic: 'Búsqueda de indicios',
    why: 'Luz negra de 365 nm: ayuda a localizar fluidos y fibras que no se ven con luz normal.',
    query: 'UV flashlight 365nm',
    asin: 'B0F9W34NXC',
  },
  {
    id: 'lupa', cat: 'equipo', title: 'Lupa triple 10x con luz LED y UV', topic: 'Observación',
    why: 'Para estudiar crestas papilares, fibras y detalles de documentos; la luz UV ayuda a revisar documentos.',
    query: 'jeweler loupe 10x LED',
    asin: 'B00MMYNX38',
  },
  {
    id: 'bolsas-evidencia', cat: 'equipo', title: 'Bolsas con sello a prueba de manipulación (100 u.)', topic: 'Cadena de custodia',
    why: 'Bolsas de seguridad con cierre inviolable: sirven para practicar el embalaje y la cadena de custodia.',
    query: 'tamper evident evidence bags',
    asin: 'B07G13WRLG',
  },
  {
    id: 'guantes', cat: 'equipo', title: 'Guantes de nitrilo desechables', topic: 'Bioseguridad',
    why: 'Imprescindibles para manipular indicios sin contaminarlos.',
    query: 'nitrile gloves powder free',
    asin: 'B0CKWK2KJD',
  },
];

/** Picks a few items for a given topic area, used as "Para profundizar" boxes. */
export function pickFor(ids: string[]) {
  return ids.map((id) => LIBRARY.find((i) => i.id === id)).filter((i): i is LibraryItem => !!i);
}
