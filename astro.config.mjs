import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  // Emits /sitemap-index.xml, referenced from robots.txt.
  integrations: [sitemap()],
  // /signals moved to its own site; keep the old URL working.
  redirects: {
    '/signals': 'https://signals.debasisnishank.com',
  },
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  // Production URL (custom domain on GitHub Pages).
  site: 'https://debasisnishank.com',
  // Static output — deploys anywhere (Netlify, GitHub Pages, Cloudflare Pages).
  output: 'static',
  build: {
    // Emit index.html files so URLs stay clean (/about, /projects/tica).
    format: 'directory',
  },
});
