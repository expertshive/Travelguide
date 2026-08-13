import { Injectable } from '@nestjs/common';
import { IntegrationResolver } from '@traveler-guide/integrations';
import { createLogger } from '@traveler-guide/logger';

export type Gender = 'male' | 'female';

/** Default ElevenLabs stock voices (multilingual, handle EN + AR). */
const DEFAULT_VOICE: Record<Gender, string> = {
  female: '21m00Tcm4TlvDq8ikWAM', // Rachel
  male: 'pNInz6obpgDQGcFmaJgB', // Adam
};

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
  ): Promise<{ audio: string | null; mime: string; voiceId: string | null }> {
    // Read per request so a key rotated in the admin portal takes effect without
    // restarting the service; falls back to the process environment.
    const key = await this.integrations.get('elevenlabs', 'ELEVENLABS_API_KEY');
    if (!key || !text.trim()) return { audio: null, mime: 'audio/mpeg', voiceId: null };

    // `||` (not `??`) so an empty stored value falls back to the default voice.
    const configured = await this.integrations.get(
      'elevenlabs',
      gender === 'male' ? 'ELEVENLABS_VOICE_MALE' : 'ELEVENLABS_VOICE_FEMALE',
    );
    const voice = voiceId || configured || DEFAULT_VOICE[gender];
    const model =
      (await this.integrations.get('elevenlabs', 'ELEVENLABS_MODEL')) || 'eleven_multilingual_v2';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2 },
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn('ElevenLabs TTS failed', { status: res.status });
        return { audio: null, mime: 'audio/mpeg', voiceId: voice };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { audio: buf.toString('base64'), mime: 'audio/mpeg', voiceId: voice };
    } catch (error) {
      this.logger.error('ElevenLabs TTS error', {
        message: error instanceof Error ? error.message : String(error),
      });
      return { audio: null, mime: 'audio/mpeg', voiceId: voice };
    } finally {
      clearTimeout(timer);
    }
  }
}
