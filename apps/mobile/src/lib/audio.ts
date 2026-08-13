import RNFS from 'react-native-fs';
import Sound from 'react-native-sound';

// Play through the speaker even when the ringer switch is silent.
Sound.setCategory('Playback', true);

let current: Sound | null = null;
let counter = 0;

/** Write base64 mp3 to a temp file and play it. Resolves when playback ends. */
export async function playBase64Mp3(base64: string): Promise<void> {
  stopAudio();
  counter += 1;
  const path = `${RNFS.CachesDirectoryPath}/tg-tts-${counter}.mp3`;
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
        resolve();
      });
    });
  });
}

export function stopAudio(): void {
  if (current) {
    try {
      current.stop();
      current.release();
    } catch {
      /* already released */
    }
    current = null;
  }
}
