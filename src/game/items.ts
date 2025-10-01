export type ItemIcon = { key: string; frame?: number };

export type ItemId =
  | 'flare'
  | 'stapler'
  | 'saline'
  | 'cooking_oil'
  | 'tape_roll'
  | 'dust_pillow'
  | 'salt'
  | 'ledger_spike'
  | 'ink_smoke'
  | 'brined_salt'
  | 'ledger_bomb';

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
  flare: {
    id: 'flare',
    label: 'Flare',
    uses: 2,
    verb: 'ignite',
    icon: { key: 'item-matches' },
  },
  stapler: {
    id: 'stapler',
    label: 'Stapler',
    uses: 5,
    verb: 'slash',
    icon: { key: 'item-knife' },
  },
  saline: {
    id: 'saline',
    label: 'Saline',
    uses: 2,
    verb: 'drink',
    icon: { key: 'item-soda' },
  },
  cooking_oil: {
    id: 'cooking_oil',
    label: 'Cooking Oil',
    uses: 1,
    verb: 'throw',
    icon: { key: 'item-empty-bottle' },
  },
  tape_roll: {
    id: 'tape_roll',
    label: 'Tape Roll',
    uses: 1,
    verb: 'heal',
    icon: { key: 'item-bandaid' },
  },
  dust_pillow: {
    id: 'dust_pillow',
    label: 'Dust Pillow',
    uses: 3,
    verb: 'swing',
    icon: { key: 'item-yoyo' },
  },
  salt: {
    id: 'salt',
    label: 'Salt',
    uses: 1,
    verb: 'detonate',
    icon: { key: 'items', frame: 0 },
  },
  ledger_spike: {
    id: 'ledger_spike',
    label: 'Ledger Spike',
    uses: 2,
    verb: 'stab',
    icon: { key: 'items', frame: 1 },
  },
  ink_smoke: {
    id: 'ink_smoke',
    label: 'Ink Smoke',
    uses: 1,
    verb: 'mask',
    icon: { key: 'items', frame: 2 },
  },
  brined_salt: {
    id: 'brined_salt',
    label: 'Brined Salt',
    uses: 1,
    verb: 'boost',
    icon: { key: 'item-bandaid' },
  },
  ledger_bomb: {
    id: 'ledger_bomb',
    label: 'Ledger Bomb',
    uses: 1,
    verb: 'hurl',
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
