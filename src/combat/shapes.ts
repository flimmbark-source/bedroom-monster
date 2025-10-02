import Phaser from 'phaser';

export type Vec2 = {
  x: number;
  y: number;
};

export type Circle = {
  kind: 'circle';
  x: number;
  y: number;
  r: number;
};

export type Capsule = {
  kind: 'capsule';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
};

export type HurtShape = Circle | Capsule;

export type HurtboxPart = 'core' | 'head' | 'tail' | 'extra';

export type Hurtbox = {
  part: HurtboxPart;
  shape: HurtShape;
};

export type TeamId = 'player' | 'monster' | 'neutral';

export type Team = {
  id: TeamId;
  hostileTo: TeamId[];
};

export function getShapeBounds(shape: HurtShape) {
  if (shape.kind === 'circle') {
    const { x, y, r } = shape;
    return new Phaser.Geom.Rectangle(x - r, y - r, r * 2, r * 2);
  }
  const minX = Math.min(shape.ax, shape.bx) - shape.r;
  const minY = Math.min(shape.ay, shape.by) - shape.r;
  const maxX = Math.max(shape.ax, shape.bx) + shape.r;
  const maxY = Math.max(shape.ay, shape.by) + shape.r;
  return new Phaser.Geom.Rectangle(minX, minY, maxX - minX, maxY - minY);
}

export function cloneShape(shape: HurtShape): HurtShape {
  if (shape.kind === 'circle') {
    const { x, y, r } = shape;
    return { kind: 'circle', x, y, r };
  }
  const { ax, ay, bx, by, r } = shape;
  return { kind: 'capsule', ax, ay, bx, by, r };
}

export function lerpShape(a: HurtShape, b: HurtShape, t: number): HurtShape {
  const lt = Phaser.Math.Clamp(t, 0, 1);
  if (a.kind === 'circle' && b.kind === 'circle') {
    return {
      kind: 'circle',
      x: Phaser.Math.Linear(a.x, b.x, lt),
      y: Phaser.Math.Linear(a.y, b.y, lt),
      r: Phaser.Math.Linear(a.r, b.r, lt),
    };
  }
  if (a.kind === 'capsule' && b.kind === 'capsule') {
    return {
      kind: 'capsule',
      ax: Phaser.Math.Linear(a.ax, b.ax, lt),
      ay: Phaser.Math.Linear(a.ay, b.ay, lt),
      bx: Phaser.Math.Linear(a.bx, b.bx, lt),
      by: Phaser.Math.Linear(a.by, b.by, lt),
      r: Phaser.Math.Linear(a.r, b.r, lt),
    };
  }
  return cloneShape(lt < 0.5 ? a : b);
}
