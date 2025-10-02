export type MonsterId = 'brine_walker';

export type MonsterMoveId = 'sweep' | 'smash' | 'rush' | 'roar';

export type MonsterMovePhase = 'preWarn' | 'windUp' | 'commit' | 'recovery';

export type MonsterMoveShape =
  | {
      type: 'arc';
      radius: number;
      spread: number;
      origin: 'self' | 'target';
      track?: boolean;
      phases: MonsterMovePhase[];
    }
  | {
      type: 'circle';
      radius: number;
      origin: 'self' | 'target';
      track?: boolean;
      phases: MonsterMovePhase[];
    }
  | {
      type: 'lane';
      length: number;
      halfWidth: number;
      origin: 'self';
      track?: boolean;
      phases: MonsterMovePhase[];
    }
  | {
      type: 'ring';
      innerRadius: number;
      outerRadius: number;
      origin: 'self';
      phases: MonsterMovePhase[];
    };

export type MonsterMove = {
  id: MonsterMoveId;
  label: string;
  cooldown: number;
  timings: Record<MonsterMovePhase, number>;
  shapes: MonsterMoveShape[];
};

export type MonsterDefinition = {
  label: string;
  hp: number;
  moves: MonsterMove[];
};

export const MONSTERS: Record<MonsterId, MonsterDefinition> = {
  brine_walker: {
    label: 'Brine Walker',
    hp: 12,
    moves: [
      {
        id: 'sweep',
        label: 'Tidal Sweep',
        cooldown: 2.5,
        timings: {
          preWarn: 250,
          windUp: 350,
          commit: 200,
          recovery: 400,
        },
        shapes: [
          {
            type: 'arc',
            radius: 140,
            spread: 120,
            origin: 'self',
            track: true,
            phases: ['preWarn', 'windUp', 'commit'],
          },
        ],
      },
      {
        id: 'smash',
        label: 'Anchor Smash',
        cooldown: 4,
        timings: {
          preWarn: 300,
          windUp: 450,
          commit: 180,
          recovery: 450,
        },
        shapes: [
          {
            type: 'circle',
            radius: 100,
            origin: 'target',
            track: true,
            phases: ['preWarn', 'windUp', 'commit'],
          },
        ],
      },
      {
        id: 'rush',
        label: 'Undertow Rush',
        cooldown: 5,
        timings: {
          preWarn: 300,
          windUp: 400,
          commit: 300,
          recovery: 500,
        },
        shapes: [
          {
            type: 'lane',
            length: 420,
            halfWidth: 32,
            origin: 'self',
            track: true,
            phases: ['preWarn', 'windUp', 'commit'],
          },
        ],
      },
      {
        id: 'roar',
        label: 'Brine Roar',
        cooldown: 7,
        timings: {
          preWarn: 250,
          windUp: 350,
          commit: 150,
          recovery: 350,
        },
        shapes: [
          {
            type: 'ring',
            innerRadius: 0,
            outerRadius: 250,
            origin: 'self',
            phases: ['preWarn', 'windUp', 'commit'],
          },
        ],
      },
    ],
  },
};
