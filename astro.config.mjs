// @ts-check
import { defineConfig } from 'astro/config';

// Old WordPress URLs that no longer have their own page. Astro emits a
// static HTML redirect (meta refresh + canonical) for each one.
const legacyRedirects = {
  '/2019/07/19': '/blog/',
  '/2021/07/19': '/blog/',
  '/2021/08/05': '/blog/',
  '/blog/page/2': '/blog/',
  '/category/criminalistica/page/2': '/category/criminalistica/',
  '/category/education': '/blog/',
  '/id-forense-voz': '/manual-identificacion-forense-de-la-voz/',
  '/identificacion-forense-de-la-voz': '/manual-identificacion-forense-de-la-voz/',
  '/un-ciberataque-que-deberia-preocuparnos-a-todos/whatsapp-image-2021-08-04-at-19-15-05':
    '/un-ciberataque-que-deberia-preocuparnos-a-todos/',
  '/un-ciberataque-que-deberia-preocuparnos-a-todos/whatsapp-image-2021-08-04-at-19-15-06-2':
    '/un-ciberataque-que-deberia-preocuparnos-a-todos/',
  '/courses': '/cursos/',
  '/contact': '/contacto/',
  '/about': '/nosotros/',
};

export default defineConfig({
  site: 'https://agcriminalistica.com',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  redirects: legacyRedirects,
  image: {
    responsiveStyles: true,
  },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
