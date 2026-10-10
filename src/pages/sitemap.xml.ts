import type { APIRoute } from 'astro';
import { getCourses, getPosts, getServices } from '../lib/utils';
import { SITE } from '../data/site';

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const courses = await getCourses();
  const services = await getServices();
  const latest = posts.reduce((m, p) => Math.max(m, (p.data.updatedDate ?? p.data.pubDate).getTime()), 0);
  const today = new Date().toISOString().slice(0, 10);

  const entries: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: '/', lastmod: today, priority: '1.0' },
    { loc: '/servicios/', lastmod: today, priority: '0.9' },
    ...services.map((s) => ({ loc: `/servicios/${s.id}/`, lastmod: today, priority: '1.0' })),
    { loc: '/cursos/', lastmod: today, priority: '0.7' },
    ...courses.map((c) => ({ loc: `/courses/${c.id}/`, lastmod: today, priority: '0.7' })),
    { loc: '/blog/', lastmod: new Date(latest).toISOString().slice(0, 10), priority: '0.8' },
    ...posts.map((p) => ({
      loc: `/${p.id}/`,
      lastmod: (p.data.updatedDate ?? p.data.pubDate).toISOString().slice(0, 10),
      priority: '0.7',
    })),
    { loc: '/glosario/', lastmod: today, priority: '0.8' },
    { loc: '/manual-dactiloscopia/', lastmod: today, priority: '0.7' },
    { loc: '/manual-identificacion-forense-de-la-voz/', lastmod: today, priority: '0.7' },
    { loc: '/nosotros/', lastmod: today, priority: '0.6' },
    { loc: '/contacto/', lastmod: today, priority: '0.6' },
    { loc: '/category/criminalistica/', priority: '0.4' },
    { loc: '/privacidad/', priority: '0.2' },
  ];

  const body = entries
    .map((e) => `<url><loc>${SITE.url}${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}<priority>${e.priority}</priority></url>`)
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
