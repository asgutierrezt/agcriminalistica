import type { APIRoute } from 'astro';
import { getPosts } from '../lib/utils';
import { SITE } from '../data/site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const items = posts
    .map((p) => {
      const url = `${SITE.url}/${p.id}/`;
      return `<item><title>${esc(p.data.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${p.data.pubDate.toUTCString()}</pubDate><category>${esc(p.data.category)}</category><description>${esc(p.data.description)}</description></item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${SITE.name} · Blog</title><link>${SITE.url}/blog/</link><atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml"/><description>${esc(SITE.description)}</description><language>es-ec</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
