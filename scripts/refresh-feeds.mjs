// Refresh the cached YouTube + GitHub data that the home page renders.
//
// Runs before `astro build` (see the "build" script in package.json). It is the
// ONLY place the build touches the network, which is deliberate:
//
//   - The page itself just imports the JSON, so a rendering build can never
//     fail, hang, or silently empty a section because a third party is down.
//   - A failed fetch keeps the previous cached values instead of dropping the
//     content. In Sept 2026 YouTube deleted its /feeds/videos.xml endpoint and
//     the old inline fetch swallowed the 404, so the deploy went green with an
//     empty "Off the Clock" section and nobody noticed for a day.
//   - Degradation is announced: a warning locally, and a ::warning:: annotation
//     that shows up on the GitHub Actions run summary.
//
// The cache is committed, so local and offline builds render real content too.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_PATH = resolve(ROOT, 'src/data/feed-cache.json');

const GH_USERS = ['debasisnishank', 'devnsk'];
const GH_EXCLUDE = ['debasisnishank.github.io']; // don't list this site itself
const GH_LIMIT = 6;

const YT_CHANNEL_ID = 'UCqRDpmpoGYUOWS-qP88xWpA';
// A channel's uploads playlist is its id with the UC prefix swapped for UU.
const YT_UPLOADS_PLAYLIST = `UU${YT_CHANNEL_ID.slice(2)}`;
const YT_LIMIT = 3;

/** Warn in a way that is visible both locally and on the Actions run summary. */
function warn(msg) {
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::warning title=Stale feed::${msg}`);
  console.warn(`  ! ${msg}`);
}

function readCache() {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return { youtube: { fetchedAt: null, videos: [] }, github: { fetchedAt: null, repos: [] } };
  }
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
}

/** Latest uploads via the YouTube Data API (1 quota unit against 10k/day). */
async function fetchYouTube() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');

  const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('playlistId', YT_UPLOADS_PLAYLIST);
  // Over-fetch: private/deleted uploads come back without a videoId.
  url.searchParams.set('maxResults', String(YT_LIMIT + 2));
  url.searchParams.set('key', key);

  const res = await fetch(url, { headers: { 'User-Agent': 'astro-build' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`playlistItems ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  const videos = ((await res.json()).items ?? []).map((item) => {
    const sn = item.snippet ?? {};
    const id = sn.resourceId?.videoId;
    if (!id) return null;
    const rawTitle = decodeEntities(sn.title ?? '');
    const clean = rawTitle.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim();
    const thumb = sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url
      ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return { id, title: clean || rawTitle, published: sn.publishedAt, thumb };
  }).filter(Boolean).slice(0, YT_LIMIT);

  if (!videos.length) throw new Error('playlist returned no usable videos');
  return { videos };
}

/** Most recently pushed non-fork repos across both accounts. */
async function fetchGitHub() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'astro-build' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const all = [];
  const failures = [];
  for (const u of GH_USERS) {
    try {
      const res = await fetch(
        `https://api.github.com/users/${u}/repos?sort=pushed&per_page=100&type=owner`,
        { headers },
      );
      if (!res.ok) { failures.push(`@${u}: ${res.status} ${res.statusText}`); continue; }
      for (const r of await res.json()) {
        if (r.fork || GH_EXCLUDE.includes(r.name.toLowerCase())) continue;
        all.push({
          name: r.name,
          title: r.name.replace(/[-_]+/g, ' ').trim(),
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          url: r.html_url,
          pushed: r.pushed_at,
          owner: u,
        });
      }
    } catch (err) {
      failures.push(`@${u}: ${err.message}`);
    }
  }

  // A partial result would silently shorten the section, so treat it as failure
  // and keep the cache instead.
  if (failures.length) throw new Error(failures.join('; '));
  if (!all.length) throw new Error('no repos returned');

  all.sort((a, b) => (a.pushed < b.pushed ? 1 : -1));
  return { repos: all.slice(0, GH_LIMIT) };
}


/* ---------------------------------------------------------------------------
 * Tech discoveries (/signals): newly created repositories that broke out, plus
 * things people actually shipped on Show HN. Star charts are dominated by
 * reading lists and interview prep, which are not discoveries, so those are
 * filtered out rather than ranked down.
 * ------------------------------------------------------------------------- */
const DISCOVERY_WINDOW_DAYS = 21;
const DISCOVERY_LIMIT = 8;
const SHOWHN_LIMIT = 6;

// Curated lists and study material: popular, but not a new tool.
const NOT_A_DISCOVERY =
  /\b(awesome|tutorials?|courses?|roadmaps?|interview|cheat-?sheets?|study|lecture|curriculum|bootcamp|free-?programming|100-days|learn(ing)?-path|books?)\b/i;

// Descriptions that are selling something rather than describing it: pasted
// landing-page URLs, price lists, "official website".
const PROMOTIONAL = /(https?:\/\/|\bpricing\b|official website|paid (services|plan)|\bbuy now\b)/i;

function isUsefulRepo(r) {
  if (!r.description || r.archived || r.disabled) return false;
  // The feed is English; drop entries whose description is mostly non-latin.
  const latin = (r.description.match(/[\x20-\x7E]/g) ?? []).length / r.description.length;
  if (latin < 0.75) return false;
  // A description too short to tell you anything is usually noise — but a repo
  // this popular is a discovery whether or not it bothered to explain itself.
  if (r.description.trim().length < 25 && r.stargazers_count < 1500) return false;
  if (PROMOTIONAL.test(r.description)) return false;
  return !NOT_A_DISCOVERY.test(r.name) && !NOT_A_DISCOVERY.test(r.description);
}

async function fetchTech() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'astro-build' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const since = new Date(Date.now() - DISCOVERY_WINDOW_DAYS * 86400_000).toISOString().slice(0, 10);
  const q = `created:>${since} stars:>40`;
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=40`,
    { headers },
  );
  if (!res.ok) throw new Error(`repo search ${res.status} ${res.statusText}`);

  const repos = ((await res.json()).items ?? [])
    .filter(isUsefulRepo)
    .slice(0, DISCOVERY_LIMIT)
    .map((r) => ({
      name: r.full_name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      url: r.html_url,
      created: r.created_at,
      topics: (r.topics ?? []).slice(0, 4),
    }));

  // Show HN: things people built and shipped, rather than things written about.
  const cutoff = Math.floor(Date.now() / 1000) - DISCOVERY_WINDOW_DAYS * 86400;
  const hnRes = await fetch(
    'https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=40' +
    `&numericFilters=points>30,created_at_i>${cutoff}`,
    { headers: { 'User-Agent': 'astro-build' } },
  );
  if (!hnRes.ok) throw new Error(`show hn ${hnRes.status} ${hnRes.statusText}`);

  const showhn = ((await hnRes.json()).hits ?? [])
    .filter((h) => h.title && h.url)
    .slice(0, SHOWHN_LIMIT)
    .map((h) => ({
      title: h.title.replace(/^Show HN:\s*/i, '').trim(),
      url: h.url,
      points: h.points,
      comments: h.num_comments ?? 0,
      discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
      created: new Date(h.created_at_i * 1000).toISOString(),
    }));

  if (!repos.length && !showhn.length) throw new Error('no usable discoveries');
  return { repos, showhn };
}

const cache = readCache();
const before = JSON.stringify(cache);
const now = new Date().toISOString();
let degraded = 0;

const SOURCES = [
  { key: 'youtube', label: 'YouTube uploads', fn: fetchYouTube, fields: ['videos'] },
  { key: 'github', label: 'GitHub repos', fn: fetchGitHub, fields: ['repos'] },
  { key: 'tech', label: 'Tech discoveries', fn: fetchTech, fields: ['repos', 'showhn'] },
];

for (const { key, label, fn, fields } of SOURCES) {
  const size = (o) => fields.reduce((n, f) => n + (o?.[f]?.length ?? 0), 0);
  try {
    const data = await fn();
    // Only stamp fetchedAt when the data actually moved, so a no-op build
    // doesn't leave the working tree dirty.
    const changed = fields.some(
      (f) => JSON.stringify(cache[key]?.[f]) !== JSON.stringify(data[f]),
    );
    if (changed) cache[key] = { fetchedAt: now, ...data };
    console.log(`  ok  ${label}: ${size(data)} item(s)${changed ? ' (updated)' : ' (unchanged)'}`);
  } catch (err) {
    const kept = size(cache[key]);
    const since = cache[key]?.fetchedAt;
    degraded++;
    warn(
      `${label} fetch failed (${err.message}). ` +
      (kept
        ? `Falling back to ${kept} cached item(s) from ${since ?? 'an earlier build'}.`
        : 'No cached data either — the section will be hidden.'),
    );
  }
}

const after = JSON.stringify(cache, null, 2) + '\n';
if (JSON.stringify(cache) !== before) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, after);
}

console.log(
  degraded
    ? `\nfeeds: ${degraded} source(s) degraded — serving cached data, build continues.\n`
    : '\nfeeds: all sources fresh.\n',
);
