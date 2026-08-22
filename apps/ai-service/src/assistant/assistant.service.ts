import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationResolver } from '@traveler-guide/integrations';
import { createLogger } from '@traveler-guide/logger';

/** Actions the assistant can propose. Route-changing ones are applied by the
 *  app ONLY after the user confirms. */
export type AssistantAction = {
  type:
    | 'none'
    | 'search'
    | 'set_destination'
    | 'add_stop'
    | 'remove_stop'
    | 'set_route_style'
    | 'start_navigation';
  query?: string;
  routeStyle?: string;
  /** True for actions that change the route/stops — the app must confirm first. */
  requiresConfirmation?: boolean;
};

export type AssistantResult = {
  reply: string;
  action: AssistantAction;
  weather?: { summary: string; temperatureC: number } | null;
};

type Context = {
  destination?: { name?: string; address?: string; latitude?: number; longitude?: number };
  origin?: { latitude?: number; longitude?: number };
  routeStyle?: string;
  mode?: string;
  stops?: string[];
  distanceMeters?: number;
  durationSeconds?: number;
  radiusMeters?: number;
  assistant?: { name?: string; gender?: string; language?: string };
};

const WMO: Record<number, string> = {
  0: 'clear sky',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'rime fog',
  51: 'light drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  71: 'light snow',
  73: 'snow',
  80: 'rain showers',
  95: 'thunderstorm',
};

const ROUTE_ACTIONS = new Set(['add_stop', 'remove_stop', 'set_route_style', 'start_navigation']);

const LANGUAGE_NAMES: Record<string, string> = {
  'en-US': 'English',
  'ar-SA': 'Arabic',
  'ur-PK': 'Urdu',
  'hi-IN': 'Hindi',
  'fr-FR': 'French',
  'es-ES': 'Spanish',
  'tr-TR': 'Turkish',
  en: 'English',
  ar: 'Arabic',
  ur: 'Urdu',
  hi: 'Hindi',
  fr: 'French',
  es: 'Spanish',
  tr: 'Turkish',
};

function languageDisplayName(code?: string): string {
  if (!code) return 'English';
  return LANGUAGE_NAMES[code] ?? LANGUAGE_NAMES[code.split('-')[0] ?? ''] ?? 'English';
}

const RETIRED_GEMINI = new Set([
  'gemini-3.6-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest'];

function geminiModelsToTry(configured?: string): string[] {
  const models: string[] = [];
  const push = (id: string) => {
    const name = id.trim();
    if (name && !RETIRED_GEMINI.has(name) && !models.includes(name)) models.push(name);
  };
  if (configured) push(configured);
  for (const id of GEMINI_MODELS) push(id);
  return models;
}

@Injectable()
export class AssistantService {
  private readonly logger = createLogger('AssistantService');

  constructor(
    private readonly config: ConfigService,
    private readonly integrations: IntegrationResolver,
  ) {}

  async ask(message: string, context: Context = {}): Promise<AssistantResult> {
    const started = Date.now();
    this.logger.info('Assistant ask start', { preview: message.slice(0, 80) });
    const [weather, openaiKey, geminiKey] = await Promise.all([
      this.weatherFor(context.destination),
      this.integrations.get('openai', 'OPENAI_API_KEY'),
      this.integrations.get('gemini', 'GEMINI_API_KEY'),
    ]);

    if (!openaiKey && !geminiKey) {
      return {
        reply:
          "I'm not fully set up yet — add an OpenAI or Gemini API key and I'll be able to chat.",
        action: { type: 'none' },
        weather,
      };
    }

    const prompt = this.buildPrompt(message, context, weather);

    if (openaiKey) {
      try {
        const result = await this.callOpenAI(openaiKey, prompt);
        const action = this.normaliseAction(result.action);
        this.logger.info('Assistant ask done', {
          provider: 'openai',
          ms: Date.now() - started,
          action: action.type,
        });
        return { reply: result.reply, action, weather };
      } catch (error) {
        this.logger.error('OpenAI request failed', {
          ms: Date.now() - started,
          message: error instanceof Error ? error.message : String(error),
        });
        if (!geminiKey) {
          return {
            reply: "Sorry, I couldn't reach my brain just now. Please try again in a moment.",
            action: { type: 'none' },
            weather,
          };
        }
        this.logger.warn('Falling back to Gemini after OpenAI failure');
      }
    }

    try {
      const result = await this.callGemini(geminiKey as string, prompt);
      const action = this.normaliseAction(result.action);
      this.logger.info('Assistant ask done', {
        provider: 'gemini',
        ms: Date.now() - started,
        action: action.type,
      });
      return { reply: result.reply, action, weather };
    } catch (error) {
      this.logger.error('Gemini request failed', {
        ms: Date.now() - started,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        reply: "Sorry, I couldn't reach my brain just now. Please try again in a moment.",
        action: { type: 'none' },
        weather,
      };
    }
  }

  private normaliseAction(action: AssistantAction | undefined): AssistantAction {
    const a = action ?? { type: 'none' };
    return { ...a, requiresConfirmation: ROUTE_ACTIONS.has(a.type) };
  }

  private async weatherFor(dest?: Context['destination']) {
    if (!dest || typeof dest.latitude !== 'number' || typeof dest.longitude !== 'number') {
      return null;
    }
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${dest.latitude}` +
        `&longitude=${dest.longitude}&current=temperature_2m,weather_code,wind_speed_10m`;
      const res = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        current?: { temperature_2m?: number; weather_code?: number };
      };
      const temp = body.current?.temperature_2m;
      const code = body.current?.weather_code ?? -1;
      if (typeof temp !== 'number') return null;
      return { summary: WMO[code] ?? 'clear', temperatureC: Math.round(temp) };
    } catch {
      return null;
    }
  }

  private buildPrompt(
    message: string,
    context: Context,
    weather: AssistantResult['weather'],
  ): { system: string; userText: string } {
    const persona = context.assistant;
    const radiusM =
      typeof context.radiusMeters === 'number' && context.radiusMeters > 0
        ? context.radiusMeters
        : null;
    const radiusKm = radiusM ? (radiusM / 1000).toFixed(radiusM < 1000 ? 2 : 1) : null;
    const radiusRule = radiusM
      ? `HARD LIMIT: only mention, describe, or suggest places within ${radiusM} meters (${radiusKm} km) of the traveler's current position. If they ask about something farther, say you can only talk about places inside their chosen search radius. Never recommend a stop outside that radius.`
      : 'Stay focused on places near the traveler.';
    const langName = languageDisplayName(persona?.language);
    const personaLine = persona?.name
      ? `Your name is ${persona.name}${persona.gender ? `, a ${persona.gender} co-pilot` : ''}.`
      : '';

    const system = [
      personaLine,
      `The traveler may speak any language — English, Urdu, Hindi, Arabic, or a mix, including roman Urdu like "kahan chalain". Reply in the SAME language and script they just used. Do not translate into ${langName} unless they spoke ${langName}. JSON field names stay English; only "reply" is in their language. Action query values stay in English so the map can search.`,
      'You are a real travel companion sitting in the passenger seat — warm, easy-going, a little witty. Never say you are an AI, a model, or an assistant.',
      'EVERY reply is spoken out loud. Write the way people talk: contractions, natural rhythm, a small pause as a comma. No markdown, no bullets, no numbered lists, no asterisks, no emoji.',
      'Keep it to one or two short spoken sentences. Sound like you are chatting, not reading a script or a GPS.',
      'Understand ordinary conversation. The traveler talks like a person in a car — rambling, casual, maybe hungry or tired. Do NOT wait for command words like "search", "add stop", or "restaurant". Infer what they mean.',
      'If they are just chatting, wondering, or asking about a place, reply as a friend with action "none". Only set a map action when they clearly want you to change the trip (add a stop, start navigating, switch the route style, or look something up on the map).',
      'You can: chat about the destination and famous nearby places, describe a landmark briefly, report the weather, and change stops or the route — but only with the user\'s confirmation.',
      radiusRule,
      'Default while traveling: only mention famous or tourist places (landmarks, attractions, museums, historic sites) inside the radius. Do not volunteer restaurants, rest areas, coffee, fuel, mosques, or other amenities.',
      'If they sound hungry or tired of driving — even without saying "restaurant" or "rest area" — offer the nearest one in plain speech and use action "add_stop" with query "restaurant" or "rest area". Mention only the nearest one.',
      'When they ask what a famous place is like, or about history, answer briefly and warmly with action "none".',
      'IMPORTANT: setting a new destination happens in the app right away. For adding or removing stops, never say the route has already changed — propose it and wait for confirmation.',
      'If they name a place they want to go — “take me to …”, “let’s go to …”, a city, mall, airport, or address — use action "set_destination" with query set to that place. The app will search the map and set it as the trip destination. Do not use search for that.',
      'Pick exactly one action: "search" (query = what to browse on the map without changing destination), "set_destination" (query = the place to go), "add_stop" (query = the place type/name to add as a stop and reroute), "remove_stop", "set_route_style" (routeStyle = fastest|shortest|scenic|historical|adventure|food|family|religious|budget), "start_navigation", or "none" for pure conversation.',
      'The "reply" field is the voice prompt. End route suggestions with a short spoken yes-or-no question in that language.',
    ].join(' ');

    const ctxLines: string[] = [];
    if (context.destination?.name) ctxLines.push(`Destination: ${context.destination.name}`);
    if (context.destination?.address) ctxLines.push(`Address: ${context.destination.address}`);
    if (context.routeStyle) ctxLines.push(`Route style: ${context.routeStyle}`);
    if (context.mode) ctxLines.push(`Travel mode: ${context.mode}`);
    if (context.stops?.length) ctxLines.push(`Current stops: ${context.stops.join(', ')}`);
    if (typeof context.distanceMeters === 'number') {
      ctxLines.push(`Distance: ${(context.distanceMeters / 1000).toFixed(1)} km`);
    }
    if (typeof context.durationSeconds === 'number') {
      ctxLines.push(`Duration: ${Math.round(context.durationSeconds / 60)} min`);
    }
    if (typeof context.radiusMeters === 'number') {
      ctxLines.push(
        `Search radius: ${context.radiusMeters} m around the traveler. Do not talk about places outside this circle.`,
      );
    }
    if (weather) ctxLines.push(`Destination weather: ${weather.summary}, ${weather.temperatureC}°C`);

    return {
      system,
      userText: `${ctxLines.length ? `Trip context:\n${ctxLines.join('\n')}\n\n` : ''}Traveler said: "${message}"`,
    };
  }

  private async callOpenAI(
    key: string,
    prompt: { system: string; userText: string },
  ): Promise<{ reply: string; action?: AssistantAction }> {
    const model = (await this.integrations.get('openai', 'OPENAI_MODEL'))?.trim() || 'gpt-4o-mini';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          max_tokens: 180,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `${prompt.system} Reply with a JSON object only: {"reply":"...","action":{"type":"none|search|set_destination|add_stop|remove_stop|set_route_style|start_navigation","query":"...","routeStyle":"..."}}. Omit query and routeStyle when unused.`,
            },
            { role: 'user', content: prompt.userText },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = data.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as { reply?: string; action?: AssistantAction };
      return {
        reply: parsed.reply ?? "I'm here — where would you like to go?",
        action: parsed.action ?? { type: 'none' },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async callGemini(
    key: string,
    prompt: { system: string; userText: string },
  ): Promise<{ reply: string; action?: AssistantAction }> {
    const configured = await this.integrations.get('gemini', 'GEMINI_MODEL');
    const models = geminiModelsToTry(configured);
    let lastError = 'Gemini request failed';

    for (const model of models) {
      try {
        return await this.requestGemini(key, model, prompt);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        const missing = lastError.includes('404') || lastError.toLowerCase().includes('no longer available');
        if (!missing) throw error;
        this.logger.warn('Gemini model unavailable, trying the next one', { model, message: lastError });
      }
    }

    throw new Error(lastError);
  }

  private async requestGemini(
    key: string,
    model: string,
    prompt: { system: string; userText: string },
  ): Promise<{ reply: string; action?: AssistantAction }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const { system, userText } = prompt;

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 120,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            reply: { type: 'STRING' },
            action: {
              type: 'OBJECT',
              properties: {
                type: {
                  type: 'STRING',
                  enum: [
                    'none',
                    'search',
                    'set_destination',
                    'add_stop',
                    'remove_stop',
                    'set_route_style',
                    'start_navigation',
                  ],
                },
                query: { type: 'STRING' },
                routeStyle: { type: 'STRING' },
              },
              required: ['type'],
            },
          },
          required: ['reply', 'action'],
        },
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
      const parsed = JSON.parse(raw) as { reply?: string; action?: AssistantAction };
      return {
        reply: parsed.reply ?? "I'm here — where would you like to go?",
        action: parsed.action ?? { type: 'none' },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
