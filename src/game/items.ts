import type { Item, ItemId } from './types';

export const BASE_ITEMS: Record<ItemId, Item> = {
  match: { id: 'match', label: 'Match', uses: 2 },
  knife: { id: 'knife', label: 'Pocket Knife', uses: 5 },
  soda: { id: 'soda', label: 'Soda', uses: 2 },
  bottle: { id: 'bottle', label: 'Empty Bottle', uses: 1 },
  bandaid: { id: 'bandaid', label: 'Bandaid', uses: 1 },
  yoyo: { id: 'yoyo', label: 'Yoyo', uses: 3 },

  fire_bottle: { id: 'fire_bottle', label: 'Fire Bottle', uses: 1 },
  bladed_yoyo: { id: 'bladed_yoyo', label: 'Bladed Yoyo', uses: 3 },
  glass_shiv: { id: 'glass_shiv', label: 'Glass Shiv', uses: 2 },
  smoke_patch: { id: 'smoke_patch', label: 'Smoke Patch', uses: 1 },
  adrenal_patch: { id: 'adrenal_patch', label: 'Adrenal Patch', uses: 1 },
  fizz_bomb: { id: 'fizz_bomb', label: 'Fizz Pop Bomb', uses: 1 },
};

export function cloneItem(id: ItemId): Item { const b = BASE_ITEMS[id]; return { ...b, data: { ...(b.data||{}) } }; }
