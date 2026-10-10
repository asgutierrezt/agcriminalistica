import { SITE } from '../data/site';

export const ORG_ID = `${SITE.url}/#organization`;

export const organizationSchema = {
  '@type': ['ProfessionalService', 'EducationalOrganization'],
  '@id': ORG_ID,
  name: SITE.name,
  alternateName: SITE.legalName,
  url: `${SITE.url}/`,
  logo: `${SITE.url}/logo-ag-criminalistica.png`,
  image: `${SITE.url}/logo-ag-criminalistica.png`,
  description: SITE.description,
  telephone: SITE.phone,
  founder: { '@type': 'Person', name: 'Alberto Gutiérrez', jobTitle: 'Licenciado en Criminalística' },
  areaServed: { '@type': 'Country', name: 'Ecuador' },
  address: { '@type': 'PostalAddress', addressCountry: 'EC' },
  knowsAbout: [
    'Peritaje criminalístico',
    'Reconstrucción 3D de hechos',
    'Animación forense',
    'Contrapericia',
    'Criminalística',
    'Ciencias forenses',
    'Peritaje judicial',
    'Informática forense',
    'Cadena de custodia',
    'Dactiloscopia',
    'Investigación del crimen',
  ],
  sameAs: Object.values(SITE.social),
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Servicios periciales y capacitación',
    itemListElement: [
      ['Reconstrucción 3D de los hechos', '/servicios/reconstruccion-3d-de-hechos/'],
      ['Peritaje criminalístico', '/servicios/peritaje-criminalistico/'],
      ['Consultoría pericial para abogados', '/servicios/consultoria-para-abogados/'],
      ['Cursos de criminalística', '/cursos/'],
    ].map(([name, path]) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name, url: `${SITE.url}${path}` },
    })),
  },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: SITE.phone,
    contactType: 'customer service',
    availableLanguage: 'es',
    areaServed: 'EC',
  },
};

export const websiteSchema = {
  '@type': 'WebSite',
  '@id': `${SITE.url}/#website`,
  url: `${SITE.url}/`,
  name: SITE.name,
  inLanguage: SITE.lang,
  publisher: { '@id': ORG_ID },
};

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: new URL(it.path, SITE.url).href,
    })),
  };
}
