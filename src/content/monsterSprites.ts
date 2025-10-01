import type { MonsterId } from './monsters';

export type MonsterDirection = 'up' | 'down' | 'left' | 'right';

type MonsterSpriteFrameConfig = {
  width: number;
  height: number;
  margin?: number;
  spacing?: number;
};

type MonsterSpriteAnimationConfig = {
  keyPrefix: string;
  framesPerDirection: number;
  directions: Record<MonsterDirection, number>;
};

type MonsterSpriteCollisionConfig = {
  visibleTop: number;
  visibleBottom: number;
};

type MonsterSpriteFrameRates = {
  idle?: number;
  walk?: number;
};

export type MonsterSpriteDefinition = {
  textureKey: string;
  texturePath: string;
  frame: MonsterSpriteFrameConfig;
  animations: MonsterSpriteAnimationConfig;
  collision: MonsterSpriteCollisionConfig;
  frameRates?: MonsterSpriteFrameRates;
};

export const MONSTER_SPRITES: Record<MonsterId, MonsterSpriteDefinition> = {
  brine_walker: {
    textureKey: 'monster',
    texturePath: 'assets/sprites/monster.png',
    frame: {
      width: 184,
      height: 275,
    },
    animations: {
      keyPrefix: 'monster',
      framesPerDirection: 4,
      directions: {
        down: 0,
        right: 1,
        left: 2,
        up: 3,
      },
    },
    collision: {
      visibleTop: 38,
      visibleBottom: 22,
    },
    frameRates: {
      idle: 1,
      walk: 7,
    },
  },
};
