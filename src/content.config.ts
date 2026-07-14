import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const travel = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/travel',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    title: z.string(),
    destination: z.string(),
    status: z.enum(['upcoming', 'planning', 'archived']),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    summary: z.string(),
    pendingItems: z.array(z.string()).default([]),
    updatedAt: z.coerce.date(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

const travelDays = defineCollection({
  loader: glob({
    pattern: '*/days/*.md',
    base: './src/content/travel',
    generateId: ({ entry }) => entry.replace('/days/', '/').replace(/\.md$/, ''),
  }),
  schema: ({ image }) => {
    const location = z.object({
      lat: z.number(),
      lng: z.number(),
      address: z.string().optional(),
    });
    const photo = z.object({
      src: image(),
      alt: z.string(),
      caption: z.string().optional(),
      featured: z.boolean().default(false),
    });
    const eventBase = {
      id: z.string(),
      title: z.string(),
      time: z.string().optional(),
      note: z.string().optional(),
      location: location.optional(),
      photos: z.array(photo).default([]),
    };

    return z.object({
      trip: z.string(),
      date: z.coerce.date(),
      city: z.string(),
      title: z.string().optional(),
      summary: z.string().optional(),
      events: z.array(z.discriminatedUnion('type', [
        z.object({ ...eventBase, type: z.literal('place'), category: z.string().optional() }),
        z.object({
          ...eventBase,
          type: z.literal('transit'),
          method: z.enum(['flight', 'train', 'metro', 'bus', 'ferry', 'car', 'walk', 'other']).optional(),
          from: z.string().optional(),
          to: z.string().optional(),
          endLocation: location.optional(),
          number: z.string().optional(),
        }),
        z.object({
          ...eventBase,
          type: z.literal('meal'),
          mealType: z.enum(['breakfast', 'lunch', 'dinner', 'cafe', 'snack', 'other']).optional(),
          dishes: z.array(z.string()).default([]),
          cost: z.string().optional(),
          rating: z.number().min(0).max(5).optional(),
        }),
        z.object({ ...eventBase, type: z.literal('stay'), booking: z.url().optional() }),
        z.object({ ...eventBase, type: z.literal('note') }),
      ])).default([]),
    });
  },
});

const links = defineCollection({
  loader: file('./src/data/links.json'),
  schema: z.object({
    title: z.string(),
    url: z.url(),
    description: z.string(),
    category: z.enum(['AI', 'Dev', 'Study', 'Travel', 'Storage', 'Finance', 'Tools']),
    private: z.boolean().default(false),
    pinned: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { travel, travelDays, links };
