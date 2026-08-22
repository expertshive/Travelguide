import RNFS from 'react-native-fs';
import Sound from 'react-native-sound';

let current: Sound | null = null;
let counter = 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Hold the speaker for TTS. */
export function setSpeakerActive(): void {
  try {
    Sound.setCategory('Playback', true);
  } catch {
    /* native module unavailable */
  }
}

/** Drop exclusive audio focus so SpeechRecognizer can open the mic. */
export function setSpeakerIdle(): void {
  try {
    Sound.setCategory('Ambient', true);
  } catch {
    /* native module unavailable */
  }
}

setSpeakerActive();

/** Write base64 audio to a temp file and play it. Resolves when playback ends. */
export async function playBase64Mp3(base64: string): Promise<void> {
  await stopAudio();
  setSpeakerActive();
  counter += 1;
  const ext = base64.startsWith('UklG') ? 'wav' : 'mp3';
  const path = `${RNFS.CachesDirectoryPath}/tg-tts-${counter}.${ext}`;
  await RNFS.writeFile(path, base64, 'base64');

  return new Promise((resolve) => {
    const sound = new Sound(path, '', (err) => {
      if (err) {
        RNFS.unlink(path).catch(() => {});
        resolve();
        return;
      }
      current = sound;
      sound.play(() => {
        sound.release();
        if (current === sound) current = null;
        RNFS.unlink(path).catch(() => {});
        setSpeakerIdle();
        resolve();
      });
    });
  });
}

/** Stop playback and wait until the native player actually releases. */
export async function stopAudio(): Promise<void> {
  const sound = current;
  current = null;
  if (!sound) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        sound.release();
      } catch {
        /* already released */
      }
      resolve();
    };
    try {
      sound.stop(finish);
    } catch {
      finish();
    }
    setTimeout(finish, 700);
  });
  await delay(80);
}
