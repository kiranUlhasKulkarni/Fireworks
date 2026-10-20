import { Vector3 } from 'three';
import { TIMING } from '../config';
import { WORLD } from '../scene/world';
import { mulberry32 } from '../utils/random';
import { ParticlePool } from './ParticlePool';
import { ShowProgram } from './choreography';
import { evalTrajectory, solveLaunchVelocity } from './physics';
import { createSmokeMaterial, createSparkMaterial, KIND } from './shaders';
import { burstShell, emitFlash, emitStar, spawnPuff } from './shells';
import { makePuffTexture } from './textures';

// 360° show: three sectors at full density. Particles are packed to 44 bytes
// (ParticlePool.js), so 1.4 M sparks ≈ 62 MB. Lower these (and COUNT in
// shells.js) if phones struggle.
const SPARK_CAPACITY = 1_400_000;
const SMOKE_CAPACITY = 44_000;
const SECTORS = 3; // each runs its own ShowProgram over 360° / SECTORS of sky
const ROCKET_GOLD = [1.0, 0.68, 0.32];
const TRAIL_GOLD = [1.0, 0.58, 0.24];

const forward = new Vector3();

/**
 * Owns both particle pools and runs the show timeline. Everything is
 * scheduled against the render clock so bursts land at exact times even if a
 * frame is late.
 */
export class FireworksEngine {
  constructor() {
    this.puff = makePuffTexture();
    this.sparkMat = createSparkMaterial();
    this.smokeMat = createSmokeMaterial(this.puff);
    this.sparks = new ParticlePool(SPARK_CAPACITY, this.sparkMat);
    this.smoke = new ParticlePool(SMOKE_CAPACITY, this.smokeMat);
    this.smoke.points.renderOrder = 10;
    this.sparks.points.renderOrder = 11;

    this.rng = mulberry32((Math.random() * 2 ** 31) | 0);
    this.ctx = { sparks: this.sparks, smoke: this.smoke, rng: this.rng, viewer: [0, 5, 10] };

    this.cycle = 0;
    this.programs = null; // [{ center, program }] while a show runs
    this.pending = [];
    this.showClock = 0;
    this.lastTime = 0;
    this.queuedSparkles = [];
    this.v0 = [0, 0, 0];
    this.target = [0, 0, 0];
    this.launchPos = [0, 0, 0];
    this.tmp = [0, 0, 0];
  }

  setMaxPointSize(px) {
    this.sparkMat.uniforms.uMaxSize.value = px;
    this.smokeMat.uniforms.uMaxSize.value = px;
  }

  /** Little burst of pink glitter at the heart when it's clicked. */
  sparkle(pos) {
    this.queuedSparkles.push(pos.slice());
  }

  update(time, show, camera, viewportWidthPx, viewportHeightPx) {
    this.lastTime = time;

    // New show started?
    if (show.cycle !== this.cycle && show.phase === 'active') {
      this.cycle = show.cycle;
      this.showClock = time - (performance.now() - show.startedAt) / 1000;
      // Sector 0 faces the camera at the click (it gets the giant opening heart).
      camera.getWorldDirection(forward);
      const az0 = Math.atan2(forward.x, forward.z);
      this.programs = Array.from({ length: SECTORS }, (_, k) => ({
        center: az0 + (k * Math.PI * 2) / SECTORS,
        program: new ShowProgram(mulberry32((this.rng() * 2 ** 31) | 0), { grand: k === 0 }),
      }));
      this.pending.length = 0;
      this.sparkMat.uniforms.uCutoff.value = this.showClock - 0.001;
      this.smokeMat.uniforms.uCutoff.value = this.showClock - 0.001;
    }

    this.ctx.viewer[0] = camera.position.x;
    this.ctx.viewer[1] = camera.position.y;
    this.ctx.viewer[2] = camera.position.z;

    const showT = time - this.showClock;
    if (this.programs && show.phase === 'active') {
      // Continuous 360°: keep ~6 s of shells planned ahead in every sector
      // (longest rocket flight is ~4 s), so any direction is already full.
      for (const { center, program } of this.programs) {
        program.planUntil(showT + 6);
        const q = program.queue;
        while (q.length && q[0].launchAt <= showT) {
          const shell = q.shift();
          const birth = this.showClock + shell.launchAt;
          if (time - birth < 2.5) this.launch(shell, birth, center);
        }
      }
    } else if (this.programs) {
      // Faded stop: nothing new is spawned — not even shells already in flight.
      this.programs = null;
      this.pending.length = 0;
    }

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const b = this.pending[i];
      if (b.time <= time) {
        burstShell(this.ctx, b);
        this.pending.splice(i, 1);
      }
    }

    for (const pos of this.queuedSparkles) this.emitSparkle(pos, time);
    this.queuedSparkles.length = 0;

    // Fade-out: let everything burn out naturally, then disintegrate what's left.
    let dissolve = 0;
    if (this.cycle > 0 && show.phase !== 'active') {
      const p = show.phase === 'fading' ? Math.min(1, Math.max(0, (performance.now() - show.stoppedAt) / 1000 / TIMING.fadeOutSeconds)) : 1;
      dissolve = 1.15 * Math.pow(p, 1.8);
    }

    const fovRad = (camera.fov * Math.PI) / 180;
    const scale = viewportHeightPx / (2 * Math.tan(fovRad / 2));
    this.sparkMat.uniforms.uResolution.value.set(viewportWidthPx, viewportHeightPx);
    for (const mat of [this.sparkMat, this.smokeMat]) {
      mat.uniforms.uScale.value = scale;
      mat.uniforms.uDissolve.value = dissolve;
    }

    this.sparks.flush();
    this.smoke.flush();
  }

  launch(shell, birth, sectorCenter) {
    const { rng } = this;
    const az = sectorCenter + shell.az * (Math.PI / SECTORS) * 1.08; // slight overlap between sectors
    const target = this.target;
    target[0] = Math.sin(az) * shell.dist;
    target[1] = shell.height;
    target[2] = Math.cos(az) * shell.dist;

    const L = this.launchPos;
    L[0] = target[0] + (rng() - 0.5) * 10;
    L[1] = WORLD.groundY + 1;
    L[2] = target[2] + (rng() - 0.5) * 10;

    const k = 0.45;
    const g = 1.0;
    const T = shell.flight;
    const v0 = solveLaunchVelocity(this.v0, L, target, k, g, T);

    // Rocket head + short streak
    emitStar(this.ctx, {
      p: L, v: v0, birth, life: T, drag: k, grav: g,
      color: ROCKET_GOLD, intensity: 5, size: 1.3,
      tails: 5, tailGap: 0.022, kind: KIND.ROCKET,
    });

    // Sparkling trail + thin smoke column
    const ctx = this.ctx;
    const tmp = this.tmp;
    for (let t = 0.02; t < T; t += 0.024) {
      evalTrajectory(tmp, L, v0, k, g, t);
      tmp[0] += (rng() - 0.5) * 0.2;
      tmp[2] += (rng() - 0.5) * 0.2;
      emitStar(ctx, {
        p: tmp,
        v: [(rng() - 0.5) * 2.4, (rng() - 0.5) * 2.4 - 1, (rng() - 0.5) * 2.4],
        birth: birth + t, life: 0.35 + rng() * 0.6, drag: 2.0, grav: 0.4,
        color: TRAIL_GOLD, intensity: 2.2, size: 0.45, freq: 25, kind: KIND.EMBER,
      });
    }
    for (let t = 0.05; t < T; t += 0.14) {
      evalTrajectory(tmp, L, v0, k, g, t);
      spawnPuff(ctx, tmp, birth + t, {
        size: 2.2, growth: 0.6, life: 3.5 + rng() * 1.5,
        tint: TRAIL_GOLD, glow: 0.25, alpha: 0.12, spread: 0.5,
      });
    }
    emitFlash(ctx, L, birth, ROCKET_GOLD, 4, 1.5, 0.15);

    this.pending.push({
      time: birth + T,
      pos: evalTrajectory([0, 0, 0], L, v0, k, g, T),
      type: shell.type,
      scale: shell.scale,
      colorA: shell.colorA,
      colorB: shell.colorB,
      pistil: shell.pistil,
    });
  }

  emitSparkle(pos, time) {
    const { rng } = this;
    for (let i = 0; i < 70; i++) {
      const u = rng() * 2 - 1;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const s = 0.6 + rng() * 1.1;
      emitStar(this.ctx, {
        p: pos,
        v: [Math.cos(a) * r * s, u * s + 0.3, Math.sin(a) * r * s],
        birth: time,
        life: 0.8 + rng() * 0.9,
        drag: 2.4,
        grav: 0.04,
        color: rng() < 0.5 ? [1.0, 0.35, 0.6] : [1.0, 0.8, 0.9],
        intensity: 4,
        size: 0.035 + rng() * 0.03,
        freq: 10 + rng() * 8,
        kind: rng() < 0.3 ? KIND.STROBE : KIND.STAR,
      });
    }
  }

  dispose() {
    this.sparks.dispose();
    this.smoke.dispose();
    this.sparkMat.dispose();
    this.smokeMat.dispose();
    this.puff.dispose();
  }
}
