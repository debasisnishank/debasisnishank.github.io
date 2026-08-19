import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
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
