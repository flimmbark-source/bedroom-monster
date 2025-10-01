import type Phaser from 'phaser';
import type { KeyId } from './world';

export type KeyMetadata = {
  id: KeyId;
  label: string;
  shortLabel: string;
  color: number;
};

const KEY_METADATA: Record<KeyId, KeyMetadata> = {
  nurse_badge: {
    id: 'nurse_badge',
    label: 'Nurse Badge',
    shortLabel: 'NB',
    color: 0x7dd6ff,
  },
  admin_badge: {
    id: 'admin_badge',
    label: 'Admin Badge',
    shortLabel: 'AB',
    color: 0xffcf73,
  },
  pantry_key: {
    id: 'pantry_key',
    label: 'Pantry Key',
    shortLabel: 'PK',
    color: 0xe88f52,
  },
  front_door_key: {
    id: 'front_door_key',
    label: 'Front Door Key',
    shortLabel: 'FD',
    color: 0xa0e076,
  },
};

const KEY_ORDER: KeyId[] = ['nurse_badge', 'admin_badge', 'pantry_key', 'front_door_key'];

export type KeyListener = (keys: KeyId[]) => void;

const ownedKeys = new Set<KeyId>();
const listeners = new Set<KeyListener>();

function emitKeys() {
  const snapshot = KEY_ORDER.filter((key) => ownedKeys.has(key));
  listeners.forEach((listener) => listener([...snapshot]));
}

export function resetKeys() {
  if (ownedKeys.size === 0) return;
  ownedKeys.clear();
  emitKeys();
}

export function grantKey(id: KeyId): boolean {
  if (ownedKeys.has(id)) return false;
  ownedKeys.add(id);
  emitKeys();
  return true;
}

export function hasKey(id: KeyId): boolean {
  return ownedKeys.has(id);
}

export function consumeKey(id: KeyId): boolean {
  if (!ownedKeys.has(id)) return false;
  ownedKeys.delete(id);
  emitKeys();
  return true;
}

export function watchKeys(listener: KeyListener, emitCurrent = true): () => void {
  listeners.add(listener);
  if (emitCurrent) {
    const snapshot = KEY_ORDER.filter((key) => ownedKeys.has(key));
    listener([...snapshot]);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getKeyMetadata(id: KeyId): KeyMetadata {
  return KEY_METADATA[id];
}

export function renderKeyBadge(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  key: KeyId,
  index: number,
  options: { width?: number; height?: number; gap?: number } = {},
) {
  const { width = 34, height = 18, gap = 6 } = options;
  const meta = getKeyMetadata(key);
  const root = scene.add.container(index * (width + gap), 0);
  const bg = scene.add.graphics();
  bg.fillStyle(meta.color, 0.9).fillRoundedRect(0, 0, width, height, 6);
  bg.lineStyle(1, 0x101820, 0.85).strokeRoundedRect(0, 0, width, height, 6);

  const label = scene.add.text(width / 2, height / 2, meta.shortLabel, {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#13171f',
  });
  label.setOrigin(0.5);

  root.add([bg, label]);
  container.add(root);
}

export { KEY_ORDER, KEY_METADATA };
