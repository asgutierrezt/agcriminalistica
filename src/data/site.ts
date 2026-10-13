export const SITE = {
  name: 'AG Criminalística',
  legalName: 'A G Criminalística',
  url: 'https://agcriminalistica.com',
  locale: 'es_EC',
  lang: 'es-EC',
  description:
    'Peritaje criminalístico, reconstrucción 3D de los hechos y consultoría pericial para abogados en todo Ecuador. También formamos peritos con cursos online de criminalística.',
  // Never rendered on the page (only the WhatsApp button and the form are shown);
  // kept for structured data and the wa.me link.
  phone: '+593958853625',
  whatsapp: 'https://wa.me/593958853625',
  founder: 'Lcdo. Alberto Gutiérrez',
  partner: 'SIAF Cía. Ltda.',
  social: {
    facebook: 'https://www.facebook.com/agcriminalistica',
    instagram: 'https://www.instagram.com/agcriminalistica/',
    linkedin: 'https://www.linkedin.com/in/alberto-gutierrez-tigse/',
  },
  /** Web3Forms access key: submissions are delivered to the owner's inbox. */
  web3formsKey: '55854f04-3393-4c31-bea1-28433f1d56b8',
  /**
   * Google Apps Script web app that emails the free manuals (PDF attached) to
   * the visitor and notifies the owner. Source: scripts/manuales/enviar-manuales.gs.
   * Empty: requests go to Web3Forms and the visitor downloads the PDF on the spot.
   */
  manualsMailer: '',
} as const;

export const WHATSAPP_DEFAULT = 'Hola, AG Criminalística. Quisiera hacer una consulta.';

export function whatsappLink(text: string = WHATSAPP_DEFAULT) {
  return `${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
}
