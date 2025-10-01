import Phaser from 'phaser';

export type Capsule = {
  kind: 'capsule';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
};

export type Circle = {
  kind: 'circle';
  x: number;
  y: number;
  r: number;
};

export type HurtShape = Capsule | Circle;

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
