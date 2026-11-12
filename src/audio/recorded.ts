/**
 * Loads the recorded sound effects (src/assets/audioManifest.ts) through the
 * asset store, after the game is up, and hands each one to the audio engine.
 * Until a file arrives, or if it can't load, that sound stays synthesised.
 */
import { AUDIO_ASSETS } from '../assets/audioManifest';
import { assets } from '../render/characterModels';
import type { AudioManager } from './AudioManager';

assets.register('audio', async (entry) => {
  const res = await fetch(entry.url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.arrayBuffer();
});

export function loadRecordedSounds(audio: AudioManager): void {
  const ids = AUDIO_ASSETS.map((a) => a.id);
  void assets.load(ids).then(() => {
    for (const id of ids) {
      const data = assets.get<ArrayBuffer>(id);
      if (data) audio.addRecorded(id, data);
    }
  });
}
