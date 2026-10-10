import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;
export type Course = CollectionEntry<'courses'>;

export async function getPosts() {
  const posts = await getCollection('blog');
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

export async function getCourses() {
  const courses = await getCollection('courses');
  return courses.sort((a, b) => a.data.order - b.data.order);
}

export function readingTime(body = '') {
  const words = body.replace(/[#*_>\[\]()!`-]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const fmt = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (d: Date) => fmt.format(d);

export type Service = CollectionEntry<'services'>;

export async function getServices() {
  const services = await getCollection('services');
  return services.sort((a, b) => a.data.order - b.data.order);
}
