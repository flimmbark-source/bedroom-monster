import type { Item } from './items';

export type Inventory = [Item | null, Item | null];

export type Stats = { hp: number; maxHp: number; speed: number };

export type MonsterState = 'wander' | 'chase' | 'engage';
