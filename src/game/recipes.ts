import type { ItemId } from './items';

export type Recipe = { a: ItemId; b: ItemId; out: ItemId };

export const RECIPES: Recipe[] = [
  { a: 'bandaid', b: 'match', out: 'smoke_patch' },
  { a: 'bandaid', b: 'soda', out: 'adrenal_patch' },
  { a: 'bottle', b: 'knife', out: 'glass_shiv' },
  { a: 'bottle', b: 'match', out: 'fire_bottle' },
  { a: 'match', b: 'soda', out: 'fizz_bomb' },
  { a: 'knife', b: 'yoyo', out: 'bladed_yoyo' },
];

const RECIPE_LOOKUP = RECIPES.reduce<Map<string, ItemId>>((acc, recipe) => {
  const key = createKey(recipe.a, recipe.b);
  acc.set(key, recipe.out);
  return acc;
}, new Map());

function createKey(a: ItemId, b: ItemId) {
  return [a, b].sort().join('::');
}

export function craft(a?: ItemId | null, b?: ItemId | null): ItemId | null {
  if (!a || !b) return null;
  const key = createKey(a, b);
  return RECIPE_LOOKUP.get(key) ?? null;
}
