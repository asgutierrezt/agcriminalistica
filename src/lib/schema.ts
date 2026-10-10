import { SITE } from '../data/site';

export const ORG_ID = `${SITE.url}/#organization`;

export const organizationSchema = {
  '@type': ['EducationalOrganization', 'ProfessionalService'],
  '@id': ORG_ID,
  name: SITE.name,
  alternateName: SITE.legalName,
  url: `${SITE.url}/`,
  logo: `${SITE.url}/logo-ag-criminalistica.png`,
  image: `${SITE.url}/logo-ag-criminalistica.png`,
  description: SITE.description,
  email: SITE.email,
  telephone: SITE.phone,
  founder: { '@type': 'Person', name: 'Alberto Gutiérrez', jobTitle: 'Licenciado en Criminalística' },
  areaServed: { '@type': 'Country', name: 'Ecuador' },
  address: { '@type': 'PostalAddress', addressCountry: 'EC' },
  knowsAbout: [
    'Criminalística',
    'Ciencias forenses',
    'Peritaje judicial',
    'Informática forense',
    'Cadena de custodia',
    'Dactiloscopia',
    'Investigación del crimen',
  ],
  sameAs: Object.values(SITE.social),
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: SITE.phone,
    email: SITE.email,
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
