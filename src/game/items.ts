export type ItemIcon = { key: string; frame?: number };

export type ItemId =
  | 'match'
  | 'knife'
  | 'soda'
  | 'bottle'
  | 'bandaid'
  | 'yoyo'
  | 'tacks'
  | 'flashlight'
  | 'sterile_wrap'
  | 'fire_bottle'
  | 'bladed_yoyo'
  | 'glass_shiv'
  | 'smoke_patch'
  | 'adrenal_patch'
  | 'fizz_bomb';

export type ItemDef = {
  id: ItemId;
  label: string;
  uses: number;
  verb: string;
  icon: ItemIcon;
  data?: Record<string, unknown>;
};

export type Item = ItemDef;

export const ITEM_ICON_SOURCES: Record<
  ItemIcon['key'],
  | { type: 'image'; path: string }
  | { type: 'sheet'; path: string; frameWidth: number; frameHeight: number }
> = {
  'item-matches': { type: 'image', path: 'assets/sprites/matches.png' },
  'item-knife': { type: 'image', path: 'assets/sprites/pocket_knife.png' },
  'item-soda': { type: 'image', path: 'assets/sprites/bottle.png' },
  'item-empty-bottle': { type: 'image', path: 'assets/sprites/empty_bottle.png' },
  'item-bandaid': { type: 'image', path: 'assets/sprites/bandaid.png' },
  'item-yoyo': { type: 'image', path: 'assets/sprites/yoyo.png' },
  items: { type: 'sheet', path: 'assets/sprites/new_items.png', frameWidth: 64, frameHeight: 64 },
};

export const ITEMS: Record<ItemId, ItemDef> = {
  match: {
    id: 'match',
    label: 'Match',
    uses: 2,
    verb: 'ignite',
    icon: { key: 'item-matches' },
  },
  knife: {
    id: 'knife',
    label: 'Pocket Knife',
    uses: 5,
    verb: 'slash',
    icon: { key: 'item-knife' },
  },
  soda: {
    id: 'soda',
    label: 'Soda',
    uses: 2,
    verb: 'drink',
    icon: { key: 'item-soda' },
  },
  bottle: {
    id: 'bottle',
    label: 'Empty Bottle',
    uses: 1,
    verb: 'throw',
    icon: { key: 'item-empty-bottle' },
  },
  bandaid: {
    id: 'bandaid',
    label: 'Bandaid',
    uses: 1,
    verb: 'heal',
    icon: { key: 'item-bandaid' },
  },
  yoyo: {
    id: 'yoyo',
    label: 'Yoyo',
    uses: 3,
    verb: 'swing',
    icon: { key: 'item-yoyo' },
  },
  tacks: {
    id: 'tacks',
    label: 'Thumb Tacks',
    uses: 3,
    verb: 'scatter',
    icon: { key: 'items', frame: 0 },
  },
  flashlight: {
    id: 'flashlight',
    label: 'Flashlight',
    uses: 4,
    verb: 'shine',
    icon: { key: 'items', frame: 1 },
  },
  sterile_wrap: {
    id: 'sterile_wrap',
    label: 'Sterile Wrap',
    uses: 1,
    verb: 'wrap',
    icon: { key: 'items', frame: 2 },
  },
  fire_bottle: {
    id: 'fire_bottle',
    label: 'Fire Bottle',
    uses: 1,
    verb: 'hurl',
    icon: { key: 'item-soda' },
  },
  bladed_yoyo: {
    id: 'bladed_yoyo',
    label: 'Bladed Yoyo',
    uses: 3,
    verb: 'reap',
    icon: { key: 'item-yoyo' },
  },
  glass_shiv: {
    id: 'glass_shiv',
    label: 'Glass Shiv',
    uses: 2,
    verb: 'stab',
    icon: { key: 'item-knife' },
  },
  smoke_patch: {
    id: 'smoke_patch',
    label: 'Smoke Patch',
    uses: 1,
    verb: 'mask',
    icon: { key: 'item-bandaid' },
  },
  adrenal_patch: {
    id: 'adrenal_patch',
    label: 'Adrenal Patch',
    uses: 1,
    verb: 'boost',
    icon: { key: 'item-bandaid' },
  },
  fizz_bomb: {
    id: 'fizz_bomb',
    label: 'Fizz Pop Bomb',
    uses: 1,
    verb: 'detonate',
    icon: { key: 'item-soda' },
  },
};

export function cloneItem(id: ItemId): Item {
  const def = ITEMS[id];
  return {
    ...def,
    data: { initialUses: def.uses, ...(def.data ?? {}) },
  };
}
