import { createLogger } from '@traveler-guide/logger';

const logger = createLogger('Wikipedia');
const UA = 'TravelerGuide/1.0 (heritage-along-route; educational)';

export type WikiFact = {
  title: string;
  extract: string;
  ageLabel: string | null;
  ageSource: 'verified' | 'estimated' | 'unknown';
};

function firstSentences(text: string, count: number): string {
  const parts = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/);
  return parts.slice(0, count).join(' ').trim();
}

function inferAge(extract: string): { label: string | null; source: WikiFact['ageSource'] } {
  const year = extract.match(
    /\b(?:founded|built|established|dates?\s+back|constructed)\b[^.]*?\b((?:1[0-9]{3}|[2-9][0-9]{2}|20[0-2][0-9]))\b/i,
  );
  if (year) {
    const y = Number(year[1]);
    const now = new Date().getUTCFullYear();
    if (y >= 200 && y <= now) {
      const age = now - y;
      return { label: `around ${age} years old (c. ${y})`, source: 'estimated' };
    }
  }
  const old = extract.match(/\b(\d{2,4})\s+years?\s+old\b/i);
  if (old) return { label: `around ${old[1]} years old`, source: 'estimated' };
  const century = extract.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+century\b/i);
  if (century) return { label: `${century[1]}th-century (estimated)`, source: 'estimated' };
  return { label: null, source: 'unknown' };
}

/** Nearest Wikipedia article extract. Returns null when nothing verifiable is nearby. */
export async function wikipediaNear(
  latitude: number,
  longitude: number,
  name: string,
): Promise<WikiFact | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const geo = new URL('https://en.wikipedia.org/w/api.php');
    geo.searchParams.set('action', 'query');
    geo.searchParams.set('list', 'geosearch');
    geo.searchParams.set('gscoord', `${latitude}|${longitude}`);
    geo.searchParams.set('gsradius', '1200');
    geo.searchParams.set('gslimit', '5');
    geo.searchParams.set('format', 'json');
    geo.searchParams.set('origin', '*');

    const geoRes = await fetch(geo, { signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!geoRes.ok) return null;
    const geoJson = (await geoRes.json()) as {
      query?: { geosearch?: { title: string; dist: number }[] };
    };
    const hits = geoJson.query?.geosearch ?? [];
    if (!hits.length) return null;

    const needle = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const match =
      hits.find((h) => h.title.toLowerCase().includes(needle.split(' ')[0] ?? '')) ?? hits[0];

    const page = new URL('https://en.wikipedia.org/w/api.php');
    page.searchParams.set('action', 'query');
    page.searchParams.set('prop', 'extracts');
    page.searchParams.set('exintro', '1');
    page.searchParams.set('explaintext', '1');
    page.searchParams.set('titles', match.title);
    page.searchParams.set('format', 'json');
    page.searchParams.set('origin', '*');

    const pageRes = await fetch(page, { signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!pageRes.ok) return null;
    const pageJson = (await pageRes.json()) as {
      query?: { pages?: Record<string, { extract?: string; title?: string }> };
    };
    const pageObj = Object.values(pageJson.query?.pages ?? {})[0];
    const extract = pageObj?.extract?.trim();
    if (!extract || extract.length < 40) return null;

    const age = inferAge(extract);
    return {
      title: pageObj?.title ?? match.title,
      extract: firstSentences(extract, 3),
      ageLabel: age.label,
      ageSource: age.source,
    };
  } catch (error) {
    logger.warn('Wikipedia lookup failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
