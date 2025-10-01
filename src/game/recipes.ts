import type { ItemId } from './items';

export type Recipe = { a: ItemId; b: ItemId; out: ItemId };

export const RECIPES: Recipe[] = [
  { a: 'tape_roll', b: 'flare', out: 'ink_smoke' },
  { a: 'tape_roll', b: 'saline', out: 'brined_salt' },
  { a: 'cooking_oil', b: 'stapler', out: 'ledger_spike' },
  { a: 'cooking_oil', b: 'flare', out: 'ledger_bomb' },
  { a: 'flare', b: 'saline', out: 'salt' },
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
