import type { ItemId } from '@game/types';
import type { RoomId } from '@game/world';
import type { MonsterId } from '@content/monsters';
import type { FurnitureLayoutEntry } from '../systems/SearchSystem';

export type Weighted<T> = { id: T; weight: number };
export type { RoomId };

export type SpawnPacing = {
  restockIntervalMs: number;
  restockInitialDelayMs?: number;
};

export type RoomSpawns = {
  restock: SpawnPacing;
  items: Weighted<ItemId>[];
  monsters: Weighted<MonsterId>[];
};

export type RoomConfig = {
  id: RoomId;
  size: { width: number; height: number };
  background: { key: string };
  furniture: FurnitureLayoutEntry[];
  restockPoints: { x: number; y: number }[];
  starterItems: ItemId[];
  spawns: RoomSpawns;
  keyDrops: Weighted<ItemId>[];
};

export function pickWeightedValue<T>(pool: Weighted<T>[], random: () => number = Math.random): T {
  const total = pool.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) {
    throw new Error('Weighted pool must contain at least one positive weight');
  }
  const roll = random() * total;
  let acc = 0;
  for (const entry of pool) {
    acc += Math.max(0, entry.weight);
    if (roll < acc) {
      return entry.id;
    }
  }
  return pool[pool.length - 1].id;
}

const ROOM_SIZE = { width: 1280, height: 720 } as const;

const RESTOCK_POINTS = [
  { x: 400, y: 360 },
  { x: 640, y: 360 },
  { x: 880, y: 360 },
  { x: 400, y: 560 },
  { x: 640, y: 560 },
  { x: 880, y: 560 },
];

const STARTER_ITEMS: ItemId[] = ['knife', 'bottle', 'soda', 'match', 'bandaid', 'yoyo'];

const RESTOCK_POOL: Weighted<ItemId>[] = [
  { id: 'knife', weight: 1 },
  { id: 'bottle', weight: 1 },
  { id: 'soda', weight: 1 },
  { id: 'match', weight: 1 },
  { id: 'bandaid', weight: 1 },
  { id: 'yoyo', weight: 1 },
];

const MONSTER_WEIGHTS: Weighted<MonsterId>[] = [{ id: 'brine_walker', weight: 1 }];

const SPAWN_PACING: SpawnPacing = { restockIntervalMs: 15000, restockInitialDelayMs: 15000 };

const EMPTY_KEY_DROPS: Weighted<ItemId>[] = [];

const HALLWAY_FURNITURE: FurnitureLayoutEntry[] = [
  {
    x: 330,
    y: 200,
    options: {
      searchable: true,
      name: 'Left Upper Bed',
      searchDuration: 2600,
      checkPoints: [0.85, 0.55, 0.25],
      findChance: 0.5,
      emoji: '🛏️',
      sprite: {
        frame: 'bed_single',
        offsetY: -20,
        depth: 2,
        scale: 0.525,
      },
      hitbox: {
        width: 132,
        height: 168,
        offsetX: -1.5,
        offsetY: 0,
      },
    },
  },
  {
    x: 640,
    y: 200,
    options: {
      searchable: true,
      name: 'Middle Upper Bed',
      searchDuration: 2600,
      checkPoints: [0.85, 0.55, 0.25],
      findChance: 0.5,
      emoji: '🛏️',
      sprite: {
        frame: 'bed_single',
        offsetY: -20,
        depth: 2,
        scale: 0.525,
      },
      hitbox: {
        width: 132,
        height: 168,
        offsetX: -1.5,
        offsetY: 0,
      },
    },
  },
  {
    x: 950,
    y: 200,
    options: {
      searchable: true,
      name: 'Right Upper Bed',
      searchDuration: 2600,
      checkPoints: [0.85, 0.55, 0.25],
      findChance: 0.5,
      emoji: '🛏️',
      sprite: {
        frame: 'bed_single',
        offsetY: -20,
        depth: 2,
        scale: 0.525,
        flipX: true,
      },
      hitbox: {
        width: 132,
        height: 168,
        offsetX: -1.5,
        offsetY: 0,
      },
    },
  },
  {
    x: 150,
    y: 200,
    options: {
      searchable: true,
      name: 'Locker A',
      searchDuration: 2200,
      checkPoints: [0.75, 0.4],
      findChance: 0.6,
      emoji: '🎒',
      sprite: {
        frame: 'dresser',
        offsetY: -40,
        depth: 2,
        scale: 0.7,
      },
      hitbox: {
        width: 95,
        height: 153,
        offsetX: 1,
        offsetY: 0.5,
      },
    },
  },
  {
    x: 500,
    y: 200,
    options: {
      searchable: true,
      name: 'Locker B',
      searchDuration: 2200,
      checkPoints: [0.75, 0.4],
      findChance: 0.6,
      emoji: '🎒',
      sprite: {
        frame: 'dresser',
        offsetY: -40,
        depth: 2,
        scale: 0.7,
      },
      hitbox: {
        width: 95,
        height: 153,
        offsetX: 1,
        offsetY: 0.5,
      },
    },
  },
  {
    x: 1110,
    y: 200,
    options: {
      searchable: true,
      name: 'Locker C',
      searchDuration: 2200,
      checkPoints: [0.75, 0.4],
      findChance: 0.6,
      emoji: '🎒',
      sprite: {
        frame: 'dresser',
        offsetY: -40,
        depth: 2,
        scale: 0.7,
        flipX: true,
      },
      hitbox: {
        width: 95,
        height: 153,
        offsetX: 1,
        offsetY: 0.5,
      },
    },
  },
  {
    x: 780,
    y: 200,
    options: {
      searchable: true,
      name: 'Locker D',
      searchDuration: 2200,
      checkPoints: [0.75, 0.4],
      findChance: 0.6,
      emoji: '🎒',
      sprite: {
        frame: 'dresser',
        offsetY: -40,
        depth: 2,
        scale: 0.7,
        flipX: true,
      },
      hitbox: {
        width: 95,
        height: 153,
        offsetX: 1,
        offsetY: 0.5,
      },
    },
  },
  {
    x: 480,
    y: 650,
    options: {
      searchable: true,
      name: 'Study Desk A',
      searchDuration: 2200,
      checkPoints: [0.75, 0.4],
      findChance: 0.6,
      emoji: '🖥️',
      sprite: {
        frame: 'desk_small',
        offsetY: -30,
        depth: 2,
        scale: 0.85,
      },
      hitbox: {
        units: 'world',
        width: 184,
        height: 109,
        offsetX: 1.3,
      },
    },
  },
  {
    x: 800,
    y: 650,
    options: {
      searchable: true,
      name: 'Study Desk B',
      searchDuration: 2200,
      checkPoints: [0.75, 0.4],
      findChance: 0.6,
      emoji: '🖥️',
      sprite: {
        frame: 'desk_small',
        offsetY: -30,
        depth: 2,
        scale: 0.85,
        flipX: true,
      },
      hitbox: {
        units: 'world',
        width: 184,
        height: 109,
        offsetX: 1.3,
      },
    },
  },
];

const INFIRMARY_FURNITURE: FurnitureLayoutEntry[] = [
  {
    x: 340,
    y: 220,
    options: {
      searchable: true,
      name: 'Exam Bed A',
      searchDuration: 2400,
      checkPoints: [0.8, 0.45],
      findChance: 0.55,
      emoji: '🛏️',
      sprite: {
        frame: 'exam_bed',
        offsetY: -26,
        depth: 2,
        scale: 0.92,
      },
      hitbox: {
        width: 128,
        height: 184,
        offsetY: -4,
      },
    },
  },
  {
    x: 640,
    y: 220,
    options: {
      searchable: true,
      name: 'Supply Locker',
      searchDuration: 2600,
      checkPoints: [0.75, 0.4],
      findChance: 0.6,
      emoji: '💊',
      sprite: {
        frame: 'cabinet_steel',
        offsetY: -38,
        depth: 2,
        scale: 0.78,
      },
      hitbox: {
        width: 102,
        height: 158,
      },
    },
  },
  {
    x: 940,
    y: 220,
    options: {
      searchable: true,
      name: 'Exam Bed B',
      searchDuration: 2400,
      checkPoints: [0.8, 0.45],
      findChance: 0.55,
      emoji: '🛏️',
      sprite: {
        frame: 'exam_bed',
        offsetY: -26,
        depth: 2,
        scale: 0.92,
        flipX: true,
      },
      hitbox: {
        width: 128,
        height: 184,
        offsetY: -4,
      },
    },
  },
  {
    x: 640,
    y: 560,
    options: {
      searchable: true,
      name: 'Waiting Chairs',
      searchDuration: 2100,
      checkPoints: [0.7, 0.4],
      findChance: 0.5,
      emoji: '🪑',
      sprite: {
        frame: 'waiting_chair',
        offsetY: -24,
        depth: 2,
        scale: 0.9,
      },
      hitbox: {
        units: 'world',
        width: 220,
        height: 120,
        offsetY: -6,
      },
    },
  },
];

const OFFICE_FURNITURE: FurnitureLayoutEntry[] = [
  {
    x: 360,
    y: 260,
    options: {
      searchable: true,
      name: 'Reception Desk',
      searchDuration: 2400,
      checkPoints: [0.75, 0.45],
      findChance: 0.6,
      emoji: '🖥️',
      sprite: {
        frame: 'office_desk',
        offsetY: -24,
        depth: 2,
        scale: 0.86,
      },
      hitbox: {
        units: 'world',
        width: 188,
        height: 120,
        offsetY: -4,
      },
    },
  },
  {
    x: 640,
    y: 240,
    options: {
      searchable: true,
      name: 'Filing Cabinet',
      searchDuration: 2200,
      checkPoints: [0.7, 0.4],
      findChance: 0.55,
      emoji: '🗂️',
      sprite: {
        frame: 'filing_cabinet',
        offsetY: -36,
        depth: 2,
        scale: 0.86,
      },
      hitbox: {
        width: 112,
        height: 160,
      },
    },
  },
  {
    x: 940,
    y: 260,
    options: {
      searchable: true,
      name: 'Reference Shelf',
      searchDuration: 2500,
      checkPoints: [0.8, 0.5],
      findChance: 0.58,
      emoji: '📚',
      sprite: {
        frame: 'bookshelf_tall',
        offsetY: -40,
        depth: 2,
        scale: 0.88,
      },
      hitbox: {
        width: 120,
        height: 184,
      },
    },
  },
  {
    x: 640,
    y: 600,
    options: {
      searchable: true,
      name: 'Break Table',
      searchDuration: 2100,
      checkPoints: [0.65, 0.35],
      findChance: 0.52,
      emoji: '☕',
      sprite: {
        frame: 'desk_small',
        offsetY: -30,
        depth: 2,
        scale: 0.82,
      },
      hitbox: {
        units: 'world',
        width: 176,
        height: 112,
      },
    },
  },
];

const KITCHEN_FURNITURE: FurnitureLayoutEntry[] = [
  {
    x: 320,
    y: 240,
    options: {
      searchable: true,
      name: 'Pantry Cabinets',
      searchDuration: 2400,
      checkPoints: [0.8, 0.45],
      findChance: 0.6,
      emoji: '🥫',
      sprite: {
        frame: 'cabinet_wall',
        offsetY: -44,
        depth: 2,
        scale: 0.86,
      },
      hitbox: {
        width: 118,
        height: 168,
      },
    },
  },
  {
    x: 640,
    y: 260,
    options: {
      searchable: true,
      name: 'Kitchen Island',
      searchDuration: 2300,
      checkPoints: [0.75, 0.4],
      findChance: 0.58,
      emoji: '🔪',
      sprite: {
        frame: 'kitchen_island',
        offsetY: -24,
        depth: 2,
        scale: 0.9,
      },
      hitbox: {
        units: 'world',
        width: 220,
        height: 132,
      },
    },
  },
  {
    x: 960,
    y: 240,
    options: {
      searchable: true,
      name: 'Cold Storage',
      searchDuration: 2500,
      checkPoints: [0.8, 0.5],
      findChance: 0.6,
      emoji: '🧊',
      sprite: {
        frame: 'fridge',
        offsetY: -40,
        depth: 2,
        scale: 0.92,
      },
      hitbox: {
        width: 128,
        height: 184,
      },
    },
  },
  {
    x: 640,
    y: 600,
    options: {
      searchable: true,
      name: 'Prep Counter',
      searchDuration: 2200,
      checkPoints: [0.7, 0.4],
      findChance: 0.55,
      emoji: '🍽️',
      sprite: {
        frame: 'counter',
        offsetY: -24,
        depth: 2,
        scale: 0.9,
      },
      hitbox: {
        units: 'world',
        width: 200,
        height: 122,
      },
    },
  },
];

const ENTRANCE_FURNITURE: FurnitureLayoutEntry[] = [
  {
    x: 360,
    y: 240,
    options: {
      searchable: true,
      name: 'Welcome Desk',
      searchDuration: 2300,
      checkPoints: [0.75, 0.4],
      findChance: 0.58,
      emoji: '📝',
      sprite: {
        frame: 'desk_small',
        offsetY: -28,
        depth: 2,
        scale: 0.88,
      },
      hitbox: {
        units: 'world',
        width: 184,
        height: 116,
      },
    },
  },
  {
    x: 640,
    y: 240,
    options: {
      searchable: true,
      name: 'Lobby Sofa',
      searchDuration: 2000,
      checkPoints: [0.65, 0.35],
      findChance: 0.5,
      emoji: '🛋️',
      sprite: {
        frame: 'sofa',
        offsetY: -20,
        depth: 2,
        scale: 0.9,
      },
      hitbox: {
        units: 'world',
        width: 260,
        height: 120,
      },
    },
  },
  {
    x: 940,
    y: 240,
    options: {
      searchable: true,
      name: 'Storage Cabinet',
      searchDuration: 2400,
      checkPoints: [0.75, 0.45],
      findChance: 0.58,
      emoji: '📦',
      sprite: {
        frame: 'cabinet_wood',
        offsetY: -38,
        depth: 2,
        scale: 0.86,
      },
      hitbox: {
        width: 112,
        height: 164,
      },
    },
  },
  {
    x: 640,
    y: 580,
    options: {
      searchable: true,
      name: 'Planter',
      searchDuration: 1900,
      checkPoints: [0.6, 0.35],
      findChance: 0.48,
      emoji: '🌿',
      sprite: {
        frame: 'plant',
        offsetY: -22,
        depth: 2,
        scale: 0.9,
      },
      hitbox: {
        units: 'world',
        width: 120,
        height: 118,
      },
    },
  },
];

export const ROOMS: Record<RoomId, RoomConfig> = {
  hallway: {
    id: 'hallway',
    size: { ...ROOM_SIZE },
    background: { key: 'bg_hallway' },
    furniture: HALLWAY_FURNITURE,
    restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    starterItems: [...STARTER_ITEMS],
    spawns: {
      restock: { ...SPAWN_PACING },
      items: RESTOCK_POOL.map((entry) => ({ ...entry })),
      monsters: MONSTER_WEIGHTS.map((entry) => ({ ...entry })),
    },
    keyDrops: [...EMPTY_KEY_DROPS],
  },
  infirmary: {
    id: 'infirmary',
    size: { ...ROOM_SIZE },
    background: { key: 'bg_infirmary' },
    furniture: INFIRMARY_FURNITURE,
    restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    starterItems: [...STARTER_ITEMS],
    spawns: {
      restock: { ...SPAWN_PACING },
      items: RESTOCK_POOL.map((entry) => ({ ...entry })),
      monsters: MONSTER_WEIGHTS.map((entry) => ({ ...entry })),
    },
    keyDrops: [...EMPTY_KEY_DROPS],
  },
  office: {
    id: 'office',
    size: { ...ROOM_SIZE },
    background: { key: 'bg_office' },
    furniture: OFFICE_FURNITURE,
    restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    starterItems: [...STARTER_ITEMS],
    spawns: {
      restock: { ...SPAWN_PACING },
      items: RESTOCK_POOL.map((entry) => ({ ...entry })),
      monsters: MONSTER_WEIGHTS.map((entry) => ({ ...entry })),
    },
    keyDrops: [...EMPTY_KEY_DROPS],
  },
  kitchen: {
    id: 'kitchen',
    size: { ...ROOM_SIZE },
    background: { key: 'bg_kitchen' },
    furniture: KITCHEN_FURNITURE,
    restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    starterItems: [...STARTER_ITEMS],
    spawns: {
      restock: { ...SPAWN_PACING },
      items: RESTOCK_POOL.map((entry) => ({ ...entry })),
      monsters: MONSTER_WEIGHTS.map((entry) => ({ ...entry })),
    },
    keyDrops: [...EMPTY_KEY_DROPS],
  },
  entrance: {
    id: 'entrance',
    size: { ...ROOM_SIZE },
    background: { key: 'bg_entrance' },
    furniture: ENTRANCE_FURNITURE,
    restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    starterItems: [...STARTER_ITEMS],
    spawns: {
      restock: { ...SPAWN_PACING },
      items: RESTOCK_POOL.map((entry) => ({ ...entry })),
      monsters: MONSTER_WEIGHTS.map((entry) => ({ ...entry })),
    },
    keyDrops: [...EMPTY_KEY_DROPS],
  },
};
