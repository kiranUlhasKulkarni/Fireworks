/**
 * Local-file audio track (e.g. /public/audio/default.mp3).
 * When an AudioContext is available the element is routed through a GainNode
 * (so crossfades also work on iOS) and an AnalyserNode (so the visualizer
 * reacts to the real music).
 */
export class Html5Track {
  kind = 'html5';

  constructor({ src, loop = false, onEnded }) {
    const el = new Audio();
    el.preload = 'auto';
    el.loop = loop;
    el.crossOrigin = 'anonymous';
    el.playsInline = true;
    el.src = src;
    this.el = el;
    this.gainNode = null;
    this.source = null;
    this.volume = 0;
    this.shouldPlay = false;
    el.volume = 0;
    el.addEventListener('ended', () => {
      this.shouldPlay = false;
      onEnded?.();
    });

    this.ready = new Promise((resolve, reject) => {
      el.addEventListener('canplay', () => resolve(this), { once: true });
      el.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true });
      el.load();
    });
  }

  connect(ctx, destination) {
    if (this.source) return;
    try {
      this.source = ctx.createMediaElementSource(this.el);
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = this.volume;
      this.source.connect(this.gainNode).connect(destination);
      this.el.volume = 1;
    } catch (err) {
      console.warn('[audio] Web Audio routing unavailable, using element volume', err);
    }
  }

  play() {
    this.shouldPlay = true;
    this.el.play()?.catch(() => {});
  }

  pause() {
    this.shouldPlay = false;
    this.el.pause();
  }

  seek(seconds) {
    try {
      this.el.currentTime = seconds;
    } catch {
      /* not seekable yet */
    }
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.gainNode) this.gainNode.gain.value = this.volume;
    else this.el.volume = this.volume;
  }

  get isPlaying() {
    return !this.el.paused;
  }

  destroy() {
    this.el.pause();
    this.el.removeAttribute('src');
  }
}
