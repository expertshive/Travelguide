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
/** Consecutive ElevenLabs misses. Reset on success; retry after a cooldown. */
let elevenMisses = 0;
let elevenSkipUntil = 0;
let speakChain: Promise<void> = Promise.resolve();

async function ensureReady(): Promise<boolean> {
  if (ready !== null) return ready;
  try {
    await Tts.getInitStatus();
    Tts.setDefaultRate(0.48);
    Tts.setDefaultPitch(1.0);
    try {
      await Tts.setIgnoreSilentSwitch('ignore');
    } catch {
      /* Android */
    }
    ready = true;
  } catch {
    ready = false;
  }
  return ready;
}

type Voice = { id: string; name?: string; language?: string; notInstalled?: boolean };

/** Choose a device voice matching the gender + language (last-resort fallback). */
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
  currentGender = gender;
  currentLanguage = language;
  currentVoice = await pickVoice(gender, language);
}

async function speakDevice(text: string): Promise<void> {
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

async function speakNow(text: string): Promise<void> {
  const spoken = text
    .replace(/[*_`#]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spoken) return;
  stopAudio();

  const useEleven = Date.now() >= elevenSkipUntil;
  if (useEleven) {
    try {
      const audio = await synthesizeSpeech(spoken, currentGender, currentLanguage);
      if (audio) {
        elevenMisses = 0;
        await playBase64Mp3(audio);
        return;
      }
    } catch {
      /* network — try again next utterance */
    }
    elevenMisses += 1;
    if (elevenMisses >= 3) {
      elevenSkipUntil = Date.now() + 60_000;
      elevenMisses = 0;
    }
  }

  await speakDevice(spoken);
}

/**
 * Speak with ElevenLabs (turn-by-turn and assistant replies).
 * Utterances are queued so a new instruction does not cut off the last one.
 * Falls back to the device voice only if ElevenLabs is unreachable.
 */
export async function speak(text: string): Promise<void> {
  const job = speakChain.then(() => speakNow(text));
  speakChain = job.catch(() => {});
  await job;
}

/** Set the voice then speak a short sample — used by the settings preview. */
export async function previewVoice(
  gender: AssistantGender,
  language: AssistantLanguage,
  sample: string,
): Promise<void> {
  await setAssistantVoice(gender, language);
  await speak(sample);
}

export function stopSpeaking(): void {
  speakChain = Promise.resolve();
  stopAudio();
  try {
    Tts.stop();
  } catch {
    /* nothing to stop */
  }
}
