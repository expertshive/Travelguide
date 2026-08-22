import { Injectable } from '@nestjs/common';
import { IntegrationResolver } from '@traveler-guide/integrations';
import { createLogger } from '@traveler-guide/logger';

export type Gender = 'male' | 'female';

/** OpenAI TTS voices — nova/shimmer read as female, onyx/echo as male. */
const DEFAULT_VOICE: Record<Gender, string> = {
  female: 'nova',
  male: 'onyx',
};

const TTS_MODELS = ['gpt-4o-mini-tts', 'tts-1'];

const OPENAI_VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
]);

function isOpenAiVoice(name?: string): boolean {
  return Boolean(name && OPENAI_VOICES.has(name.toLowerCase()));
}

/**
 * Text-to-speech via OpenAI (same ChatGPT API key as the assistant).
 * Returns MP3 so the phone can play it; null means fall back to device TTS.
 */
@Injectable()
export class TtsService {
  private readonly logger = createLogger('TtsService');

  constructor(private readonly integrations: IntegrationResolver) {}

  async configured(): Promise<boolean> {
    return Boolean(await this.integrations.get('openai', 'OPENAI_API_KEY'));
  }

  async synthesize(
    text: string,
    gender: Gender = 'female',
    voiceId?: string,
    _language?: string,
  ): Promise<{ audio: string | null; mime: string; voiceId: string | null }> {
    const clipped = text.trim().slice(0, 1200);
    const key = await this.integrations.get('openai', 'OPENAI_API_KEY');
    if (!key || !clipped) return { audio: null, mime: 'audio/mpeg', voiceId: null };

    const voice = isOpenAiVoice(voiceId) ? voiceId!.toLowerCase() : DEFAULT_VOICE[gender];

    for (const model of TTS_MODELS) {
      const audio = await this.requestSpeech(key, model, clipped, voice);
      if (audio) return { audio, mime: 'audio/mpeg', voiceId: voice };
    }

    return { audio: null, mime: 'audio/mpeg', voiceId: voice };
  }

  private async requestSpeech(
    key: string,
    model: string,
    text: string,
    voice: string,
  ): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          voice,
          input: text,
          response_format: 'mp3',
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.warn('OpenAI TTS failed', {
          status: res.status,
          model,
          voice,
          detail: detail.slice(0, 240),
        });
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) return null;
      return buf.toString('base64');
    } catch (error) {
      this.logger.error('OpenAI TTS error', {
        model,
        voice,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
