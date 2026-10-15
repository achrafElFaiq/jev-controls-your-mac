// Text-to-speech with macOS's built-in `say` (free, offline). Utterances queue up
// and can be cut off instantly when the user says "stop".
import { spawn } from 'node:child_process';

export class Speaker {
  constructor({ voice = '', rate = 200, mute = false, onIdle = () => {} } = {}) {
    Object.assign(this, { voice, rate, mute, onIdle });
    this.queue = Promise.resolve();
    this.current = null;
    this.active = 0;
    this.generation = 0;
  }

  get speaking() { return this.active > 0; }

  speak(text) {
    if (!text || this.mute) return Promise.resolve();
    const gen = this.generation;
    this.active++;
    this.queue = this.queue.then(() => gen === this.generation && this.say(text)).finally(() => {
      if (--this.active === 0) this.onIdle();
    });
    return this.queue;
  }

  say(text) {
    return new Promise((resolve) => {
      const args = ['-r', String(this.rate)];
      if (this.voice) args.push('-v', this.voice);
      this.current = spawn('say', [...args, text], { stdio: 'ignore' });
      this.current.on('exit', () => { this.current = null; resolve(); });
      this.current.on('error', () => resolve());
    });
  }

  stop() {
    this.generation++;
    this.current?.kill();
  }
}
