import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@react-native-voice/voice';
import { PermissionsAndroid, Platform } from 'react-native';

export type VoiceHandlers = {
  onResult: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

/** Wire up the voice recognition callbacks. Call once before starting. */
export function bindVoice(handlers: VoiceHandlers): void {
  Voice.onSpeechResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0];
    if (text) handlers.onResult(text);
  };
  Voice.onSpeechError = (e: SpeechErrorEvent) => {
    handlers.onError?.(e.error?.message ?? 'Could not hear you');
  };
  Voice.onSpeechEnd = () => handlers.onEnd?.();
}

/** Android needs an explicit RECORD_AUDIO grant; iOS prompts on first start. */
export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export async function startVoice(locale = 'en-US'): Promise<void> {
  await Voice.start(locale);
}

export async function stopVoice(): Promise<void> {
  try {
    await Voice.stop();
  } catch {
    /* already stopped */
  }
}

export async function destroyVoice(): Promise<void> {
  try {
    await Voice.destroy();
  } catch {
    /* nothing to tear down */
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
