export const SITE = {
  name: 'AG Criminalística',
  legalName: 'A G Criminalística',
  url: 'https://agcriminalistica.com',
  locale: 'es_EC',
  lang: 'es-EC',
  description:
    'Escuela online de criminalística y ciencias forenses en Ecuador: cursos de formación de peritos, informática forense, investigación del crimen y consultoría pericial.',
  email: 'asgutierrezt@gmail.com',
  phone: '+593958853625',
  phoneDisplay: '+593 95 885 3625',
  whatsapp: 'https://wa.me/593958853625',
  founder: 'Lcdo. Alberto Gutiérrez',
  partner: 'SIAF Cía. Ltda.',
  social: {
    facebook: 'https://www.facebook.com/agcriminalistica',
    instagram: 'https://www.instagram.com/agcriminalistica/',
    linkedin: 'https://www.linkedin.com/in/alberto-gutierrez-tigse/',
  },
  /**
   * Web3Forms access key generated for asgutierrezt@gmail.com at
   * https://web3forms.com. While empty, the contact form falls back to
   * opening the visitor's mail app addressed to SITE.email.
   */
  web3formsKey: '55854f04-3393-4c31-bea1-28433f1d56b8',
} as const;

export function whatsappLink(text: string) {
  return `${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
}
