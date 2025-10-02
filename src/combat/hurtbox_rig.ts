import { cloneShape, lerpShape, type HurtShape } from './shapes';

export type HurtboxRigKeyframe = {
  time: number;
  shapes: HurtShape[];
};

export type HurtboxRigTrack = {
  loop: boolean;
  frames: HurtboxRigKeyframe[];
};

export type HurtboxRig = Record<string, HurtboxRigTrack>;

function normalizeTime(track: HurtboxRigTrack, time: number) {
  if (track.frames.length === 0) {
    return 0;
  }
  const duration = track.frames[track.frames.length - 1].time;
  if (duration <= 0) {
    return 0;
  }
  if (!track.loop) {
    return Math.max(0, Math.min(time, duration));
  }
  const wrapped = time % duration;
  return wrapped < 0 ? wrapped + duration : wrapped;
}

function interpolateShapes(prev: HurtShape[], next: HurtShape[], t: number) {
  const count = Math.min(prev.length, next.length);
  const result: HurtShape[] = [];
  for (let i = 0; i < count; i += 1) {
    result.push(lerpShape(prev[i], next[i], t));
  }
  if (prev.length > count) {
    for (let i = count; i < prev.length; i += 1) {
      result.push(cloneShape(prev[i]));
    }
  } else if (next.length > count) {
    for (let i = count; i < next.length; i += 1) {
      result.push(cloneShape(next[i]));
    }
  }
  return result;
}

export function sampleHurtboxRig(
  rig: HurtboxRig,
  state: string,
  time: number
): HurtShape[] {
  const track = rig[state];
  if (!track || track.frames.length === 0) {
    return [];
  }

  if (track.frames.length === 1) {
    return track.frames[0].shapes.map((shape) => cloneShape(shape));
  }

  const normalizedTime = normalizeTime(track, time);

  let prev = track.frames[0];
  for (let i = 1; i < track.frames.length; i += 1) {
    const frame = track.frames[i];
    if (normalizedTime < frame.time) {
      const span = frame.time - prev.time;
      const t = span <= 0 ? 0 : (normalizedTime - prev.time) / span;
      return interpolateShapes(prev.shapes, frame.shapes, t);
    }
    prev = frame;
  }

  const last = track.frames[track.frames.length - 1];
  if (track.loop) {
    const first = track.frames[0];
    const span = last.time;
    const t = span <= 0 ? 0 : (normalizedTime - last.time) / (span === 0 ? 1 : span);
    return interpolateShapes(last.shapes, first.shapes, t);
  }
  return last.shapes.map((shape) => cloneShape(shape));
}
