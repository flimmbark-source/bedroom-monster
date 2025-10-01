import { Capsule, Circle } from './shapes';
import { HURTBOX_SPECS, type HurtSpec } from './hurtbox';

export type MonsterStateTag =
  | 'idle'
  | 'chase'
  | 'windup'
  | 'commit'
  | 'recover'
  | 'dash'
  | 'guard'
  | 'iframes';

export type MonsterPose = {
  x: number;
  y: number;
  angle: number;
  state: MonsterStateTag;
  species: keyof typeof HURTBOX_SPECS;
  invulMs?: number;
};

export type HurtboxShapeInstance = {
  part: 'core' | 'head' | 'tail';
  shape: Capsule | Circle;
};

const SMOOTH = 0.25;

export class MonsterHurtbox {
  private prev = { x: 0, y: 0, angle: 0 };
  private initialized = false;

  constructor(private readonly species: keyof typeof HURTBOX_SPECS) {}

  update(pose: MonsterPose) {
    if (!this.initialized) {
      this.prev.x = pose.x;
      this.prev.y = pose.y;
      this.prev.angle = pose.angle;
      this.initialized = true;
      return;
    }

    this.prev.x = this.prev.x * (1 - SMOOTH) + pose.x * SMOOTH;
    this.prev.y = this.prev.y * (1 - SMOOTH) + pose.y * SMOOTH;
    this.prev.angle = this.prev.angle * (1 - SMOOTH) + pose.angle * SMOOTH;
  }

  shapes(pose: MonsterPose): HurtboxShapeInstance[] {
    const spec: HurtSpec = HURTBOX_SPECS[this.species];
    const ang = this.prev.angle;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);

    const slim = pose.state === 'dash' && spec.dashShrink ? spec.dashShrink : 1;

    const half = spec.core.halfLen * slim;
    const r = spec.core.radius * slim;

    const fx = this.prev.x;
    const fy = this.prev.y + spec.core.footOffsetY;

    const ax = fx - ca * half;
    const ay = fy - sa * half;
    const bx = fx + ca * half;
    const by = fy + sa * half;

    const shapes: HurtboxShapeInstance[] = [
      { part: 'core', shape: { kind: 'capsule', ax, ay, bx, by, r } },
    ];

    if (spec.head) {
      const hx = fx + ca * spec.head.offset;
      const hy = fy + sa * spec.head.offset;
      shapes.push({ part: 'head', shape: { kind: 'circle', x: hx, y: hy, r: spec.head.radius } });
    }

    if (spec.tail) {
      const tx = fx - ca * spec.tail.offset;
      const ty = fy - sa * spec.tail.offset;
      shapes.push({ part: 'tail', shape: { kind: 'circle', x: tx, y: ty, r: spec.tail.radius } });
    }

    return shapes;
  }

  backOnlyMultiplier(attackerX: number, attackerY: number, arcDeg = 120) {
    const ang = this.prev.angle;
    const dx = attackerX - this.prev.x;
    const dy = attackerY - this.prev.y;
    const rel = Math.atan2(dy, dx) - ang;
    const wrapped = Math.atan2(Math.sin(rel), Math.cos(rel));
    const a = Math.abs(wrapped);
    const max = (arcDeg * Math.PI) / 180 * 0.5;
    return a > Math.PI - max ? 1 : 0;
  }

  get center() {
    return { x: this.prev.x, y: this.prev.y };
  }
}
