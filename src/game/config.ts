export const ROOM_W = 1200;
export const ROOM_H = 900;

export const PLAYER_BASE = { hp: 5, maxHp: 5, speed: 200 } as const;
export const MONSTER_BASE = { hp: 12, speed: 160 } as const; // slower than player; tuned in-scene
