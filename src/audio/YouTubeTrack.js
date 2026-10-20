/**
 * A hidden YouTube IFrame player used purely as an audio source.
 *
 * Notes
 *  - The player is 200×200 (YouTube's minimum) and parked invisibly behind the
 *    WebGL canvas. display:none would stop playback in some browsers.
 *  - Volume is 0..1 here; YouTube wants 0..100.
 *  - iOS ignores programmatic volume, so crossfades become hard cuts there.
 */

let apiPromise = null;

export function loadYouTubeApi(timeoutMs = 12000) {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const timer = setTimeout(() => reject(new Error('YouTube IFrame API timed out')), timeoutMs);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Could not load the YouTube IFrame API'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function youtubeIdFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null;
    return u.searchParams.get('v');
  } catch {
    return /^[\w-]{11}$/.test(url) ? url : null; // already a bare id
  }
}

function getHost() {
  let host = document.getElementById('yt-audio-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'yt-audio-host';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
  }
  return host;
}

const PLAYING = 1;
const ENDED = 0;
const BUFFERING = 3;

export class YouTubeTrack {
  kind = 'youtube';

  constructor({ videoId, loop = false, loopFrom = 0, onFail, onEnded }) {
    this.videoId = videoId;
    this.onEnded = onEnded;
    this.loop = loop;
    this.loopFrom = loopFrom;
    this.onFail = onFail;

    this.player = null;
    this.isReady = false;
    this.failed = false;
    this.state = -1;
    this.shouldPlay = false;
    this.pendingSeek = null;
    this.pendingPrime = null;
    this.priming = false;
    this.primeAt = 0;
    this.desiredVolume = 0;
    this.appliedVolume = -1;

    const mount = document.createElement('div');
    getHost().appendChild(mount);

    this.ready = loadYouTubeApi().then(
      (YT) =>
        new Promise((resolve, reject) => {
          this.player = new YT.Player(mount, {
            width: '200',
            height: '200',
            videoId,
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              modestbranding: 1,
              playsinline: 1,
              rel: 0,
              origin: window.location.origin,
            },
            events: {
              onReady: () => {
                this.isReady = true;
                this.flushPending();
                resolve(this);
              },
              onStateChange: (e) => this.handleState(e.data),
              onError: (e) => {
                // 2 bad id · 5 html5 error · 100 removed · 101/150 embedding disabled
                console.warn(`[audio] YouTube error ${e.data} for video ${videoId}`);
                this.failed = true;
                if (!this.isReady) reject(new Error(`YouTube error ${e.data}`));
                else this.onFail?.();
              },
            },
          });
        }),
    );
  }

  flushPending() {
    this.applyVolume(true);
    if (this.pendingPrime != null) {
      const at = this.pendingPrime;
      this.pendingPrime = null;
      this.prime(at);
    }
    if (this.pendingSeek != null) {
      this.player.seekTo(this.pendingSeek, true);
      this.pendingSeek = null;
    }
    if (this.shouldPlay) {
      this.player.unMute();
      this.player.playVideo();
    }
  }

  handleState(s) {
    this.state = s;
    if (s === PLAYING && this.priming) {
      this.priming = false;
      if (!this.shouldPlay) {
        this.player.pauseVideo();
        this.player.seekTo(this.primeAt, true);
      }
      this.player.unMute();
    }
    if (s === ENDED && this.shouldPlay) {
      if (this.loop) {
        this.player.seekTo(this.loopFrom, true);
        this.player.playVideo();
      } else {
        this.shouldPlay = false;
        this.onEnded?.();
      }
    }
  }

  /** Silently buffer the track at `at` seconds so a later play() starts instantly. */
  prime(at) {
    this.primeAt = at;
    if (!this.isReady) {
      this.pendingPrime = at;
      return;
    }
    if (this.shouldPlay) return;
    this.priming = true;
    this.player.mute();
    this.player.seekTo(at, true);
    this.player.playVideo();
  }

  play() {
    this.shouldPlay = true;
    if (!this.isReady) return;
    this.player.unMute();
    this.player.playVideo();
  }

  pause() {
    this.shouldPlay = false;
    if (this.isReady) this.player.pauseVideo();
  }

  seek(seconds) {
    if (this.isReady) this.player.seekTo(seconds, true);
    else this.pendingSeek = seconds;
  }

  setVolume(v) {
    this.desiredVolume = v;
    this.applyVolume(false);
  }

  applyVolume(force) {
    if (!this.isReady) return;
    const vol = Math.round(Math.min(1, Math.max(0, this.desiredVolume)) * 100);
    if (force || vol !== this.appliedVolume) {
      this.player.setVolume(vol);
      this.appliedVolume = vol;
    }
  }

  get isPlaying() {
    return this.shouldPlay && (this.state === PLAYING || this.state === BUFFERING);
  }

  destroy() {
    try {
      this.player?.destroy();
    } catch {
      /* ignore */
    }
  }
}
