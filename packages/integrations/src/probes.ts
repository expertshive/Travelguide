import type { IntegrationTestResult } from './types';

const PROBE_TIMEOUT_MS = 12_000;

/** Resolved values for one integration, keyed by field name. */
export type ProbeValues = Record<string, string | undefined>;

type ProbeOutcome = { ok: boolean; message: string };
type Probe = (values: ProbeValues) => Promise<ProbeOutcome>;

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Google returns HTTP 200 with a `status` field, so the body decides.
 * A `ZERO_RESULTS` answer still proves the key and the API are good.
 */
async function probeGoogleMaps(values: ProbeValues): Promise<ProbeOutcome> {
  const key = values.GOOGLE_MAPS_API_KEY;
  if (!key) return { ok: false, message: 'No API key is configured.' };

  const { body } = await getJson(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=24.7136,46.6753&key=${encodeURIComponent(key)}`,
  );
  const result = body as { status?: string; error_message?: string } | null;
  const status = result?.status;

  if (status === 'OK' || status === 'ZERO_RESULTS') {
    return { ok: true, message: 'Geocoding API answered. Key is valid.' };
  }
  if (status === 'REQUEST_DENIED') {
    return {
      ok: false,
      message: result?.error_message ?? 'Google denied the request. Check the key and that the API is enabled.',
    };
  }
  if (status === 'OVER_QUERY_LIMIT') {
    return { ok: false, message: 'Quota exceeded for this key.' };
  }
  return { ok: false, message: result?.error_message ?? `Google returned ${status ?? 'no status'}.` };
}

async function probeMapbox(values: ProbeValues): Promise<ProbeOutcome> {
  const token = values.MAPBOX_ACCESS_TOKEN;
  if (!token) return { ok: false, message: 'No access token is configured.' };

  const { status } = await getJson(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/riyadh.json?limit=1&access_token=${encodeURIComponent(token)}`,
  );
  if (status === 200) return { ok: true, message: 'Geocoding endpoint answered. Token is valid.' };
  if (status === 401) return { ok: false, message: 'Mapbox rejected the token (401).' };
  if (status === 429) return { ok: false, message: 'Mapbox rate limit reached (429).' };
  return { ok: false, message: `Mapbox responded ${status}.` };
}

async function probeGemini(values: ProbeValues): Promise<ProbeOutcome> {
  const key = values.GEMINI_API_KEY;
  if (!key) return { ok: false, message: 'No API key is configured.' };
  const model = values.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }),
        signal: controller.signal,
      },
    );
    if (response.ok) return { ok: true, message: `${model} answered. Key is valid.` };

    const body = (await response.json().catch(() => null)) as
      | { error?: { status?: string; message?: string } }
      | null;
    const status = body?.error?.status;
    if (status === 'RESOURCE_EXHAUSTED') {
      return {
        ok: false,
        message: 'Key is valid but its quota is exhausted. Check plan and billing.',
      };
    }
    if (response.status === 400 || response.status === 403) {
      return { ok: false, message: body?.error?.message ?? 'Gemini rejected the key.' };
    }
    if (response.status === 404) {
      return { ok: false, message: `Model ${model} was not found for this key.` };
    }
    return { ok: false, message: body?.error?.message ?? `Gemini responded ${response.status}.` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ElevenLabs returns 401 on a bad key. A GET of the voices list is the cheapest
 * authenticated call and confirms the key without spending TTS credits.
 */
async function probeElevenLabs(values: ProbeValues): Promise<ProbeOutcome> {
  const key = values.ELEVENLABS_API_KEY;
  if (!key) return { ok: false, message: 'No API key is configured.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': key },
      signal: controller.signal,
    });
    if (response.ok) {
      return { ok: true, message: 'ElevenLabs key is valid.' };
    }
    if (response.status === 401) return { ok: false, message: 'ElevenLabs rejected the key (401).' };
    if (response.status === 429) return { ok: false, message: 'ElevenLabs rate limit reached (429).' };
    return { ok: false, message: `ElevenLabs responded ${response.status}.` };
  } finally {
    clearTimeout(timer);
  }
}

async function probeOpenMeteo(): Promise<ProbeOutcome> {
  const { status, body } = await getJson(
    'https://api.open-meteo.com/v1/forecast?latitude=24.71&longitude=46.67&current=temperature_2m',
  );
  if (status !== 200) return { ok: false, message: `Open-Meteo responded ${status}.` };
  const temp = (body as { current?: { temperature_2m?: number } } | null)?.current?.temperature_2m;
  return typeof temp === 'number'
    ? { ok: true, message: `Reachable. Currently ${temp}°C in Riyadh.` }
    : { ok: false, message: 'Open-Meteo answered but returned no reading.' };
}

const PROBES: Record<string, Probe> = {
  google_maps: probeGoogleMaps,
  mapbox: probeMapbox,
  gemini: probeGemini,
  elevenlabs: probeElevenLabs,
  open_meteo: probeOpenMeteo,
};

/**
 * Makes a real call to the provider so the admin sees the truth rather than
 * whether a string happens to be non-empty.
 */
export async function runIntegrationProbe(
  provider: string,
  values: ProbeValues,
): Promise<IntegrationTestResult> {
  const startedAt = Date.now();
  const probe = PROBES[provider];

  const base = { provider, checkedAt: new Date().toISOString() };
  if (!probe) {
    return { ...base, ok: false, message: 'This integration cannot be tested.', durationMs: 0 };
  }

  try {
    const outcome = await probe(values);
    return { ...base, ...outcome, durationMs: Date.now() - startedAt };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      ...base,
      ok: false,
      message: timedOut
        ? `No answer within ${PROBE_TIMEOUT_MS / 1000}s.`
        : error instanceof Error
          ? error.message
          : String(error),
      durationMs: Date.now() - startedAt,
    };
  }
}

export function isTestable(provider: string): boolean {
  return provider in PROBES;
}
