import Tts from 'react-native-tts';
import type { AssistantGender, AssistantLanguage } from './assistantPrefs';
import { synthesizeSpeech } from './assistant';
import { playBase64Mp3, setSpeakerIdle, stopAudio } from './audio';

/** Known iOS voice-name hints per gender (Android voice ids usually contain the gender). */
const FEMALE_HINTS = [
  'female',
  'samantha',
  'karen',
  'moira',
  'tessa',
  'fiona',
  'victoria',
  'allison',
  'ava',
  'susan',
  'zoe',
  'nicky',
  'laila',
  'layla',
  'amira',
  'hala',
  'sara',
  'zariyah',
];
const MALE_HINTS = [
  'male',
  'aaron',
  'fred',
  'daniel',
  'alex',
  'tom',
  'rishi',
  'oliver',
  'arthur',
  'gordon',
  'maged',
  'tarik',
];

let ready: boolean | null = null;
let currentVoice: string | null = null;
let currentLanguage: AssistantLanguage = 'en-US';
let currentGender: AssistantGender = 'female';
/** Consecutive cloud TTS misses. Reset on success; retry after a cooldown. */
let elevenMisses = 0;
let elevenSkipUntil = 0;
let speakChain: Promise<void> = Promise.resolve();
/** Bumped on stop so an in-flight job cannot start a second voice. */
let speakGen = 0;

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

function hushDevice(): void {
  try {
    Tts.stop();
  } catch {
    /* nothing to stop */
  }
}

type Voice = { id: string; name?: string; language?: string; notInstalled?: boolean };

/** Choose a device voice matching the gender + language (last-resort fallback). */
async function pickVoice(
  gender: AssistantGender,
  language: AssistantLanguage,
): Promise<string | null> {
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

function onTtsEvent(event: string, handler: () => void): () => void {
  const sub = Tts.addEventListener(event, handler) as { remove?: () => void } | undefined;
  if (sub && typeof sub.remove === 'function') {
    return () => sub.remove?.();
  }
  return () => {
    try {
      Tts.removeEventListener(event, handler);
    } catch {
      /* older API */
    }
  };
}

/** Device TTS fallback. Waits until it finishes so cloud audio never overlaps it. */
async function speakDevice(text: string, gen: number): Promise<void> {
  if (!(await ensureReady()) || gen !== speakGen) return;
  hushDevice();
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
  if (gen !== speakGen) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      offFinish();
      offCancel();
      offError();
      resolve();
    };
    const offFinish = onTtsEvent('tts-finish', finish);
    const offCancel = onTtsEvent('tts-cancel', finish);
    const offError = onTtsEvent('tts-error', finish);
    const watchdog = setTimeout(finish, Math.min(45_000, 900 + text.length * 90));
    try {
      Tts.speak(text);
    } catch {
      finish();
    }
  });
}

async function speakNow(text: string, gen: number): Promise<void> {
  const spoken = text
    .replace(/[*_`#]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spoken || gen !== speakGen) return;

  hushDevice();
  await stopAudio();

  const useCloud = Date.now() >= elevenSkipUntil;
  if (useCloud) {
    try {
      const audio = await synthesizeSpeech(spoken, currentGender, currentLanguage);
      if (gen !== speakGen) return;
      if (audio) {
        elevenMisses = 0;
        hushDevice();
        await playBase64Mp3(audio);
        return;
      }
    } catch {
      /* network — try again next utterance */
    }
    if (gen !== speakGen) return;
    elevenMisses += 1;
    if (elevenMisses >= 3) {
      elevenSkipUntil = Date.now() + 60_000;
      elevenMisses = 0;
    }
  }

  await speakDevice(spoken, gen);
}

/**
 * Speak with cloud TTS (turn-by-turn and assistant replies).
 * Utterances are queued. Device TTS is only used if cloud audio is unavailable,
 * and never at the same time as cloud playback.
 */
export async function speak(text: string): Promise<void> {
  const gen = speakGen;
  const job = speakChain.then(() => speakNow(text, gen));
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

export async function stopSpeaking(): Promise<void> {
  speakGen += 1;
  speakChain = Promise.resolve();
  hushDevice();
  await stopAudio();
  setSpeakerIdle();
  await new Promise((resolve) => setTimeout(resolve, 400));
}
