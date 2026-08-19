import type { IntegrationDefinition } from './types';

/**
 * Every third-party API this system talks to.
 *
 * This is the single source of truth behind the admin's Integrations page. To
 * expose a new provider, add it here — the admin UI, the storage layer and the
 * status endpoint are all driven off this list.
 */
export const INTEGRATION_CATALOG: readonly IntegrationDefinition[] = [
  {
    provider: 'google_maps',
    label: 'Google Maps Platform',
    vendor: 'Google',
    description:
      'Server-side place search, reverse geocoding and driving directions. Needs the Places API, Geocoding API and Directions API enabled on the key.',
    usedBy: ['map-service'],
    docsUrl: 'https://developers.google.com/maps/documentation',
    consoleUrl: 'https://console.cloud.google.com/google/maps-apis/credentials',
    scope: 'server',
    testable: true,
    fields: [
      {
        key: 'GOOGLE_MAPS_API_KEY',
        label: 'Server API key',
        secret: true,
        required: true,
        placeholder: 'AIza…',
        help: 'Restrict this key by IP address. Do not reuse the key shipped in the mobile app.',
      },
    ],
  },
  {
    provider: 'mapbox',
    label: 'Mapbox',
    vendor: 'Mapbox',
    description:
      'Alternative geocoding and routing provider. Currently a standby: map-service only selects it when MAP_PROVIDER is set to mapbox.',
    usedBy: ['map-service'],
    docsUrl: 'https://docs.mapbox.com/api/overview/',
    consoleUrl: 'https://account.mapbox.com/access-tokens/',
    scope: 'server',
    testable: true,
    fields: [
      {
        key: 'MAPBOX_ACCESS_TOKEN',
        label: 'Secret access token',
        secret: true,
        required: true,
        placeholder: 'sk.…',
        help: 'Used server-side for search and directions.',
      },
      {
        key: 'MAPBOX_PUBLIC_TOKEN',
        label: 'Public token',
        secret: true,
        required: false,
        placeholder: 'pk.…',
        help: 'Handed to clients for map tiles when Mapbox rendering is enabled.',
      },
    ],
  },
  {
    provider: 'gemini',
    label: 'Google Gemini',
    vendor: 'Google AI',
    description:
      'Fallback travel-assistant brain, and the voice the copilot speaks with (Gemini TTS). Used when OpenAI is not configured or fails.',
    usedBy: ['ai-service'],
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    consoleUrl: 'https://aistudio.google.com/apikey',
    scope: 'server',
    testable: true,
    fields: [
      {
        key: 'GEMINI_API_KEY',
        label: 'API key',
        secret: true,
        required: true,
        placeholder: 'AIza… or AQ.…',
      },
      {
        key: 'GEMINI_MODEL',
        label: 'Model',
        secret: false,
        required: false,
        placeholder: 'gemini-2.5-flash',
        help: 'Defaults to gemini-2.5-flash. Speech also uses this key via Gemini TTS.',
      },
    ],
  },
  {
    provider: 'openai',
    label: 'OpenAI (ChatGPT)',
    vendor: 'OpenAI',
    description:
      'Preferred travel-assistant brain. When this key is set, spoken requests go to ChatGPT first. Gemini stays as fallback and still handles speech.',
    usedBy: ['ai-service'],
    docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
    consoleUrl: 'https://platform.openai.com/api-keys',
    scope: 'server',
    testable: true,
    fields: [
      {
        key: 'OPENAI_API_KEY',
        label: 'API key',
        secret: true,
        required: true,
        placeholder: 'sk-…',
        help: 'Create a secret key at platform.openai.com/api-keys. A ChatGPT Plus login is not enough — you need a paid API key.',
      },
      {
        key: 'OPENAI_MODEL',
        label: 'Model',
        secret: false,
        required: false,
        placeholder: 'gpt-4o-mini',
        help: 'Defaults to gpt-4o-mini. gpt-4o is smarter and a bit slower/costlier.',
      },
    ],
  },
  {
    provider: 'elevenlabs',
    label: 'ElevenLabs',
    vendor: 'ElevenLabs',
    description:
      'Unused for speech. The assistant now speaks with Gemini TTS. You can leave these keys empty.',
    usedBy: ['ai-service'],
    docsUrl: 'https://elevenlabs.io/docs/api-reference/text-to-speech',
    consoleUrl: 'https://elevenlabs.io/app/settings/api-keys',
    scope: 'server',
    testable: true,
    fields: [
      {
        key: 'ELEVENLABS_API_KEY',
        label: 'API key',
        secret: true,
        required: true,
        placeholder: 'sk_…',
      },
      {
        key: 'ELEVENLABS_MODEL',
        label: 'Model',
        secret: false,
        required: false,
        placeholder: 'eleven_v3',
        help: 'Defaults to eleven_v3. The older eleven_multilingual_v2 model is ignored because it cannot pronounce Hindi and Urdu clearly.',
      },
      {
        key: 'ELEVENLABS_VOICE_FEMALE',
        label: 'Female voice id',
        secret: false,
        required: false,
        placeholder: '9BWtsMINqrJLrRacOk9x',
        help: 'Optional. Defaults to Aria, which handles Urdu and Hindi better than the old Rachel voice.',
      },
      {
        key: 'ELEVENLABS_VOICE_MALE',
        label: 'Male voice id',
        secret: false,
        required: false,
        placeholder: 'IKne3meq5aSn9XLyUdCD',
        help: 'Optional. Defaults to Charlie. Rachel/Adam are skipped for Hindi and Urdu.',
      },
    ],
  },
  {
    provider: 'open_meteo',
    label: 'Open-Meteo',
    vendor: 'Open-Meteo',
    description:
      'Free weather forecasts the assistant quotes for a destination. No account or key required.',
    usedBy: ['ai-service'],
    docsUrl: 'https://open-meteo.com/en/docs',
    scope: 'server',
    testable: true,
    keyless: true,
    fields: [],
  },
  {
    provider: 'google_maps_mobile',
    label: 'Google Maps SDK (mobile)',
    vendor: 'Google',
    description:
      'Renders map tiles inside the app. These keys are compiled into the iOS and Android binaries, so changing one here is a record only — the app must be rebuilt for it to take effect.',
    usedBy: ['mobile'],
    docsUrl: 'https://developers.google.com/maps/documentation/ios-sdk',
    consoleUrl: 'https://console.cloud.google.com/google/maps-apis/credentials',
    scope: 'clientBuild',
    testable: false,
    fields: [
      {
        key: 'MOBILE_IOS_GOOGLE_MAPS_API_KEY',
        label: 'iOS key',
        secret: true,
        required: false,
        help: 'Lives in apps/mobile/ios/Maps.xcconfig. Restrict it to your iOS bundle ID.',
      },
      {
        key: 'MOBILE_ANDROID_GOOGLE_MAPS_API_KEY',
        label: 'Android key',
        secret: true,
        required: false,
        help: 'Lives in apps/mobile/android/local.properties. Restrict it to your package name and signing certificate.',
      },
    ],
  },
] as const;

export function findIntegration(provider: string): IntegrationDefinition | undefined {
  return INTEGRATION_CATALOG.find((entry) => entry.provider === provider);
}

/** Every storage key the catalog knows about, used to reject unknown writes. */
export function catalogFieldKeys(): Set<string> {
  return new Set(
    INTEGRATION_CATALOG.flatMap((entry) => entry.fields.map((field) => field.key)),
  );
}
