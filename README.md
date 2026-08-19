# debasisnishank-portfolio

A portfolio site (originally a static HTML site) rebuilt on **Astro** with all
content moved into editable files, managed through **Sveltia CMS** (a fast,
modern drop-in replacement for Decap CMS) at `/admin`.

## Stack

- **Astro** (static output) — builds plain HTML/CSS/JS, deploys anywhere.
- **Content collections** in `src/content/` — every piece of text/image is a field.
- **Sveltia CMS** in `public/admin/` — a `/admin` editor that commits changes to Git.
- Original design preserved untouched in `public/assets/` (CSS, fonts, JS, images).

## Content model

| Where you edit (in `/admin`) | File on disk |
| --- | --- |
| Site Settings (name, bio, socials, footer, timeline) | `src/content/settings/site.json` |
| Home Page (Now, Research, Publications) | `src/content/home/home.json` |
| About Page | `src/content/about/about.json` |
| Projects (one entry each; optional detail pages) | `src/content/projects/*.md` |

## Develop

```bash
npm install
npm run dev          # site at http://localhost:4321
```

## Editing content locally (no GitHub needed)

Run the CMS proxy in a second terminal, then open the admin UI:

```bash
npm run cms-proxy    # starts the local Git proxy on port 8081
```

Open **http://localhost:4321/admin/** — it reads and writes your local files
directly. Saves land in `src/content/`; the dev server hot-reloads.

## Hosting: GitHub Pages (already wired up)

This repo is the GitHub **user site** `debasisnishank/debasisnishank.github.io`,
served at the domain root `https://debasisnishank.github.io/`.

- `.github/workflows/deploy.yml` builds with Astro and deploys to Pages on every
  push to `main` (via GitHub Actions — no `dist/` is committed).
- In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**
  (set once; the CLI does this during setup).

Push to `main` → the site rebuilds and redeploys automatically.

## Online editing at /admin (Cloudflare Worker OAuth)

GitHub Pages is static, so it can't run the OAuth step the CMS needs to sign in.
A tiny free Cloudflare Worker (`sveltia-cms-auth`) handles it. One-time setup:

1. **Create a GitHub OAuth App** — GitHub → Settings → Developer settings →
   OAuth Apps → New. Homepage `https://debasisnishank.github.io`, callback
   `https://YOUR-WORKER.workers.dev/callback`. Note the Client ID + Secret.
2. **Deploy the worker** — clone <https://github.com/sveltia/sveltia-cms-auth>,
   `npx wrangler deploy`, and set its secrets:
   ```bash
   npx wrangler secret put GITHUB_CLIENT_ID
   npx wrangler secret put GITHUB_CLIENT_SECRET
   # optional: ALLOWED_DOMAINS = debasisnishank.github.io
   ```
3. **Point the CMS at it** — in `public/admin/config.yml`, set
   `backend.base_url: https://YOUR-WORKER.workers.dev`, then commit & push.
4. Visit `https://debasisnishank.github.io/admin/`, sign in with GitHub, edit.
   Every save commits to this repo and the site redeploys.

Until then, edit locally with `npm run dev` + `npm run cms-proxy` (above).

## Build

```bash
npm run build        # outputs static site to dist/
npm run preview      # preview the production build
```

> Before deploying, set the real URL in `astro.config.mjs` (`site:`).
