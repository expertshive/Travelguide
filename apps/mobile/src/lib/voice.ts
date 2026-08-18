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

function recognitionLocale(locale: string): string {
  if (locale === 'ur-PK' || locale.startsWith('ur')) return 'ur-IN';
  if (locale.startsWith('hi')) return 'hi-IN';
  return locale;
}

let startLock = false;
let speechCooldownUntil = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wire up the voice recognition callbacks. Call once before starting. */
export function bindVoice(handlers: VoiceHandlers): void {
  Voice.onSpeechResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0];
    if (text) handlers.onResult(text);
  };
  Voice.onSpeechError = (e: SpeechErrorEvent) => {
    const raw = e.error?.message ?? '';
    if (raw.startsWith('10') || raw.includes('10/')) {
      speechCooldownUntil = Date.now() + 8000;
    }
    handlers.onError?.(speechErrorMessage(raw));
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
      message: 'Traveler Guide uses the mic so you can search and talk to the agent.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Start a single recognition session. Do not stop/cancel/retry around this —
 * each extra native call counts toward Google's ERROR_TOO_MANY_REQUESTS (10).
 */
export async function startVoice(locale = 'en-US'): Promise<void> {
  if (startLock) return;
  if (Date.now() < speechCooldownUntil) {
    throw new Error(ANDROID_SPEECH_ERRORS['10']);
  }

  startLock = true;
  try {
    await Voice.start(recognitionLocale(locale), {
      EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
      EXTRA_PARTIAL_RESULTS: false,
      EXTRA_PREFER_OFFLINE: true,
      REQUEST_PERMISSIONS_AUTO: true,
      EXTRA_MAX_RESULTS: 1,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    if (raw.startsWith('10') || raw.includes('too many')) {
      speechCooldownUntil = Date.now() + 8000;
      throw new Error(ANDROID_SPEECH_ERRORS['10']);
    }
    throw new Error(speechErrorMessage(raw));
  } finally {
    startLock = false;
  }
}

export async function stopVoice(): Promise<void> {
  try {
    await Voice.cancel();
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
  Voice.removeAllListeners();
}

export async function isVoiceAvailable(): Promise<boolean> {
  try {
    return Boolean(await Voice.isAvailable());
  } catch {
    return false;
  }
}

export { delay };
