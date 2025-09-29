import type { Item, ItemId } from './types';

export const ITEM_TEXTURE_KEYS: Record<ItemId, string> = {
  match: 'item-matches',
  knife: 'item-knife',
  soda: 'item-soda',
  bottle: 'item-empty-bottle',
  bandaid: 'item-bandaid',
  yoyo: 'item-yoyo',

  fire_bottle: 'item-soda',
  bladed_yoyo: 'item-yoyo',
  glass_shiv: 'item-knife',
  smoke_patch: 'item-bandaid',
  adrenal_patch: 'item-bandaid',
  fizz_bomb: 'item-soda',
};

export const ITEM_TEXTURE_PATHS: Record<string, string> = {
  'item-matches': 'assets/sprites/matches.png',
  'item-knife': 'assets/sprites/pocket_knife.png',
  'item-soda': 'assets/sprites/bottle.png',
  'item-empty-bottle': 'assets/sprites/empty_bottle.png',
  'item-bandaid': 'assets/sprites/bandaid.png',
  'item-yoyo': 'assets/sprites/yoyo.png',
};

export const BASE_ITEMS: Record<ItemId, Item> = {
  match: { id: 'match', label: 'Match', uses: 2, icon: ITEM_TEXTURE_KEYS.match },
  knife: { id: 'knife', label: 'Pocket Knife', uses: 5, icon: ITEM_TEXTURE_KEYS.knife },
  soda: { id: 'soda', label: 'Soda', uses: 2, icon: ITEM_TEXTURE_KEYS.soda },
  bottle: { id: 'bottle', label: 'Empty Bottle', uses: 1, icon: ITEM_TEXTURE_KEYS.bottle },
  bandaid: { id: 'bandaid', label: 'Bandaid', uses: 1, icon: ITEM_TEXTURE_KEYS.bandaid },
  yoyo: { id: 'yoyo', label: 'Yoyo', uses: 3, icon: ITEM_TEXTURE_KEYS.yoyo },

  fire_bottle: { id: 'fire_bottle', label: 'Fire Bottle', uses: 1, icon: ITEM_TEXTURE_KEYS.fire_bottle },
  bladed_yoyo: { id: 'bladed_yoyo', label: 'Bladed Yoyo', uses: 3, icon: ITEM_TEXTURE_KEYS.bladed_yoyo },
  glass_shiv: { id: 'glass_shiv', label: 'Glass Shiv', uses: 2, icon: ITEM_TEXTURE_KEYS.glass_shiv },
  smoke_patch: { id: 'smoke_patch', label: 'Smoke Patch', uses: 1, icon: ITEM_TEXTURE_KEYS.smoke_patch },
  adrenal_patch: { id: 'adrenal_patch', label: 'Adrenal Patch', uses: 1, icon: ITEM_TEXTURE_KEYS.adrenal_patch },
  fizz_bomb: { id: 'fizz_bomb', label: 'Fizz Pop Bomb', uses: 1, icon: ITEM_TEXTURE_KEYS.fizz_bomb },
};

export function cloneItem(id: ItemId): Item { const b = BASE_ITEMS[id]; return { ...b, data: { ...(b.data||{}) } }; }
