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

/**
 * Marks Amazon affiliate links written in Markdown as sponsored and opens
 * them in a new tab (required by Google and good UX). Plain tree walk, no deps.
 */
function rehypeAffiliateLinks() {
  /** @param {any} node */
  const walk = (node) => {
    if (node.type === 'element' && node.tagName === 'a' && /amazon\.com\//.test(String(node.properties?.href ?? ''))) {
      node.properties.rel = ['sponsored', 'nofollow', 'noopener'];
      node.properties.target = '_blank';
      node.properties.className = ['amz-link'];
    }
    (node.children ?? []).forEach(walk);
  };
  /** @param {any} tree */
  return (tree) => walk(tree);
}

export default defineConfig({
  markdown: { rehypePlugins: [rehypeAffiliateLinks] },
  site: 'https://agcriminalistica.com',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  redirects: legacyRedirects,
  image: {
    responsiveStyles: true,
  },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
});
