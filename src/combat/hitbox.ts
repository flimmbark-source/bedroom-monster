export type CommitWindow = {
  windupMs: number;
  activeMs: number;
  recoverMs: number;
};

export type HitboxPhase = 'idle' | 'windup' | 'active' | 'recover' | 'done';

export class HitboxTimeline {
  private elapsed = 0;
  private running = false;
  private looping = false;
  private totalDuration = 0;

  constructor(private readonly window: CommitWindow) {
    this.totalDuration = window.windupMs + window.activeMs + window.recoverMs;
  }

  start(loop = false) {
    this.elapsed = 0;
    this.running = true;
    this.looping = loop;
  }

  stop() {
    this.running = false;
    this.elapsed = 0;
  }

  advance(deltaMs: number) {
    if (!this.running) {
      return;
    }
    this.elapsed += deltaMs;
    if (this.looping) {
      this.elapsed = this.elapsed % this.totalDuration;
    } else if (this.elapsed >= this.totalDuration) {
      this.elapsed = this.totalDuration;
      this.running = false;
    }
  }

  get phase(): HitboxPhase {
    return phaseAtTime(this.window, this.elapsed, this.running);
  }

  get isActive() {
    const { windupMs, activeMs } = this.window;
    return this.elapsed >= windupMs && this.elapsed < windupMs + activeMs;
  }

  get time() {
    return this.elapsed;
  }

  get duration() {
    return this.totalDuration;
  }
}

export function phaseAtTime(window: CommitWindow, elapsed: number, running = true): HitboxPhase {
  const { windupMs, activeMs, recoverMs } = window;
  const total = windupMs + activeMs + recoverMs;
  if (!running && elapsed >= total) {
    return 'done';
  }
  if (elapsed < 0) {
    return 'idle';
  }
  if (elapsed < windupMs) {
    return 'windup';
  }
  if (elapsed < windupMs + activeMs) {
    return 'active';
  }
  if (elapsed < total) {
    return 'recover';
  }
  return running ? 'recover' : 'done';
}

export function clampToActive(window: CommitWindow, elapsed: number) {
  const { windupMs, activeMs } = window;
  const start = windupMs;
  const end = windupMs + activeMs;
  if (elapsed <= start) {
    return start;
  }
  if (elapsed >= end) {
    return end;
  }
  return elapsed;
}
