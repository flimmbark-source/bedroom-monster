import type { ItemId } from './items';

export type Recipe = { a: ItemId; b: ItemId; out: ItemId };

export const RECIPES: Recipe[] = [
  { a: 'bottle', b: 'match', out: 'fire_bottle' },
  { a: 'yoyo',   b: 'knife', out: 'bladed_yoyo' },
  { a: 'knife',  b: 'bottle', out: 'glass_shiv' },
  { a: 'match',  b: 'bandaid', out: 'smoke_patch' },
  { a: 'soda',   b: 'bandaid', out: 'adrenal_patch' },
  { a: 'soda',   b: 'match', out: 'fizz_bomb' },
];

export function craft(a: ItemId, b: ItemId): ItemId | null {
  const r = RECIPES.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  return r ? r.out : null;
}
