import { Injectable } from '@nestjs/common';
import { IntegrationResolver } from '@traveler-guide/integrations';
import { createLogger } from '@traveler-guide/logger';

export type Gender = 'male' | 'female';

/** Gemini prebuilt voices. Kore / Charon read naturally in the car. */
const DEFAULT_VOICE: Record<Gender, string> = {
  female: 'Kore',
  male: 'Charon',
};

const TTS_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts'];

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  ur: 'Urdu',
  hi: 'Hindi',
  fr: 'French',
  es: 'Spanish',
  tr: 'Turkish',
};

function isoLanguage(language?: string): string | undefined {
  const code = language?.split('-')[0]?.toLowerCase();
  return code || undefined;
}

function languageName(lang?: string): string {
  return (lang && LANGUAGE_NAMES[lang]) || 'English';
}

function isGeminiVoice(name?: string): boolean {
  return Boolean(name && /^[A-Za-z]{3,24}$/.test(name) && !/^[0-9A-Fa-f-]{16,}$/.test(name));
}

function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function sampleRateFromMime(mime?: string): number {
  const match = mime?.match(/rate=(\d+)/i);
  const rate = match ? Number(match[1]) : 24000;
  return Number.isFinite(rate) && rate > 0 ? rate : 24000;
}

/**
 * Text-to-speech via Gemini. Uses the same API key as the chat model.
 * Returns WAV so the phone can play it; null means fall back to device TTS.
 */
@Injectable()
export class TtsService {
  private readonly logger = createLogger('TtsService');

  constructor(private readonly integrations: IntegrationResolver) {}

  async configured(): Promise<boolean> {
    return Boolean(await this.integrations.get('gemini', 'GEMINI_API_KEY'));
  }

  async synthesize(
    text: string,
    gender: Gender = 'female',
    voiceId?: string,
    language?: string,
  ): Promise<{ audio: string | null; mime: string; voiceId: string | null }> {
    const clipped = text.trim().slice(0, 1200);
    const key = await this.integrations.get('gemini', 'GEMINI_API_KEY');
    if (!key || !clipped) return { audio: null, mime: 'audio/wav', voiceId: null };

    const lang = isoLanguage(language);
    const voice = isGeminiVoice(voiceId) ? voiceId! : DEFAULT_VOICE[gender];

    for (const model of TTS_MODELS) {
      const audio = await this.requestSpeech(key, model, clipped, voice, lang);
      if (audio) return { audio, mime: 'audio/wav', voiceId: voice };
    }

    return { audio: null, mime: 'audio/wav', voiceId: voice };
  }

  private async requestSpeech(
    key: string,
    model: string,
    text: string,
    voice: string,
    lang?: string,
  ): Promise<string | null> {
    const hint = lang ? ` It is ${languageName(lang)}.` : '';
    const spoken = `Speak this text in its own language like a warm friend in the passenger seat.${hint} If it is Urdu, Hindi, or Arabic, pronounce it natively. Recite exactly, add no extra words: ${text}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: spoken }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.warn('Gemini TTS failed', {
          status: res.status,
          model,
          voice,
          language: lang,
          detail: detail.slice(0, 240),
        });
        return null;
      }
      const data = (await res.json()) as {
        candidates?: {
          content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
        }[];
      };
      const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inline?.data) return null;

      const raw = Buffer.from(inline.data, 'base64');
      const mime = inline.mimeType ?? '';
      if (mime.includes('wav') || raw.subarray(0, 4).toString() === 'RIFF') {
        return raw.toString('base64');
      }
      return pcmToWav(raw, sampleRateFromMime(mime)).toString('base64');
    } catch (error) {
      this.logger.error('Gemini TTS error', {
        model,
        voice,
        language: lang,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
