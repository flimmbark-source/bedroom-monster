import type { ItemId } from '@game/types';
import type { KeyId, RoomId } from '@game/world';
import type { MonsterId } from '@content/monsters';
import type { FurnitureLayoutEntry } from '../systems/SearchSystem';

export type Weighted<T> = readonly [value: T, weight: number];
export type { RoomId };

export type RoomConfig = {
  id: RoomId;
  size: { width: number; height: number };
  backgroundKey: string;
  furniture: FurnitureLayoutEntry[];
  itemPool: {
    starters: ItemId[];
    restock: Weighted<ItemId>[];
  };
  monsters: Weighted<MonsterId>[];
  spawns: {
    restock: SpawnPacing;
    restockPoints: { x: number; y: number }[];
  };
  keysHere: Weighted<KeyId>[];
};

export type SpawnPacing = {
  restockIntervalMs: number;
  restockInitialDelayMs?: number;
};

export type RoomSpawns = {
  restock: SpawnPacing;
  items: Weighted<ItemId>[];
  monsters: Weighted<MonsterId>[];
};

export function pickWeightedValue<T>(pool: Weighted<T>[], random: () => number = Math.random): T {
  const total = pool.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  if (total <= 0) {
    throw new Error('Weighted pool must contain at least one positive weight');
  }
  const roll = random() * total;
  let acc = 0;
  for (const [value, weight] of pool) {
    acc += Math.max(0, weight);
    if (roll < acc) {
      return value;
    }
  }
  return pool[pool.length - 1][0];
}

export function cloneWeightedPool<T>(pool: Weighted<T>[]): Weighted<T>[] {
  return pool.map(([value, weight]) => [value, weight] as Weighted<T>);
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

type ItemPoolConfig = RoomConfig['itemPool'];

const ROOM_ITEM_POOLS: Record<RoomId, ItemPoolConfig> = {
  bedroom: {
    starters: ['knife', 'bottle', 'soda', 'match', 'bandaid', 'yoyo'],
    restock: [
      ['knife', 8],
      ['bottle', 8],
      ['soda', 6],
      ['match', 5],
      ['bandaid', 5],
      ['yoyo', 4],
    ],
  },
  hallway: {
    starters: ['knife', 'bottle', 'tacks', 'match'],
    restock: [
      ['knife', 6],
      ['bottle', 5],
      ['soda', 5],
      ['match', 4],
      ['bandaid', 3],
      ['tacks', 3],
      ['flashlight', 2],
    ],
  },
  infirmary: {
    starters: ['bandaid', 'soda', 'sterile_wrap', 'smoke_patch'],
    restock: [
      ['bandaid', 6],
      ['sterile_wrap', 4],
      ['smoke_patch', 3],
      ['adrenal_patch', 3],
      ['soda', 4],
      ['match', 2],
    ],
  },
  office: {
    starters: ['knife', 'flashlight', 'tacks', 'bottle'],
    restock: [
      ['flashlight', 4],
      ['tacks', 4],
      ['glass_shiv', 3],
      ['smoke_patch', 3],
      ['adrenal_patch', 2],
      ['bottle', 3],
      ['knife', 2],
    ],
  },
  kitchen: {
    starters: ['bottle', 'soda', 'match', 'knife'],
    restock: [
      ['bottle', 5],
      ['soda', 4],
      ['match', 3],
      ['fire_bottle', 3],
      ['fizz_bomb', 2],
      ['glass_shiv', 2],
    ],
  },
  entrance: {
    starters: ['fire_bottle', 'smoke_patch', 'adrenal_patch', 'tacks'],
    restock: [
      ['fire_bottle', 4],
      ['bladed_yoyo', 3],
      ['glass_shiv', 3],
      ['smoke_patch', 3],
      ['adrenal_patch', 3],
      ['tacks', 2],
      ['flashlight', 2],
    ],
  },
};

const ROOM_MONSTER_POOLS: Record<RoomId, Weighted<MonsterId>[]> = {
  bedroom: [['brine_walker', 1]],
  hallway: [['brine_walker', 1]],
  infirmary: [['brine_walker', 1]],
  office: [['brine_walker', 1]],
  kitchen: [['brine_walker', 1]],
  entrance: [['brine_walker', 1]],
};

const ROOM_SPAWN_PACING: Record<RoomId, SpawnPacing> = {
  bedroom: { restockIntervalMs: 12000, restockInitialDelayMs: 8000 },
  hallway: { restockIntervalMs: 15000, restockInitialDelayMs: 15000 },
  infirmary: { restockIntervalMs: 17000, restockInitialDelayMs: 15000 },
  office: { restockIntervalMs: 18000, restockInitialDelayMs: 16000 },
  kitchen: { restockIntervalMs: 20000, restockInitialDelayMs: 16000 },
  entrance: { restockIntervalMs: 24000, restockInitialDelayMs: 20000 },
};

const ROOM_KEY_DROPS: Record<RoomId, Weighted<KeyId>[]> = {
  bedroom: [],
  hallway: [],
  infirmary: [['nurse_badge', 1]],
  office: [['admin_badge', 1]],
  kitchen: [
    ['pantry_key', 1],
    ['front_door_key', 1],
  ],
  entrance: [],
};

const BEDROOM_FURNITURE: FurnitureLayoutEntry[] = [
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

const HALLWAY_FURNITURE: FurnitureLayoutEntry[] = [
  // TODO: Populate once hallway prop layout is finalized.
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
  bedroom: {
    id: 'bedroom',
    size: { ...ROOM_SIZE },
    backgroundKey: 'bg_bedroom',
    furniture: BEDROOM_FURNITURE,
    itemPool: {
      starters: [...ROOM_ITEM_POOLS.bedroom.starters],
      restock: cloneWeightedPool(ROOM_ITEM_POOLS.bedroom.restock),
    },
    monsters: cloneWeightedPool(ROOM_MONSTER_POOLS.bedroom),
    spawns: {
      restock: { ...ROOM_SPAWN_PACING.bedroom },
      restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    },
    keysHere: cloneWeightedPool(ROOM_KEY_DROPS.bedroom),
  },
  hallway: {
    id: 'hallway',
    size: { ...ROOM_SIZE },
    backgroundKey: 'bg_hallway',
    furniture: HALLWAY_FURNITURE,
    itemPool: {
      starters: [...ROOM_ITEM_POOLS.hallway.starters],
      restock: cloneWeightedPool(ROOM_ITEM_POOLS.hallway.restock),
    },
    monsters: cloneWeightedPool(ROOM_MONSTER_POOLS.hallway),
    spawns: {
      restock: { ...ROOM_SPAWN_PACING.hallway },
      restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    },
    keysHere: cloneWeightedPool(ROOM_KEY_DROPS.hallway),
  },
  infirmary: {
    id: 'infirmary',
    size: { ...ROOM_SIZE },
    backgroundKey: 'bg_infirmary',
    furniture: INFIRMARY_FURNITURE,
    itemPool: {
      starters: [...ROOM_ITEM_POOLS.infirmary.starters],
      restock: cloneWeightedPool(ROOM_ITEM_POOLS.infirmary.restock),
    },
    monsters: cloneWeightedPool(ROOM_MONSTER_POOLS.infirmary),
    spawns: {
      restock: { ...ROOM_SPAWN_PACING.infirmary },
      restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    },
    keysHere: cloneWeightedPool(ROOM_KEY_DROPS.infirmary),
  },
  office: {
    id: 'office',
    size: { ...ROOM_SIZE },
    backgroundKey: 'bg_office',
    furniture: OFFICE_FURNITURE,
    itemPool: {
      starters: [...ROOM_ITEM_POOLS.office.starters],
      restock: cloneWeightedPool(ROOM_ITEM_POOLS.office.restock),
    },
    monsters: cloneWeightedPool(ROOM_MONSTER_POOLS.office),
    spawns: {
      restock: { ...ROOM_SPAWN_PACING.office },
      restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    },
    keysHere: cloneWeightedPool(ROOM_KEY_DROPS.office),
  },
  kitchen: {
    id: 'kitchen',
    size: { ...ROOM_SIZE },
    backgroundKey: 'bg_kitchen',
    furniture: KITCHEN_FURNITURE,
    itemPool: {
      starters: [...ROOM_ITEM_POOLS.kitchen.starters],
      restock: cloneWeightedPool(ROOM_ITEM_POOLS.kitchen.restock),
    },
    monsters: cloneWeightedPool(ROOM_MONSTER_POOLS.kitchen),
    spawns: {
      restock: { ...ROOM_SPAWN_PACING.kitchen },
      restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    },
    keysHere: cloneWeightedPool(ROOM_KEY_DROPS.kitchen),
  },
  entrance: {
    id: 'entrance',
    size: { ...ROOM_SIZE },
    backgroundKey: 'bg_entrance',
    furniture: ENTRANCE_FURNITURE,
    itemPool: {
      starters: [...ROOM_ITEM_POOLS.entrance.starters],
      restock: cloneWeightedPool(ROOM_ITEM_POOLS.entrance.restock),
    },
    monsters: cloneWeightedPool(ROOM_MONSTER_POOLS.entrance),
    spawns: {
      restock: { ...ROOM_SPAWN_PACING.entrance },
      restockPoints: RESTOCK_POINTS.map((point) => ({ ...point })),
    },
    keysHere: cloneWeightedPool(ROOM_KEY_DROPS.entrance),
  },
};
