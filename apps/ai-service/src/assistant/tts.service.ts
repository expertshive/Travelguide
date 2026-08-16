import { Injectable } from '@nestjs/common';
import { IntegrationResolver } from '@traveler-guide/integrations';
import { createLogger } from '@traveler-guide/logger';

export type Gender = 'male' | 'female';

/**
 * Premade multilingual voices. Rachel/Adam were English-first and mangled
 * Hindi and Urdu even when multilingual_v2 was selected.
 */
const DEFAULT_VOICE: Record<Gender, string> = {
  female: '9BWtsMINqrJLrRacOk9x', // Aria
  male: 'IKne3meq5aSn9XLyUdCD', // Charlie
};

/** Legacy English premades — skip for Indic so pronunciation can actually land. */
const ENGLISH_CENTRIC_VOICES = new Set([
  '21m00Tcm4TlvDq8ikWAM', // Rachel
  'pNInz6obpgDQGcFmaJgB', // Adam
  'AZnzlk1XvdvUeBnXmlld', // Domi
  'ErXwobaYiN019PkySvjV', // Antoni
  'MF3mGyEYCl7XYWbV9V6O', // Elli
  'TxGEqnHWrfWFTfGW9XjX', // Josh
  'VR6AewLTigWG4xSOukaG', // Arnold
  'yoZ06aMxZJJ28mfd3POQ', // Sam
]);

function isoLanguage(language?: string): string | undefined {
  const code = language?.split('-')[0]?.toLowerCase();
  return code || undefined;
}

function needsIndicModel(lang?: string): boolean {
  return lang === 'ur' || lang === 'hi';
}

/** language_code is ignored by multilingual_v2, which is why Urdu/Hindi sounded garbled. */
function modelsToTry(lang: string | undefined, configured?: string): string[] {
  const models: string[] = [];
  const push = (id: string) => {
    if (id && !models.includes(id)) models.push(id);
  };

  if (needsIndicModel(lang)) {
    push('eleven_v3');
    push('eleven_flash_v2_5');
    return models;
  }

  if (configured && configured !== 'eleven_multilingual_v2') push(configured);
  if (lang) push('eleven_flash_v2_5');
  else push(configured || 'eleven_flash_v2_5');
  push('eleven_v3');
  return models;
}

function pickVoice(
  gender: Gender,
  lang: string | undefined,
  configured?: string,
  override?: string,
): string {
  if (override) return override;
  if (configured && !(needsIndicModel(lang) && ENGLISH_CENTRIC_VOICES.has(configured))) {
    return configured;
  }
  return DEFAULT_VOICE[gender];
}

/**
 * Text-to-speech via ElevenLabs. The key stays server-side; the mobile app
 * requests audio and plays it. Returns `audio: null` when no key is configured
 * (or on failure) so the client can fall back to the device voice.
 */
@Injectable()
export class TtsService {
  private readonly logger = createLogger('TtsService');

  constructor(private readonly integrations: IntegrationResolver) {}

  async configured(): Promise<boolean> {
    return Boolean(await this.integrations.get('elevenlabs', 'ELEVENLABS_API_KEY'));
  }

  async synthesize(
    text: string,
    gender: Gender = 'female',
    voiceId?: string,
    language?: string,
  ): Promise<{ audio: string | null; mime: string; voiceId: string | null }> {
    const clipped = text.trim().slice(0, 1200);
    const key = await this.integrations.get('elevenlabs', 'ELEVENLABS_API_KEY');
    if (!key || !clipped) return { audio: null, mime: 'audio/mpeg', voiceId: null };

    const lang = isoLanguage(language);
    const configuredVoice = await this.integrations.get(
      'elevenlabs',
      gender === 'male' ? 'ELEVENLABS_VOICE_MALE' : 'ELEVENLABS_VOICE_FEMALE',
    );
    const configuredModel = await this.integrations.get('elevenlabs', 'ELEVENLABS_MODEL');
    const voice = pickVoice(gender, lang, configuredVoice || undefined, voiceId);
    const models = modelsToTry(lang, configuredModel || undefined);

    for (const model of models) {
      const audio = await this.requestSpeech(key, voice, clipped, model, lang);
      if (audio) return { audio, mime: 'audio/mpeg', voiceId: voice };
    }

    return { audio: null, mime: 'audio/mpeg', voiceId: voice };
  }

  private async requestSpeech(
    key: string,
    voice: string,
    text: string,
    model: string,
    lang?: string,
  ): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), model === 'eleven_v3' ? 40000 : 25000);
    const body: Record<string, unknown> = {
      text,
      model_id: model,
      apply_text_normalization: 'on',
      voice_settings: {
        stability: needsIndicModel(lang) ? 0.4 : 0.45,
        similarity_boost: 0.75,
        speed: needsIndicModel(lang) ? 0.92 : 1,
      },
    };
    // Not supported on multilingual_v2; required for Hindi/Urdu on v3 / flash.
    if (lang && model !== 'eleven_multilingual_v2') {
      body.language_code = lang;
    }

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_22050_32`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': key,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.warn('ElevenLabs TTS failed', {
          status: res.status,
          model,
          language: lang,
          detail: detail.slice(0, 240),
        });
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.toString('base64');
    } catch (error) {
      this.logger.error('ElevenLabs TTS error', {
        model,
        language: lang,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
