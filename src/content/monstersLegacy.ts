import { MONSTERS, type MonsterDefinition as ContentMonsterDefinition, type MonsterId, type MonsterMove } from './monsters';

export type MoveId = MonsterMove['id'];

export type Move = {
  id: MoveId;
  cooldown: number;
  timings: MonsterMove['timings'];
};

export type LegacyMonsterDefinition = {
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

const FALLBACK_STATS: Record<MonsterId, {
  baseTint: number;
  speed: number;
  rageThreshold: number;
  rageSpeedMultiplier: number;
}> = {
  brine_walker: {
    baseTint: 0xffffff,
    speed: 140,
    rageThreshold: 0.4,
    rageSpeedMultiplier: 1.4,
  },
};

const toLegacyDefinition = (
  id: MonsterId,
  content: ContentMonsterDefinition,
): LegacyMonsterDefinition => {
  const defaults = FALLBACK_STATS[id];
  const moveOrder = content.moves.map((move) => move.id);
  const moves = content.moves.reduce<Record<MoveId, Move>>((acc, move) => {
    acc[move.id] = {
      id: move.id,
      cooldown: move.cooldown,
      timings: move.timings,
    };
    return acc;
  }, {} as Record<MoveId, Move>);

  return {
    id,
    name: content.label,
    baseTint: defaults?.baseTint ?? 0xffffff,
    stats: {
      hp: content.hp,
      speed: defaults?.speed ?? 120,
    },
    rage: {
      threshold: defaults?.rageThreshold ?? 0.5,
      speedMultiplier: defaults?.rageSpeedMultiplier ?? 1.2,
    },
    moveOrder,
    moves,
  };
};

export const LEGACY_MONSTERS: Record<MonsterId, LegacyMonsterDefinition> = Object.fromEntries(
  Object.entries(MONSTERS).map(([id, definition]) => [
    id as MonsterId,
    toLegacyDefinition(id as MonsterId, definition),
  ]),
) as Record<MonsterId, LegacyMonsterDefinition>;

export type { MonsterId } from './monsters';
