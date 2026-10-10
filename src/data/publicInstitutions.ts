/**
 * Public institutions of Ecuador for the standalone /informacion-util/ page.
 * AG Criminalística is a private company: this page points people who think
 * otherwise to the right public office. Data taken from each institution's
 * official website; review it when PUBLIC_INFO_REVIEWED gets old.
 */
export const PUBLIC_INFO_REVIEWED = new Date('2026-10-10');

export interface Phone {
  display: string;
  /** Digits for the tel: link. */
  tel: string;
  note?: string;
}

export interface Institution {
  id: string;
  name: string;
  what: string;
  phones: Phone[];
  address?: string[];
  hours?: string;
  /** Shown as plain text, never as a link. */
  web: string;
  notes?: string[];
  icon: 'phone' | 'shield' | 'gavel' | 'scale' | 'fingerprint' | 'users' | 'building';
}

export interface InstitutionGroup {
  id: string;
  title: string;
  intro: string;
  items: Institution[];
}

export const INSTITUTION_GROUPS: InstitutionGroup[] = [
  {
    id: 'emergencias',
    title: 'Emergencias',
    intro: 'Si alguien corre peligro, llama primero al 911.',
    items: [
      {
        id: 'ecu911',
        name: 'Servicio Integrado de Seguridad ECU 911',
        what: 'Atiende emergencias de seguridad, salud, tránsito, incendios y rescate en todo el país y coordina a la Policía, los Bomberos y los servicios de salud.',
        phones: [{ display: '911', tel: '911', note: 'Línea única de emergencias, las 24 horas. La llamada es gratuita.' }],
        web: 'www.ecu911.gob.ec',
        notes: ['También puedes pedir auxilio desde la aplicación ECU 911.'],
        icon: 'phone',
      },
    ],
  },
  {
    id: 'denuncias',
    title: 'Denuncias y delitos',
    intro: 'Las denuncias se presentan ante la Fiscalía. Nosotros no recibimos denuncias.',
    items: [
      {
        id: 'fiscalia',
        name: 'Fiscalía General del Estado',
        what: 'Recibe las denuncias (noticias del delito) y dirige la investigación penal. Tiene fiscalías en todas las provincias.',
        phones: [{ display: '(02) 398 5800', tel: '+59323985800', note: 'Central telefónica, Quito' }],
        address: ['Juan León Mera N19-36 y Av. Patria', 'Edificio Fiscalía General del Estado, Quito'],
        web: 'www.fiscalia.gob.ec',
        notes: ['En su sitio web puedes presentar una denuncia en línea y consultar el estado de una denuncia con tu número de cédula.'],
        icon: 'shield',
      },
      {
        id: 'policia',
        name: 'Policía Nacional del Ecuador',
        what: 'Seguridad ciudadana y auxilio inmediato. Para una emergencia, llama al 911.',
        phones: [
          {
            display: '1800 DELITO (1800 335 486)',
            tel: '1800335486',
            note: 'Para aportar información de forma confidencial sobre delitos o personas buscadas. No reemplaza a la denuncia formal.',
          },
        ],
        web: 'www.policia.gob.ec',
        icon: 'shield',
      },
    ],
  },
  {
    id: 'judicial',
    title: 'Procesos judiciales y peritos acreditados',
    intro: 'Los juicios, las audiencias y el registro oficial de peritos dependen de la Función Judicial.',
    items: [
      {
        id: 'judicatura',
        name: 'Consejo de la Judicatura (Función Judicial)',
        what: 'Administra las unidades judiciales del país, la consulta de procesos judiciales y el Sistema Pericial Integral, donde se registran y califican los peritos acreditados.',
        phones: [{ display: '(02) 395 3600', tel: '+59323953600', note: 'Central telefónica, Quito' }],
        address: ['Av. 12 de Octubre N24-563 y Francisco Salazar, Quito'],
        web: 'www.funcionjudicial.gob.ec',
        notes: [
          'Consulta de procesos judiciales (e-SATJE): con tu número de cédula, tu nombre o el número del proceso.',
          'El listado de peritos acreditados y los requisitos para calificarse como perito se publican en su sitio web.',
        ],
        icon: 'gavel',
      },
    ],
  },
  {
    id: 'forense',
    title: 'Medicina legal y ciencias forenses',
    intro: 'Las pericias oficiales de medicina legal dentro de una investigación las realiza el Estado.',
    items: [
      {
        id: 'snmlcf',
        name: 'Servicio Nacional de Medicina Legal y Ciencias Forenses',
        what: 'Entidad pública que realiza los exámenes médico-legales, las autopsias, la identificación de personas y los análisis de laboratorio forense dentro de investigaciones y procesos judiciales.',
        phones: [
          { display: '(02) 393 4220', tel: '+59323934220', note: 'Quito' },
          { display: '(04) 372 7420', tel: '+59343727420', note: 'Guayaquil' },
        ],
        address: ['Quito: Mariana de Jesús 21-30 y Av. Antonio José de Sucre', 'Guayaquil: Rodríguez Bonín y Av. Barcelona'],
        web: 'www.cienciasforenses.gob.ec',
        notes: ['Tiene sedes en otras provincias; están en su sitio web.'],
        icon: 'fingerprint',
      },
    ],
  },
  {
    id: 'derechos',
    title: 'Asesoría legal gratuita y derechos',
    intro: 'Si no puedes pagar un abogado o crees que se vulneraron tus derechos.',
    items: [
      {
        id: 'defensoria-publica',
        name: 'Defensoría Pública',
        what: 'Ofrece asesoría y patrocinio legal gratuito a quienes no pueden contratar un abogado particular. Atiende en las 24 provincias.',
        phones: [{ display: '(02) 381 5270', tel: '+59323815270', note: 'Central telefónica, Quito' }],
        address: ['El Universo E8-115 y Av. de los Shyris, Quito'],
        web: 'www.defensoria.gob.ec',
        icon: 'scale',
      },
      {
        id: 'defensoria-pueblo',
        name: 'Defensoría del Pueblo',
        what: 'Protege los derechos humanos y atiende quejas por su vulneración, incluidos los derechos de los consumidores.',
        phones: [{ display: '(02) 382 9670', tel: '+59323829670', note: 'Central telefónica, Quito' }],
        address: ['Av. 12 de Octubre 16-114 y Pasaje Nicolás Jiménez, Quito'],
        hours: 'Lunes a viernes, de 08:30 a 17:00',
        web: 'www.dpe.gob.ec',
        icon: 'users',
      },
    ],
  },
];

/** Frequent online procedures people ask us about. */
export const ONLINE_PROCEDURES: { title: string; text: string; web: string }[] = [
  {
    title: 'Certificado de antecedentes penales',
    text: 'Es gratuito y se descarga en línea, con tu número de cédula o pasaporte, en el portal del Ministerio del Interior. Tiene validez de 90 días. Nadie debe cobrarte por obtenerlo.',
    web: 'certificados.ministeriodelinterior.gob.ec',
  },
  {
    title: 'Estado de una denuncia',
    text: 'Se consulta en el sitio de la Fiscalía General del Estado, con tu número de cédula o el número de la noticia del delito.',
    web: 'www.fiscalia.gob.ec',
  },
  {
    title: 'Estado de un proceso judicial',
    text: 'Se consulta en el sistema e-SATJE de la Función Judicial, con tu cédula, tu nombre o el número del proceso.',
    web: 'www.funcionjudicial.gob.ec',
  },
  {
    title: 'Peritos acreditados',
    text: 'El Consejo de la Judicatura publica el listado oficial de peritos calificados por especialidad y los requisitos para acreditarse.',
    web: 'www.funcionjudicial.gob.ec',
  },
];
