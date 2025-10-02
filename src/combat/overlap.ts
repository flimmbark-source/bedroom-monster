import Phaser from 'phaser';
import type { Capsule, Circle, HurtShape, Vec2 } from './shapes';

const EPS = 1e-6;

function vec(x: number, y: number): Vec2 {
  return { x, y };
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return vec(a.x - b.x, a.y - b.y);
}

function add(a: Vec2, b: Vec2): Vec2 {
  return vec(a.x + b.x, a.y + b.y);
}

function scale(v: Vec2, s: number): Vec2 {
  return vec(v.x * s, v.y * s);
}

function dot(a: Vec2, b: Vec2) {
  return a.x * b.x + a.y * b.y;
}

function lenSq(v: Vec2) {
  return dot(v, v);
}

function clamp01(t: number) {
  return Phaser.Math.Clamp(t, 0, 1);
}

function distancePointSegmentSq(point: Vec2, a: Vec2, b: Vec2) {
  const ab = sub(b, a);
  const ap = sub(point, a);
  const denom = lenSq(ab);
  if (denom < EPS) {
    return lenSq(ap);
  }
  const t = clamp01(dot(ap, ab) / denom);
  const closest = add(a, scale(ab, t));
  return lenSq(sub(point, closest));
}

function segmentSegmentDistanceSq(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2) {
  const u = sub(a1, a0);
  const v = sub(b1, b0);
  const w = sub(a0, b0);
  const a = dot(u, u);
  const b = dot(u, v);
  const c = dot(v, v);
  const d = dot(u, w);
  const e = dot(v, w);
  const denom = a * c - b * b;

  let s: number;
  let t: number;

  if (a < EPS && c < EPS) {
    return lenSq(w);
  }

  if (a < EPS) {
    s = 0;
    t = clamp01(e / c);
  } else if (c < EPS) {
    t = 0;
    s = clamp01(-d / a);
  } else if (denom < EPS) {
    s = 0;
    t = clamp01(e / c);
  } else {
    s = clamp01((b * e - c * d) / denom);
    t = (b * s + e) / c;
    if (t < 0) {
      t = 0;
      s = clamp01(-d / a);
    } else if (t > 1) {
      t = 1;
      s = clamp01((b - d) / a);
    }
  }

  const pA = add(a0, scale(u, s));
  const pB = add(b0, scale(v, t));
  return lenSq(sub(pA, pB));
}

function capsuleCapsuleDistSq(a: Capsule, b: Capsule) {
  const a0 = vec(a.ax, a.ay);
  const a1 = vec(a.bx, a.by);
  const b0 = vec(b.ax, b.ay);
  const b1 = vec(b.bx, b.by);
  return segmentSegmentDistanceSq(a0, a1, b0, b1);
}

function circleCircleOverlap(a: Circle, b: Circle) {
  const distSq = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const r = a.r + b.r;
  return distSq <= r * r + EPS;
}

function circleCapsuleOverlap(circle: Circle, capsule: Capsule) {
  const pt = vec(circle.x, circle.y);
  const a = vec(capsule.ax, capsule.ay);
  const b = vec(capsule.bx, capsule.by);
  const distSq = distancePointSegmentSq(pt, a, b);
  const rad = circle.r + capsule.r;
  return distSq <= rad * rad + EPS;
}

function capsuleCapsuleOverlap(a: Capsule, b: Capsule) {
  const distSq = capsuleCapsuleDistSq(a, b);
  const rad = a.r + b.r;
  return distSq <= rad * rad + EPS;
}

export function shapesOverlap(a: HurtShape, b: HurtShape) {
  if (a.kind === 'circle' && b.kind === 'circle') {
    return circleCircleOverlap(a, b);
  }
  if (a.kind === 'circle' && b.kind === 'capsule') {
    return circleCapsuleOverlap(a, b);
  }
  if (a.kind === 'capsule' && b.kind === 'circle') {
    return circleCapsuleOverlap(b, a);
  }
  return capsuleCapsuleOverlap(a as Capsule, b as Capsule);
}

export function distanceToShape(point: Vec2, shape: HurtShape) {
  if (shape.kind === 'circle') {
    const dist = Math.sqrt((point.x - shape.x) ** 2 + (point.y - shape.y) ** 2);
    return Math.max(0, dist - shape.r);
  }
  const a = vec(shape.ax, shape.ay);
  const b = vec(shape.bx, shape.by);
  const distSq = distancePointSegmentSq(point, a, b);
  return Math.max(0, Math.sqrt(distSq) - shape.r);
}

export function shapesIntersect(shapesA: HurtShape[], shapesB: HurtShape[]) {
  for (const a of shapesA) {
    for (const b of shapesB) {
      if (shapesOverlap(a, b)) {
        return true;
      }
    }
  }
  return false;
}
