import Tts from 'react-native-tts';
import type { AssistantGender, AssistantLanguage } from './assistantPrefs';
import { synthesizeSpeech } from './assistant';
import { playBase64Mp3, stopAudio } from './audio';

/** Known iOS voice-name hints per gender (Android voice ids usually contain the gender). */
const FEMALE_HINTS = ['female', 'samantha', 'karen', 'moira', 'tessa', 'fiona', 'victoria', 'allison', 'ava', 'susan', 'zoe', 'nicky', 'laila', 'layla', 'amira', 'hala', 'sara', 'zariyah'];
const MALE_HINTS = ['male', 'aaron', 'fred', 'daniel', 'alex', 'tom', 'rishi', 'oliver', 'arthur', 'gordon', 'maged', 'tarik'];

let ready: boolean | null = null;
let currentVoice: string | null = null;
let currentLanguage: AssistantLanguage = 'en-US';
let currentGender: AssistantGender = 'female';
// Set true once the server reports no ElevenLabs key, so we stop calling it.
let elevenDisabled = false;

async function ensureReady(): Promise<boolean> {
  if (ready !== null) return ready;
  try {
    await Tts.getInitStatus();
    Tts.setDefaultRate(0.5);
    Tts.setDefaultPitch(1.0);
    ready = true;
  } catch {
    ready = false;
  }
  return ready;
}

type Voice = { id: string; name?: string; language?: string; notInstalled?: boolean };

/** Choose a device voice matching the gender + language. */
async function pickVoice(gender: AssistantGender, language: AssistantLanguage): Promise<string | null> {
  try {
    const voices = (await Tts.voices()) as Voice[];
    const langPrefix = language.split('-')[0].toLowerCase();
    const candidates = voices.filter(
      (v) => !v.notInstalled && (v.language ?? '').toLowerCase().startsWith(langPrefix),
    );
    if (!candidates.length) return null;
    const hints = gender === 'female' ? FEMALE_HINTS : MALE_HINTS;
    const other = gender === 'female' ? MALE_HINTS : FEMALE_HINTS;
    const match = candidates.find((v) => {
      const hay = `${v.id} ${v.name ?? ''}`.toLowerCase();
      return hints.some((h) => hay.includes(h)) && !other.some((h) => hay.includes(h));
    });
    return (match ?? candidates[0]).id;
  } catch {
    return null;
  }
}

/** Apply the assistant's gender + language voice for subsequent speech. */
export async function setAssistantVoice(
  gender: AssistantGender,
  language: AssistantLanguage,
): Promise<void> {
  await ensureReady();
  currentGender = gender;
  currentLanguage = language;
  currentVoice = await pickVoice(gender, language);
}

/**
 * Speak text aloud. Prefers ElevenLabs (natural voice, via the ai-service) and
 * falls back to the device voice if ElevenLabs isn't configured or fails.
 */
export async function speak(text: string): Promise<void> {
  if (!text) return;
  stopAudio();

  if (!elevenDisabled) {
    try {
      const audio = await synthesizeSpeech(text, currentGender);
      if (audio) {
        await playBase64Mp3(audio);
        return;
      }
      elevenDisabled = true; // server has no ElevenLabs key — use the device voice
    } catch {
      /* network/auth issue — fall back to device voice for this utterance */
    }
  }

  if (!(await ensureReady())) return;
  try {
    Tts.stop();
    if (currentLanguage) {
      try {
        await Tts.setDefaultLanguage(currentLanguage);
      } catch {
        /* language unavailable */
      }
    }
    if (currentVoice) {
      try {
        await Tts.setDefaultVoice(currentVoice);
      } catch {
        /* voice unavailable, keep default */
      }
    }
    Tts.speak(text);
  } catch {
    /* speech unavailable */
  }
}

/** Set the voice then speak a short sample — used by the settings preview. */
export async function previewVoice(
  gender: AssistantGender,
  language: AssistantLanguage,
  sample: string,
): Promise<void> {
  await setAssistantVoice(gender, language);
  void speak(sample);
}

export function stopSpeaking(): void {
  stopAudio();
  try {
    Tts.stop();
  } catch {
    /* nothing to stop */
  }
}
