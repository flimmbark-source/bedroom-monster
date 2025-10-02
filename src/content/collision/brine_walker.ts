import type { HurtboxRig } from '../../combat/hurtbox_rig';

export const BRINE_WALKER_HURTBOX_RIG: HurtboxRig = {
  idle: {
    loop: true,
    frames: [
      {
        time: 0,
        shapes: [
          { kind: 'capsule', ax: -90, ay: 10, bx: 90, by: 10, r: 58 },
          { kind: 'circle', x: 110, y: 6, r: 40 },
          { kind: 'circle', x: -60, y: 4, r: 30 },
        ],
      },
      {
        time: 400,
        shapes: [
          { kind: 'capsule', ax: -92, ay: 8, bx: 94, by: 12, r: 58 },
          { kind: 'circle', x: 114, y: 8, r: 40 },
          { kind: 'circle', x: -62, y: 2, r: 30 },
        ],
      },
      {
        time: 800,
        shapes: [
          { kind: 'capsule', ax: -90, ay: 10, bx: 90, by: 10, r: 58 },
          { kind: 'circle', x: 110, y: 6, r: 40 },
          { kind: 'circle', x: -60, y: 4, r: 30 },
        ],
      },
    ],
  },
  chase: {
    loop: true,
    frames: [
      {
        time: 0,
        shapes: [
          { kind: 'capsule', ax: -95, ay: 6, bx: 104, by: 18, r: 54 },
          { kind: 'circle', x: 124, y: 20, r: 38 },
          { kind: 'circle', x: -70, y: -2, r: 28 },
        ],
      },
      {
        time: 350,
        shapes: [
          { kind: 'capsule', ax: -90, ay: 4, bx: 110, by: 20, r: 54 },
          { kind: 'circle', x: 128, y: 22, r: 38 },
          { kind: 'circle', x: -72, y: -6, r: 28 },
        ],
      },
      {
        time: 700,
        shapes: [
          { kind: 'capsule', ax: -95, ay: 6, bx: 104, by: 18, r: 54 },
          { kind: 'circle', x: 124, y: 20, r: 38 },
          { kind: 'circle', x: -70, y: -2, r: 28 },
        ],
      },
    ],
  },
  windup: {
    loop: false,
    frames: [
      {
        time: 0,
        shapes: [
          { kind: 'capsule', ax: -86, ay: 14, bx: 102, by: 32, r: 56 },
          { kind: 'circle', x: 136, y: 36, r: 42 },
          { kind: 'circle', x: -56, y: 0, r: 26 },
        ],
      },
      {
        time: 300,
        shapes: [
          { kind: 'capsule', ax: -80, ay: 20, bx: 112, by: 40, r: 54 },
          { kind: 'circle', x: 150, y: 44, r: 42 },
          { kind: 'circle', x: -52, y: -6, r: 24 },
        ],
      },
    ],
  },
  commit: {
    loop: false,
    frames: [
      {
        time: 0,
        shapes: [
          { kind: 'capsule', ax: -60, ay: 18, bx: 160, by: 36, r: 52 },
          { kind: 'circle', x: 190, y: 40, r: 38 },
          { kind: 'circle', x: -30, y: -8, r: 22 },
        ],
      },
      {
        time: 220,
        shapes: [
          { kind: 'capsule', ax: -54, ay: 16, bx: 170, by: 34, r: 50 },
          { kind: 'circle', x: 200, y: 38, r: 36 },
          { kind: 'circle', x: -28, y: -10, r: 22 },
        ],
      },
    ],
  },
  recover: {
    loop: false,
    frames: [
      {
        time: 0,
        shapes: [
          { kind: 'capsule', ax: -92, ay: 10, bx: 110, by: 22, r: 56 },
          { kind: 'circle', x: 132, y: 24, r: 38 },
          { kind: 'circle', x: -68, y: -4, r: 28 },
        ],
      },
      {
        time: 320,
        shapes: [
          { kind: 'capsule', ax: -98, ay: 8, bx: 104, by: 18, r: 56 },
          { kind: 'circle', x: 126, y: 22, r: 38 },
          { kind: 'circle', x: -72, y: -6, r: 28 },
        ],
      },
    ],
  },
  dash: {
    loop: false,
    frames: [
      {
        time: 0,
        shapes: [
          { kind: 'capsule', ax: -72, ay: -6, bx: 128, by: 18, r: 48 },
          { kind: 'circle', x: 150, y: 20, r: 34 },
          { kind: 'circle', x: -40, y: -22, r: 22 },
        ],
      },
      {
        time: 200,
        shapes: [
          { kind: 'capsule', ax: -70, ay: -8, bx: 132, by: 16, r: 48 },
          { kind: 'circle', x: 152, y: 18, r: 34 },
          { kind: 'circle', x: -44, y: -24, r: 22 },
        ],
      },
    ],
  },
};
