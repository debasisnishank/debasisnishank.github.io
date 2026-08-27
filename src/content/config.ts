import { defineCollection, z } from 'astro:content';

/* A social/CTA link used across the site. */
const link = z.object({
  label: z.string(),
  url: z.string(),
  icon: z.string().optional(),      // Font Awesome class, e.g. "fas fa-arrow-right"
  external: z.boolean().default(false),
});

/* ---- Site settings (singleton) ---- */
const settings = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    tagline: z.string(),
    bio: z.string(),
    metaDescription: z.string(),
    socials: z.object({
      cv: z.string().optional(),
      orcid: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().optional(),
      twitter: z.string().optional(),
      youtube: z.string().optional(),
      instagram: z.string().optional(),
      telegram: z.string().optional(),
      discord: z.string().optional(),
      email: z.string().optional(),
      emailWork: z.string().optional(),
    }),
    footer: z.object({
      contactHeading: z.string(),
      contactText: z.string(),
      email: z.string().optional(),
      emailWork: z.string().optional(),
      timeline: z.array(z.object({
        role: z.string(),
        org: z.string(),
        time: z.string(),
      })),
      freetimeNote: z.string(),
    }),
  }),
});

/* ---- Home page sections (singleton) ---- */
const home = defineCollection({
  type: 'data',
  schema: z.object({
    now: z.array(z.string()),                 // paragraphs
    research: z.object({
      items: z.array(z.object({
        title: z.string(),
        meta: z.string(),
        description: z.array(z.string()),
      })),
      publications: z.array(z.object({
        title: z.string(),
        venue: z.string(),
        url: z.string().optional(),
      })),
    }),
  }),
});

/* ---- About page (singleton) ---- */
const about = defineCollection({
  type: 'data',
  schema: z.object({
    heading: z.string(),
    body: z.array(z.string()),                // paragraphs (may contain inline HTML)
  }),
});

/* ---- Projects (folder) ---- */
const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    order: z.number().default(0),
    tags: z.array(z.string()).default([]),
    cardDescription: z.string(),
    cardContext: z.string().optional(),
    cardLink: link.optional(),                // omit for cards with no link (e.g. HackDAV)
    // Detail-page fields (only used when hasDetailPage is true):
    hasDetailPage: z.boolean().default(false),
    detailTitle: z.string().optional(),       // hero title on the detail page (defaults to title)
    meta: z.string().optional(),              // subtitle on the detail hero
    heroImage: z.string().optional(),
    heroCaption: z.string().optional(),
    lede: z.array(z.string()).optional(),     // intro paragraphs above the body
  }),
});

export const collections = { settings, home, about, projects };
