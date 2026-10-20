import { INTRO, MUSIC, TIMING } from '../config';
import { YouTubeTrack, youtubeIdFromUrl } from './YouTubeTrack';
import { Html5Track } from './Html5Track';

/**
 * One music "role" (default BGM or fireworks BGM). Owns whichever backend is
 * working (YouTube or local file) and a gain that the director fades.
 */
class Channel {
  constructor(name, cfg, director) {
    this.name = name;
    this.cfg = cfg;
    this.director = director;
    this.track = null;
    this.gain = 0;
    this.target = 0;
    this.rate = 1; // gain units per second
    this.pauseAtZero = false;
    this.wantPlay = false;
  }

  async init() {
    const videoId = youtubeIdFromUrl(this.cfg.url);
    if (MUSIC.source !== 'local' && videoId) {
      try {
        const yt = new YouTubeTrack({
          videoId,
          loop: this.cfg.loop,
          loopFrom: this.cfg.startSeconds ?? 0,
          onFail: () => this.useLocalFallback(),
          onEnded: () => this.handleEnded(),
        });
        this.track = yt;
        await yt.ready;
        this.apply();
        return;
      } catch (err) {
        console.warn(`[audio] ${this.name}: YouTube unavailable →`, err.message);
      }
    }
    await this.useLocalFallback();
  }

  async useLocalFallback() {
    if (this.track?.kind === 'html5') return;
    this.track?.destroy?.();
    this.track = null;
    if (MUSIC.source === 'youtube' || !this.cfg.localSrc) return;

    const t = new Html5Track({ src: this.cfg.localSrc, loop: this.cfg.loop, onEnded: () => this.handleEnded() });
    this.director.attachHtml5(t);
    try {
      await t.ready;
    } catch (err) {
      console.warn(`[audio] ${this.name}: no playable source (${err.message})`);
      return;
    }
    this.track = t;
    this.apply();
    if (this.name === 'fireworks') t.seek(this.cfg.startSeconds ?? 0);
    if (this.wantPlay) t.play();
  }

  handleEnded() {
    if (this.wantPlay) this.director.handleEnded(this.name);
  }

  play({ fromStart = false } = {}) {
    this.wantPlay = true;
    this.pauseAtZero = false;
    if (!this.track) return;
    if (fromStart) this.track.seek(this.cfg.startSeconds ?? 0);
    this.track.play();
  }

  apply() {
    const v = this.gain * this.cfg.volume * (this.director.muted ? 0 : 1);
    this.track?.setVolume(v);
  }

  tick(dt) {
    if (this.gain !== this.target) {
      const step = this.rate * dt;
      this.gain = this.gain < this.target ? Math.min(this.target, this.gain + step) : Math.max(this.target, this.gain - step);
    }
    this.apply();
    if (this.gain === 0 && this.pauseAtZero) {
      this.pauseAtZero = false;
      this.track?.pause();
    }
  }

  get isPlaying() {
    return !!this.track?.isPlaying;
  }
}

class AudioDirector {
  constructor() {
    this.channels = {
      default: new Channel('default', MUSIC.default, this),
      fireworks: new Channel('fireworks', MUSIC.fireworks, this),
    };
    this.active = null;
    this.muted = false;
    this.unlocked = false;
    this.ctx = null;
    this.analyser = null;
    this.freq = null;
    this.html5 = [];
    this.initPromise = null;
    this.timer = null;
    this.onFireworksEnded = null; // set by showController
  }

  handleEnded(name) {
    if (name === 'fireworks' && this.active === 'fireworks') this.onFireworksEnded?.();
  }

  /** Create players early (no sound) so they're buffered by the time the visitor taps. */
  init() {
    if (!this.initPromise) {
      this.initPromise = Promise.all(Object.values(this.channels).map((c) => c.init()));
    }
    return this.initPromise;
  }

  attachHtml5(track) {
    this.html5.push(track);
    if (this.ctx && this.analyser) track.connect(this.ctx, this.analyser);
  }

  /** Call synchronously inside the intro click/tap. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.init();

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.78;
        this.analyser.connect(this.ctx.destination);
        this.freq = new Uint8Array(this.analyser.frequencyBinCount);
        this.html5.forEach((t) => t.connect(this.ctx, this.analyser));
        this.ctx.resume?.();
      }
    } catch (err) {
      console.warn('[audio] AudioContext unavailable', err);
    }

    // Buffer the fireworks track at 0:25 (muted) so the switch is instant.
    const fw = this.channels.fireworks;
    if (fw.track?.prime) fw.track.prime(fw.cfg.startSeconds ?? 0);

    this.playDefault({ initial: true });

    let last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      Object.values(this.channels).forEach((c) => c.tick(dt));
    }, 40);
  }

  playFireworks() {
    const fw = this.channels.fireworks;
    const df = this.channels.default;
    fw.gain = 0;
    fw.target = 1;
    fw.rate = 1 / Math.max(0.01, MUSIC.fireworks.fadeInSeconds ?? 0.2);
    fw.play({ fromStart: true }); // seeks to startSeconds (0:25)

    df.wantPlay = false;
    df.target = 0;
    df.rate = 1 / TIMING.crossfadeSeconds;
    df.pauseAtZero = true;

    this.active = 'fireworks';
  }

  playDefault({ initial = false } = {}) {
    const fw = this.channels.fireworks;
    const df = this.channels.default;
    df.target = 1;
    df.rate = 1 / (initial ? INTRO.musicFadeInSeconds : TIMING.crossfadeSeconds);
    df.play();

    fw.wantPlay = false;
    fw.target = 0;
    fw.rate = 1 / TIMING.crossfadeSeconds;
    fw.pauseAtZero = true;

    this.active = 'default';
  }

  setMuted(muted) {
    this.muted = muted;
    Object.values(this.channels).forEach((c) => c.apply());
  }

  /** 0..1 loudness estimate of what's currently audible (drives the visualizer). */
  getEnergy() {
    if (this.muted || !this.active) return 0;
    let e = 0;
    for (const c of Object.values(this.channels)) {
      if (c.isPlaying) e = Math.max(e, c.gain * (c.name === 'fireworks' ? 1 : 0.65));
    }
    return e;
  }

  /** Fills `out` with real spectrum bands when a local file is playing; returns false otherwise. */
  getLevels(out) {
    const ch = this.channels[this.active];
    if (!this.analyser || !ch || ch.track?.kind !== 'html5' || !ch.isPlaying || this.muted) return false;
    this.analyser.getByteFrequencyData(this.freq);
    const bins = this.freq.length;
    for (let i = 0; i < out.length; i++) {
      const a = Math.floor(Math.pow(i / out.length, 1.6) * bins * 0.7);
      const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / out.length, 1.6) * bins * 0.7));
      let sum = 0;
      for (let j = a; j < b; j++) sum += this.freq[j];
      out[i] = sum / (b - a) / 255;
    }
    return true;
  }
}

export const audio = new AudioDirector();
