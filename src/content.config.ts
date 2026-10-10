import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: z.string().optional(),
      description: z.string().max(170),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      cover: image(),
      coverAlt: z.string(),
      category: z.enum(['Criminalística', 'Informática forense', 'Investigación pericial']),
      tags: z.array(z.string()).default([]),
      author: z.string().default('Lcdo. Alberto Gutiérrez'),
      featured: z.boolean().default(false),
    }),
});

const courses = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/courses' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      seoTitle: z.string(),
      description: z.string().max(170),
      tagline: z.string(),
      cover: image(),
      coverAlt: z.string(),
      code: z.string(),
      order: z.number(),
      status: z.string().default('Próximamente'),
      price: z.string().default('Consultar'),
      modality: z.string().default('Online'),
      audience: z.array(z.string()),
      outcomes: z.array(z.string()),
      modules: z.array(z.string()),
      updatedDate: z.coerce.date(),
    }),
});

const services = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/services' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      shortTitle: z.string(),
      seoTitle: z.string().max(65),
      description: z.string().max(170),
      tagline: z.string(),
      serviceType: z.string(),
      icon: z.enum(['cube', 'search', 'scale']),
      code: z.string(),
      order: z.number(),
      interes: z.string(),
      cover: image(),
      coverAlt: z.string(),
      benefits: z.array(z.object({ t: z.string(), d: z.string() })),
      process: z.array(z.object({ t: z.string(), d: z.string() })),
      useCases: z.array(z.string()),
      faq: z.array(z.object({ q: z.string(), a: z.string() })),
      videos: z.array(z.object({ youtubeId: z.string(), title: z.string(), uploadDate: z.coerce.date() })).default([]),
      related: z.array(z.string()).default([]),
    }),
});

export const collections = { blog, courses, services };
