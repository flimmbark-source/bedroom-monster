export type ItemId =
  | 'match' | 'knife' | 'soda' | 'bottle' | 'bandaid' | 'yoyo'
  | 'fire_bottle' | 'bladed_yoyo' | 'glass_shiv' | 'smoke_patch' | 'adrenal_patch' | 'fizz_bomb';

export type Item = {
  id: ItemId;
  label: string;
  uses: number;
  icon: string;
  data?: Record<string, unknown>;
};

export type Inventory = [Item | null, Item | null];

export type Stats = { hp: number; maxHp: number; speed: number };

export type MonsterState = 'wander' | 'chase' | 'engage';
