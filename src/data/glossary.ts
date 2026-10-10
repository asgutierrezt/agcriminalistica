/**
 * Forensic glossary. Short, general definitions for readers and search
 * engines; each term gets an anchor at /glosario/#<id>. `see` links to other
 * terms, articles or services.
 */
export interface GlossaryTerm {
  id: string;
  term: string;
  def: string;
  see?: { href: string; label: string }[];
}

const T = (id: string, term: string, def: string, see?: GlossaryTerm['see']): GlossaryTerm => ({ id, term, def, see });

const svc3d = { href: '/servicios/reconstruccion-3d-de-hechos/', label: 'Reconstrucción 3D' };
const svcPeritaje = { href: '/servicios/peritaje-criminalistico/', label: 'Peritaje criminalístico' };
const svcConsult = { href: '/servicios/consultoria-para-abogados/', label: 'Consultoría para abogados' };

export const GLOSSARY: GlossaryTerm[] = [
  T('antropometria', 'Antropometría forense', 'Medición de las dimensiones del cuerpo humano con fines de identificación o para comparar características físicas entre personas, por ejemplo la estatura o la ventaja física entre víctima y victimario.', [{ href: '/feminicidios/', label: 'Investigación del femicidio' }]),
  T('arma-de-fuego', 'Arma de fuego', 'Instrumento que lanza proyectiles mediante la fuerza de los gases producidos por la combustión de una carga propulsora. Su estudio forense corresponde a la balística.', [{ href: '#balistica', label: 'Balística' }]),
  T('autopsia', 'Autopsia médico-legal', 'Examen del cadáver realizado por un médico legista para determinar la causa, el mecanismo y la data de la muerte, y documentar lesiones relevantes para la investigación.', [{ href: '#necropsia', label: 'Necropsia' }]),
  T('balistica', 'Balística forense', 'Disciplina que estudia las armas de fuego, sus municiones y los efectos de los disparos. Se divide en balística interior, exterior y de efectos, y permite identificar armas y reconstruir disparos.', [{ href: '#trayectoria', label: 'Trayectoria' }, svc3d]),
  T('cadena-de-custodia', 'Cadena de custodia', 'Procedimiento documentado que garantiza la identidad, integridad y trazabilidad de los indicios desde su hallazgo hasta su presentación en juicio, registrando a cada persona que los manipula.', [{ href: '/cadena-de-custodia/', label: 'Artículo: cadena de custodia' }, svcConsult]),
  T('contrapericia', 'Contrapericia', 'Peritaje que analiza y, cuando corresponde, refuta las conclusiones de otro informe pericial, señalando errores de método, falta de sustento o problemas en la cadena de custodia.', [svcConsult]),
  T('criminalistica', 'Criminalística', 'Ciencia que aplica el método científico al estudio de la evidencia física para responder qué ocurrió, dónde, cómo y quién intervino en un hecho presuntamente delictivo.', [{ href: '/investigacion-criminalistica/', label: 'Investigación criminalística' }]),
  T('criminologia', 'Criminología', 'Disciplina que estudia el fenómeno criminal: sus causas, la conducta del delincuente, la víctima y el control social. A diferencia de la criminalística, no trabaja principalmente sobre la evidencia física.'),
  T('dactiloscopia', 'Dactiloscopia', 'Rama de la papiloscopía que identifica a las personas por los dibujos formados por las crestas papilares de las yemas de los dedos.', [{ href: '/dactiloscopia/', label: 'Artículo: dactiloscopia' }, { href: '/manual-dactiloscopia/', label: 'Manual gratuito' }]),
  T('data-de-muerte', 'Data de muerte', 'Estimación del tiempo transcurrido desde el fallecimiento, basada en fenómenos cadavéricos como el enfriamiento, la rigidez y las livideces.'),
  T('dictamen-pericial', 'Dictamen pericial', 'Conclusión técnica que el perito emite sobre el objeto de la pericia. En la práctica se usa como sinónimo de informe pericial.', [{ href: '#informe-pericial', label: 'Informe pericial' }]),
  T('documentologia', 'Documentología', 'Disciplina que examina documentos para establecer su autenticidad, detectar alteraciones o falsificaciones y estudiar firmas, tintas y soportes.'),
  T('embalaje', 'Embalaje', 'Acondicionamiento de cada indicio en un contenedor adecuado a su naturaleza, sellado y rotulado, para evitar su pérdida, contaminación o alteración.', [{ href: '#cadena-de-custodia', label: 'Cadena de custodia' }]),
  T('escena-del-crimen', 'Escena del crimen', 'Lugar donde ocurrió un hecho presuntamente delictivo o donde se encuentran indicios relacionados con él. Debe protegerse para evitar su contaminación.', [svc3d]),
  T('evidencia', 'Evidencia', 'Indicio que, tras ser analizado, permite demostrar o descartar un hecho o la participación de una persona en él.', [{ href: '#indicio', label: 'Indicio' }]),
  T('evidencia-digital', 'Evidencia digital', 'Información almacenada o transmitida en formato digital —teléfonos, computadoras, redes— con valor probatorio. Debe preservarse con métodos forenses para no alterar su contenido.', [{ href: '/courses/informatica-forense/', label: 'Curso de informática forense' }]),
  T('fijacion', 'Fijación de la escena', 'Registro detallado de la escena y de cada indicio tal como se encontraron, mediante descripción escrita, fotografía, video y planimetría.', [{ href: '#planimetria', label: 'Planimetría' }]),
  T('fotografia-forense', 'Fotografía forense', 'Registro fotográfico técnico de la escena, los indicios y las lesiones, con tomas generales, medias y de detalle, normalmente con testigo métrico.'),
  T('hipotesis', 'Hipótesis criminalística', 'Explicación provisional de cómo ocurrieron los hechos, que debe contrastarse con los indicios. La reconstrucción permite comparar hipótesis distintas.', [svc3d]),
  T('huella-de-calzado', 'Huella de calzado', 'Marca que deja la suela de un zapato sobre una superficie. Permite establecer recorridos, número de personas y compararla con el calzado de un sospechoso.'),
  T('huella-dactilar', 'Huella dactilar', 'Impresión que dejan las crestas papilares de los dedos. Puede ser visible, moldeada o latente; estas últimas requieren reveladores para hacerse visibles.', [{ href: '#dactiloscopia', label: 'Dactiloscopia' }]),
  T('identificacion-de-voz', 'Identificación forense de la voz', 'Análisis de grabaciones de voz para determinar si pertenecen a una persona determinada, combinando métodos auditivos, acústicos y estadísticos.', [{ href: '/manual-identificacion-forense-de-la-voz/', label: 'Manual gratuito' }]),
  T('indicio', 'Indicio', 'Todo objeto, marca, sustancia o rastro hallado en relación con un hecho que puede aportar información a la investigación.', [{ href: '#evidencia', label: 'Evidencia' }, { href: '#cadena-de-custodia', label: 'Cadena de custodia' }]),
  T('informe-pericial', 'Informe pericial', 'Documento en el que el perito expone su análisis, metodología y conclusiones sobre el objeto de la pericia. En Ecuador su estructura se rige por el Reglamento del Sistema Pericial Integral.', [{ href: '/el-informe-pericial/', label: 'Artículo: el informe pericial' }, svcPeritaje]),
  T('informatica-forense', 'Informática forense', 'Aplicación de técnicas científicas para identificar, preservar, analizar y presentar evidencia digital de forma válida ante la justicia.', [{ href: '/courses/informatica-forense/', label: 'Curso de informática forense' }]),
  T('inspeccion-ocular', 'Inspección ocular técnica', 'Examen sistemático del lugar de los hechos para buscar, fijar y levantar indicios. Es la primera diligencia criminalística en la escena.', [svcPeritaje]),
  T('levantamiento', 'Levantamiento de indicios', 'Recolección de cada indicio con la técnica y los materiales adecuados para no alterarlo, después de haberlo fijado.', [{ href: '#embalaje', label: 'Embalaje' }]),
  T('livideces', 'Livideces', 'Manchas rojo-violáceas que aparecen en las zonas declives del cadáver por acumulación de sangre. Ayudan a estimar la data de muerte y si el cuerpo fue movido.', [{ href: '#data-de-muerte', label: 'Data de muerte' }]),
  T('lugar-del-hallazgo', 'Lugar del hallazgo', 'Sitio donde se encuentra un cadáver o un indicio. Puede no coincidir con el lugar de los hechos si el cuerpo u objeto fue trasladado.'),
  T('mancha-hematica', 'Mancha hemática', 'Mancha de sangre. Su forma, tamaño y distribución (morfología) permiten inferir la dinámica de los hechos, la posición de las personas y la secuencia de lo ocurrido.'),
  T('metodo-cientifico', 'Método científico', 'Proceso de observación, hipótesis, experimentación y conclusión en el que se basa la investigación criminalística.'),
  T('necropsia', 'Necropsia', 'Examen del cadáver para determinar la causa de muerte. En el ámbito judicial se usa como sinónimo de autopsia médico-legal.', [{ href: '#autopsia', label: 'Autopsia médico-legal' }]),
  T('papiloscopia', 'Papiloscopía', 'Disciplina que estudia las crestas papilares de la piel de dedos (dactiloscopia), palmas (quiroscopia) y plantas de los pies (pelmatoscopia) con fines de identificación.', [{ href: '#dactiloscopia', label: 'Dactiloscopia' }]),
  T('perito', 'Perito', 'Profesional o experto en una ciencia, arte u oficio que auxilia a la justicia aportando conocimientos técnicos que el juez no posee. También se le llama testigo experto.', [{ href: '/cual-es-el-trabajo-de-un-perito/', label: 'Artículo: el trabajo del perito' }]),
  T('perito-de-parte', 'Perito de parte', 'Perito propuesto por una de las partes del proceso para aportar su propia prueba técnica o contrastar la de la parte contraria.', [svcPeritaje, svcConsult]),
  T('planimetria', 'Planimetría forense', 'Representación a escala de la escena y de la ubicación de los indicios mediante planos y croquis con medidas. Es base para la reconstrucción de los hechos.', [svc3d]),
  T('preservacion', 'Preservación de la escena', 'Medidas para proteger el lugar de los hechos y evitar que se alteren o contaminen los indicios, como el acordonamiento y el control de accesos.'),
  T('prueba-pericial', 'Prueba pericial', 'Medio de prueba basado en el conocimiento técnico o científico de un perito, que se incorpora al proceso mediante su informe y su sustentación en audiencia.', [svcPeritaje]),
  T('reconstruccion-3d', 'Reconstrucción 3D de los hechos', 'Recreación digital tridimensional del lugar y la secuencia de un hecho, elaborada a partir de la evidencia técnica, para analizar hipótesis y explicarlas en audiencia.', [svc3d]),
  T('reconstruccion-de-los-hechos', 'Reconstrucción de los hechos', 'Diligencia que busca reproducir cómo ocurrió un hecho para verificar versiones, testimonios e hipótesis con base en los indicios.', [svc3d]),
  T('ransomware', 'Ransomware', 'Software malicioso que cifra o bloquea la información de un equipo y exige un rescate para liberarla.', [{ href: '/un-ciberataque-que-deberia-preocuparnos-a-todos/', label: 'Artículo: el ataque a CNT' }]),
  T('rigidez-cadaverica', 'Rigidez cadavérica', 'Endurecimiento progresivo de los músculos después de la muerte. Su evolución ayuda a estimar la data de muerte.', [{ href: '#data-de-muerte', label: 'Data de muerte' }]),
  T('testigo-metrico', 'Testigo métrico', 'Regla o escala que se coloca junto a un indicio al fotografiarlo para registrar su tamaño real.', [{ href: '#fotografia-forense', label: 'Fotografía forense' }]),
  T('trayectoria', 'Trayectoria balística', 'Recorrido que sigue un proyectil desde el arma hasta su punto de impacto. Se reconstruye uniendo orificios e impactos para estimar la posición del tirador.', [svc3d, { href: '#balistica', label: 'Balística' }]),
  T('vaina', 'Vaina servida', 'Casquillo de un cartucho ya disparado. Su ubicación orienta sobre la posición del tirador y sus marcas permiten identificar el arma mediante balística comparativa.', [{ href: '#balistica', label: 'Balística' }]),
];

/** Strip accents for sorting/grouping and search. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const GLOSSARY_SORTED = [...GLOSSARY].sort((a, b) => fold(a.term).localeCompare(fold(b.term), 'es'));
