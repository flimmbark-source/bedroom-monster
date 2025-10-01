import type Phaser from 'phaser';
import { ROOM_W } from '@game/config';
import type { Inventory } from '@game/types';
import { ITEMS, cloneItem, type Item } from '@game/items';
import { craft } from '@game/recipes';
import { watchKeys, getKeyMetadata, type KeyId } from '@game/keys';

export type HudShoveIndicator = {
  base: Phaser.GameObjects.Graphics;
  progress: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  center: { x: number; y: number };
  radius: number;
};

export type HudElements = {
  container: Phaser.GameObjects.Container;
  heartPlate: Phaser.GameObjects.Graphics;
  hearts: Phaser.GameObjects.Graphics;

  slotPills: [
    { root: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; pips: Phaser.GameObjects.Graphics; w:number; h:number; },
    { root: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; pips: Phaser.GameObjects.Graphics; w:number; h:number; }
  ];

  craftPreview: {
    root: Phaser.GameObjects.Container;
    icon: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.Text;
    show: (v: boolean) => void;
    w:number; h:number;
  };

  shoveIndicator: HudShoveIndicator;

  keyBadges: {
    root: Phaser.GameObjects.Container;
    setKeys: (keys: KeyId[]) => void;
    dispose: () => void;
  };
};

export type HudUpdateOptions = {
  shoveCooldown?: { remainingMs: number; durationMs: number };
  keys?: KeyId[];
};

const PLATE_BG  = 0x13171f;
const PLATE_STK = 0x2a3242;
const TEXT_MAIN = '#e6e6e6';
const TEXT_DIM  = '#9aa3b2';

function setIcon(image: Phaser.GameObjects.Image, item: Item | null) {
  if (!item) { image.setVisible(false); return; }

  const { icon } = item;
  if (icon && image.scene.textures.exists(icon.key)) {
    image.setTexture(icon.key, icon.frame).setVisible(true);
  } else {
    // Unknown texture key → hide to avoid black box
    image.setVisible(false);
  }
}

export function createHUD(scene: Phaser.Scene, maxHp: number): HudElements {
  const container = scene.add.container(0,0).setDepth(1000).setScrollFactor(0);

  // Hearts plate (top-left)
  const heartPlate = scene.add.graphics();
  heartPlate.fillStyle(PLATE_BG, 0.7).fillRoundedRect(12, 12, 160, 28, 8)
            .lineStyle(1, PLATE_STK, 1).strokeRoundedRect(12, 12, 160, 28, 8);
  container.add(heartPlate);

  const hearts = scene.add.graphics().setScrollFactor(0);
  container.add(hearts);

  // Small item pills just under hearts
  const makePill = (x:number, y:number) => {
    const w = 150, h = 22;
    const root = scene.add.container(x, y).setScrollFactor(0);

    const bg = scene.add.graphics();
    bg.fillStyle(PLATE_BG, 0.7).fillRoundedRect(0, 0, w, h, 7)
      .lineStyle(1, PLATE_STK, 1).strokeRoundedRect(0, 0, w, h, 7);

    const icon = scene.add.image(10 + 8, h/2, '').setDisplaySize(2.5,2.5).setVisible(false);
    const name = scene.add.text(10 + 8 + 12, h/2, '', {
      fontFamily: 'monospace', fontSize: '11px', color: TEXT_MAIN, wordWrap: { width: w - 60 },
    }).setOrigin(0, 0.5);
    const pips = scene.add.graphics();

    root.add([bg, icon, name, pips]);
    container.add(root);
    return { root, icon, name, pips, w, h };
  };

  // Position: directly below HP bar, stacked
  const pillX = 12;
  const pill1 = makePill(pillX, 12 + 28 + 6);     // HP plate bottom + gap
  const pill2 = makePill(pillX, 12 + 28 + 6 + 24);

  // Key badge row (beneath inventory pills)
  const badgeRowY = pill2.root.y + pill2.h + 8;
  const keyBadgeRoot = scene.add.container(pillX, badgeRowY).setScrollFactor(0);
  container.add(keyBadgeRoot);

  type BadgeVisual = {
    root: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Graphics;
    icon: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
  };

  const badgePool: BadgeVisual[] = [];
  const badgeWidth = 60;
  const badgeHeight = 20;
  const badgeGap = 6;

  const drawIcon = (graphics: Phaser.GameObjects.Graphics, color: number) => {
    graphics.clear();
    const baseX = 10;
    const centerY = badgeHeight / 2;
    const shaftWidth = 9;
    const shaftHeight = 3;
    const rimColor = 0x101820;
    graphics.fillStyle(color, 0.85);
    graphics.fillCircle(baseX, centerY, 4);
    graphics.lineStyle(1, rimColor, 0.9).strokeCircle(baseX, centerY, 4);
    graphics.fillStyle(rimColor, 0.85);
    graphics.fillRect(baseX + 3, centerY - shaftHeight / 2, shaftWidth, shaftHeight);
    graphics.fillRect(baseX + shaftWidth + 2, centerY - shaftHeight, 2, shaftHeight * 2);
    graphics.fillStyle(0xffffff, 0.2);
    graphics.fillCircle(baseX - 1, centerY - 1, 1.3);
  };

  const ensureBadge = (index: number): BadgeVisual => {
    if (badgePool[index]) return badgePool[index];
    const root = scene.add.container(index * (badgeWidth + badgeGap), 0).setScrollFactor(0).setVisible(false);
    const bg = scene.add.graphics();
    const icon = scene.add.graphics();
    const label = scene.add.text(24, badgeHeight / 2, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#101820',
    }).setOrigin(0, 0.5);
    root.add([bg, icon, label]);
    keyBadgeRoot.add(root);
    const visual: BadgeVisual = { root, bg, icon, label };
    badgePool.push(visual);
    return visual;
  };

  const updateBadges = (keys: KeyId[]) => {
    for (let i = 0; i < keys.length; i += 1) {
      const badge = ensureBadge(i);
      const meta = getKeyMetadata(keys[i]);
      badge.root.setPosition(i * (badgeWidth + badgeGap), 0);
      badge.bg.clear();
      badge.bg.fillStyle(meta.color, 0.92).fillRoundedRect(0, 0, badgeWidth, badgeHeight, 6);
      badge.bg.lineStyle(1, 0x1a202b, 0.9).strokeRoundedRect(0, 0, badgeWidth, badgeHeight, 6);
      drawIcon(badge.icon, meta.color);
      badge.label.setText(meta.shortLabel).setColor('#101820');
      badge.root.setVisible(true);
    }
    for (let i = keys.length; i < badgePool.length; i += 1) {
      badgePool[i].root.setVisible(false);
    }
  };

  const stopWatch = watchKeys(updateBadges);
  let disposed = false;
  const disposeBadges = () => {
    if (disposed) return;
    disposed = true;
    stopWatch();
    badgePool.forEach((badge) => {
      badge.root.destroy();
      badge.bg.destroy();
      badge.icon.destroy();
      badge.label.destroy();
    });
    keyBadgeRoot.destroy();
  };
  scene.events.once('shutdown', disposeBadges);

  // Craft preview (top-center) — compact
  const cpW = 220, cpH = 24;
  const cpRoot = scene.add.container(scene.scale.width/2, 10).setScrollFactor(0).setDepth(1001).setVisible(false);
  const cpBg = scene.add.graphics();
  cpBg.fillStyle(0xf6c353, 0.95).fillRoundedRect(-cpW/2, 0, cpW, cpH, 8)
      .lineStyle(1, 0xe8833a, 1).strokeRoundedRect(-cpW/2, 0, cpW, cpH, 8);
  const cpIcon = scene.add.image(-cpW/2 + 10 + 8, cpH/2, '').setDisplaySize(2.5,2.5).setVisible(false);
  const cpName = scene.add.text(-cpW/2 + 10 + 8 + 12, cpH/2, '', {
    fontFamily: 'monospace', fontSize: '11px', color: '#2d1c0a',
  }).setOrigin(0, 0.5);
  cpRoot.add([cpBg, cpIcon, cpName]);
  container.add(cpRoot);
  scene.tweens.add({ targets: cpBg, alpha: { from: 0.85, to: 1 }, yoyo: true, duration: 1100, repeat: -1 });

  const craftPreview = {
    root: cpRoot, icon: cpIcon, name: cpName,
    show(v:boolean){ cpRoot.setVisible(v); },
    w: cpW, h: cpH,
  };

  // Shove ring (top-right)
  const shoveRadius = 12;
  const shoveCenter = { x: ROOM_W - 28, y: 36 };
  const shoveBase = scene.add.graphics().setScrollFactor(0);
  const shoveProgress = scene.add.graphics().setScrollFactor(0);
  const shoveLabel = scene.add.text(shoveCenter.x, shoveCenter.y, 'F', {
    fontFamily: 'monospace', fontSize: '12px', align: 'center',
  }).setOrigin(0.5).setScrollFactor(0);
  container.add(shoveBase); container.add(shoveProgress); container.add(shoveLabel);

  const shoveIndicator: HudShoveIndicator = {
    base: shoveBase, progress: shoveProgress, label: shoveLabel,
    center: shoveCenter, radius: shoveRadius,
  };

  // Initial draw
  const initialInv: Inventory = [null, null];
  drawHUD(
    {
      container,
      heartPlate,
      hearts,
      slotPills: [pill1 as any, pill2 as any],
      craftPreview,
      shoveIndicator,
      keyBadges: { root: keyBadgeRoot, setKeys: updateBadges, dispose: disposeBadges },
    },
    maxHp,
    maxHp,
    initialInv,
  );

  return {
    container,
    heartPlate,
    hearts,
    slotPills: [pill1 as any, pill2 as any],
    craftPreview,
    shoveIndicator,
    keyBadges: { root: keyBadgeRoot, setKeys: updateBadges, dispose: disposeBadges },
  };
}

function setPill(
  pill: { icon: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; pips: Phaser.GameObjects.Graphics; w:number; h:number },
  item: Item | null
) {
  pill.pips.clear();
  if (!item) {
    pill.icon.setVisible(false);
    pill.name.setText('').setColor(TEXT_DIM);
    return;
  }

  // icon + name
  setIcon(pill.icon, item);
  pill.name.setText(item.label).setColor(TEXT_MAIN);

  // uses pips (max 5 visible)
  const totalUses = (item.data as { initialUses?: number } | undefined)?.initialUses ?? item.uses;
  if (totalUses > 0) {
    const shown = Math.min(totalUses, 5);
    const spacing = 5;
    const r = 1.6;
    const startX = pill.w - (shown * spacing) - 10;
    const y = pill.h / 2;
    for (let i=0; i<shown; i++){
      const filled = i < Math.min(item.uses, 5);
      pill.pips.fillStyle(filled ? 0xe6e6e6 : 0x555555, 1);
      pill.pips.fillCircle(startX + i*spacing, y, r);
    }
  }
}

export function drawHUD(
  hud: HudElements,
  hp: number,
  maxHp: number,
  inv: Inventory,
  options: HudUpdateOptions = {},
) {
  const { hearts, slotPills, craftPreview, shoveIndicator, keyBadges } = hud;

  // Hearts
  hearts.clear();
  for (let i = 0; i < maxHp; i++) {
    const color = i < hp ? 0xff4d4d : 0x3c414e;
    hearts.fillStyle(color, 1).fillCircle(28 + i * 24, 26, 7);
  }

  // Inventory pills
  setPill(slotPills[0], inv[0]);
  setPill(slotPills[1], inv[1]);

  // Craft preview pill (top-center) — only if recipe exists
  const outId = craft(inv[0]?.id ?? null, inv[1]?.id ?? null);
  const def = outId ? ITEMS[outId] : undefined;
  const showCraft = Boolean(def);
  if (def) {
    const fakeItem = cloneItem(outId);
    setIcon(craftPreview.icon, fakeItem);
    craftPreview.name.setText(def.label ? `Craft: ${def.label}` : 'Craft');
  }
  craftPreview.show(showCraft);

  if (options.keys) {
    keyBadges.setKeys(options.keys);
  }

  // Shove cooldown
  const cd = options.shoveCooldown;
  const remaining = Math.max(cd?.remainingMs ?? 0, 0);
  const duration  = Math.max(cd?.durationMs ?? 1, 1);
  const fraction  = Math.min(Math.max(remaining / duration, 0), 1);
  const ready = fraction <= 0;

  shoveIndicator.base.clear();
  const baseStrokeColor = ready ? 0xfff275 : 0x666666;
  const baseStrokeAlpha = ready ? 0.95 : 0.65;
  shoveIndicator.base
    .fillStyle(PLATE_BG, ready ? 0.55 : 0.35)
    .fillCircle(shoveIndicator.center.x, shoveIndicator.center.y, shoveIndicator.radius)
    .lineStyle(1.5, baseStrokeColor, baseStrokeAlpha)
    .strokeCircle(shoveIndicator.center.x, shoveIndicator.center.y, shoveIndicator.radius);

  shoveIndicator.progress.clear();
  if (!ready) {
    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + Math.PI * 2 * fraction;
    shoveIndicator.progress.fillStyle(0xfff275, 0.85);
    shoveIndicator.progress.beginPath();
    shoveIndicator.progress.moveTo(shoveIndicator.center.x, shoveIndicator.center.y);
    shoveIndicator.progress.arc(
      shoveIndicator.center.x, shoveIndicator.center.y, shoveIndicator.radius - 2,
      startAngle, endAngle, false
    );
    shoveIndicator.progress.closePath();
    shoveIndicator.progress.fillPath();
  }
  shoveIndicator.label.setColor(ready ? '#ffffff' : '#cccccc').setAlpha(ready ? 1 : 0.85);
}
