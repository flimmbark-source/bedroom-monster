export type MonsterId = 'brine_walker';

export type MoveId = 'sweep' | 'smash' | 'rush' | 'roar';

export type Move = {
  id: MoveId;
  cooldown: number;
  timings: {
    preWarn: number;
    windUp: number;
    commit: number;
    recovery: number;
  };
};

export type MonsterDefinition = {
  id: MonsterId;
  name: string;
  baseTint: number;
  stats: {
    hp: number;
    speed: number;
  };
  rage: {
    threshold: number;
    speedMultiplier: number;
  };
  moveOrder: MoveId[];
  moves: Record<MoveId, Move>;
};

export const MONSTERS: Record<MonsterId, MonsterDefinition> = {
  brine_walker: {
    id: 'brine_walker',
    name: 'Brine Walker',
    baseTint: 0xffffff,
    stats: {
      hp: 12,
      speed: 140,
    },
    rage: {
      threshold: 0.4,
      speedMultiplier: 1.4,
    },
    moveOrder: ['sweep', 'smash', 'rush', 'roar'],
    moves: {
      sweep: {
        id: 'sweep',
        cooldown: 2.5,
        timings: { preWarn: 250, windUp: 350, commit: 200, recovery: 400 },
      },
      smash: {
        id: 'smash',
        cooldown: 4,
        timings: { preWarn: 300, windUp: 450, commit: 180, recovery: 450 },
      },
      rush: {
        id: 'rush',
        cooldown: 5,
        timings: { preWarn: 300, windUp: 400, commit: 300, recovery: 500 },
      },
      roar: {
        id: 'roar',
        cooldown: 7,
        timings: { preWarn: 250, windUp: 350, commit: 150, recovery: 350 },
      },
    },
  },
};
