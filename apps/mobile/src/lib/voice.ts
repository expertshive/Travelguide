import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@dev-amirzubair/react-native-voice';
import { PermissionsAndroid, Platform } from 'react-native';

export type VoiceHandlers = {
  onResult: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

const ANDROID_SPEECH_ERRORS: Record<string, string> = {
  '1': 'Speech timed out. Check your network and try again.',
  '2': 'Speech needs a network connection. Try again.',
  '3': 'Could not hear the microphone.',
  '4': 'Speech service error. Try again.',
  '5': 'Could not start the microphone. Close other apps using it and retry.',
  '6': 'I did not hear anything. Tap the mic and speak again.',
  '7': 'I did not catch that. Tap the mic and try again.',
  '8': 'Speech is busy. Wait a moment and tap the mic again.',
  '9': 'Microphone permission is needed for voice search.',
  '10': 'Too many speech requests. Wait a moment.',
  '11': 'Speech disconnected. Try again.',
  '12': 'That language is not installed for speech recognition.',
};

function speechErrorMessage(raw?: string): string {
  const lowered = raw?.toLowerCase() ?? '';
  if (lowered.includes('startspeech') && lowered.includes('null')) {
    return 'Speech recognition is not ready. Restart the app after this update.';
  }
  const code = raw?.match(/^(\d+)/)?.[1];
  if (code && ANDROID_SPEECH_ERRORS[code]) return ANDROID_SPEECH_ERRORS[code];
  return raw?.trim() || 'Could not hear you';
}

/**
 * Google's on-device recognizer often lacks `ur-PK`. Try the locales it
 * actually ships (ur-IN, then Hindi) so the mic does not immediately fail.
 */
function localeFallbacks(locale: string): string[] {
  const chain: string[] = [];
  const push = (value: string) => {
    if (value && !chain.includes(value)) chain.push(value);
  };

  if (locale === 'ur-PK' || locale.startsWith('ur')) {
    push('ur-IN');
    push('ur');
    push('hi-IN');
    push(locale);
  } else if (locale === 'hi-IN' || locale.startsWith('hi')) {
    push('hi-IN');
    push('hi');
    push(locale);
  } else {
    push(locale);
  }
  return chain;
}

/** Wire up the voice recognition callbacks. Call once before starting. */
export function bindVoice(handlers: VoiceHandlers): void {
  Voice.onSpeechResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0];
    if (text) handlers.onResult(text);
  };
  Voice.onSpeechError = (e: SpeechErrorEvent) => {
    handlers.onError?.(speechErrorMessage(e.error?.message));
  };
  Voice.onSpeechEnd = () => handlers.onEnd?.();
}

/** Android needs an explicit RECORD_AUDIO grant; iOS prompts on first start. */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (already) return true;
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Microphone',
      message: 'Traveler Guide uses the mic so you can search and talk to the assistant.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function startVoice(locale = 'en-US'): Promise<void> {
  try {
    await Voice.stop();
    await Voice.cancel();
  } catch {
    /* nothing running */
  }

  try {
    const available = await Voice.isAvailable();
    if (!available) {
      throw new Error(
        'Speech recognition is not available. Install Google Speech Services and try again.',
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Speech recognition')) {
      throw error;
    }
    /* isAvailable can throw on a cold start — still attempt start() */
  }

  let lastError: unknown;
  for (const candidate of localeFallbacks(locale)) {
    try {
      await Voice.start(candidate, {
        RECOGNIZER_ENGINE: 'GOOGLE',
        EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
        EXTRA_PARTIAL_RESULTS: true,
        REQUEST_PERMISSIONS_AUTO: true,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    speechErrorMessage(lastError instanceof Error ? lastError.message : String(lastError ?? '')),
  );
}

export async function stopVoice(): Promise<void> {
  try {
    await Voice.stop();
  } catch {
    /* already stopped */
  }
}

/**
 * Release listeners and stop listening. Do not call native destroy() — on the
 * New Architecture that tears down startSpeech until the app is relaunched.
 */
export async function destroyVoice(): Promise<void> {
  try {
    await Voice.cancel();
  } catch {
    /* already stopped */
  }
  try {
    await Voice.stop();
  } catch {
    /* already stopped */
  }
  Voice.removeAllListeners();
}

export async function isVoiceAvailable(): Promise<boolean> {
  try {
    return Boolean(await Voice.isAvailable());
  } catch {
    return false;
  }
}
