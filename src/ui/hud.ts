// ui/hud.ts  (replace the file contents with this version)

import type Phaser from 'phaser';
import { ROOM_W } from '@game/config';
import { ITEM_TEXTURE_KEYS } from '@game/items';
import type { Inventory, Item } from '@game/types';

export type HudShoveIndicator = {
  base: Phaser.GameObjects.Graphics;
  progress: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  center: { x: number; y: number };
  radius: number;
};

export type CraftPill = {
  root: Phaser.GameObjects.Container;
  show: (v: boolean) => void;
};

export type HudElements = {
  container: Phaser.GameObjects.Container;
  heartPlate: Phaser.GameObjects.Graphics;
  hearts: Phaser.GameObjects.Graphics;
  slotTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];    // now only the tiny “1” / “2” hints
  slotIcons: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  slotUseDots: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics];
  craftPill: CraftPill;
  shoveIndicator: HudShoveIndicator;
  controlsOverlay: { show: () => void; hide: () => void };
};

export type HudUpdateOptions = {
  shoveCooldown?: { remainingMs: number; durationMs: number };
  canCraft?: boolean;                    // <— NEW: pass true when slot A+B is a valid recipe
};

const PLATE_BG = 0x13171f;
const PLATE_STROKE = 0x2a3242;

export function createHUD(scene: Phaser.Scene, maxHp: number): HudElements {
  const container = scene.add.container(0, 0);
  container.setDepth(1000).setScrollFactor(0);

  // ── Heart plate (top-left, minimal)
  const heartPlate = scene.add.graphics();
  heartPlate
    .fillStyle(PLATE_BG, 0.7)
    .fillRoundedRect(12, 12, 160, 28, 8)
    .lineStyle(1, PLATE_STROKE, 1)
    .strokeRoundedRect(12, 12, 160, 28, 8);
  container.add(heartPlate);

  const hearts = scene.add.graphics().setScrollFactor(0);
  container.add(hearts);

  // ── Slot chips (bottom-left): icon + tiny “1/2” + pips
  const makeChip = (x: number, keyHint: string) => {
    const plate = scene.add.graphics();
    plate
      .fillStyle(PLATE_BG, 0.7)
      .fillRoundedRect(x, scene.scale.height - 44, 72, 24, 8)
      .lineStyle(1, PLATE_STROKE, 1)
      .strokeRoundedRect(x, scene.scale.height - 44, 72, 24, 8);
    container.add(plate);

    const hint = scene.add.text(x + 6, scene.scale.height - 42, keyHint, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#b7c0d1',
    }).setScrollFactor(0);
    container.add(hint);

    const icon = scene.add.image(x + 30, scene.scale.height - 32, ITEM_TEXTURE_KEYS.match)
      .setDisplaySize(20, 20).setVisible(false).setScrollFactor(0);
    container.add(icon);

    const uses = scene.add.graphics().setScrollFactor(0);
    container.add(uses);

    return { hint, icon, uses };
  };

  const chip1 = makeChip(16, '1');
  const chip2 = makeChip(96, '2');

  const slotIcons: HudElements['slotIcons'] = [chip1.icon, chip2.icon];
  const slotTexts: HudElements['slotTexts'] = [chip1.hint, chip2.hint];
  const slotUseDots: HudElements['slotUseDots'] = [chip1.uses, chip2.uses];

  // ── Contextual Craft pill (center-bottom; appears only when canCraft===true)
  const craftPillRoot = scene.add.container(scene.scale.width / 2, scene.scale.height - 40).setVisible(false);
  const craftBg = scene.add.rectangle(0, 0, 140, 26, 0xf6c353, 0.95).setOrigin(0.5);
  craftBg.setStrokeStyle(1, 0xe8833a, 1).setScrollFactor(0).setInteractive({ useHandCursor: true });
  const craftTxt = scene.add.text(0, 0, 'Craft  (R)', {
    fontFamily: 'monospace', fontSize: '12px', color: '#2d1c0a',
  }).setOrigin(0.5).setScrollFactor(0);
  craftPillRoot.add([craftBg, craftTxt]);
  container.add(craftPillRoot);
  scene.tweens.add({ targets: craftBg, alpha: { from: 0.85, to: 1 }, yoyo: true, duration: 1200, repeat: -1 });
  craftBg.on('pointerdown', () => scene.input.keyboard?.emit('keydown-R'));
  const craftPill: CraftPill = { root: craftPillRoot, show: (v) => craftPillRoot.setVisible(v) };

  // ── Shove ring (keep your original, just anchor to the new overlay)
  const shoveRadius = 12;
  const shoveCenter = { x: ROOM_W - 28, y: 36 }; // tucked top-right near edge
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

  // ── Controls overlay (hold Tab to view)
  const controlsOverlay = createControlsOverlay(scene);

  // initialize with empty inventory
  const initialInv: Inventory = [null, null];
  drawHUD(
    { container, heartPlate, hearts, slotTexts, slotIcons, slotUseDots, craftPill, shoveIndicator, controlsOverlay },
    maxHp, maxHp, initialInv,
  );

  // one-time hint
  const hint = scene.add.text(scene.scale.width - 12, scene.scale.height - 18, 'Press Tab for controls', {
    fontFamily: 'monospace', fontSize: '12px', color: '#b7c0d1',
  }).setOrigin(1, 1).setDepth(1001).setScrollFactor(0);
  scene.time.delayedCall(2000, () => hint.destroy());

  // Tab behavior
  scene.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => { e.preventDefault(); controlsOverlay.show(); });
  scene.input.keyboard?.on('keyup-TAB',   (e: KeyboardEvent) => { e.preventDefault(); controlsOverlay.hide(); });

  return { container, heartPlate, hearts, slotTexts, slotIcons, slotUseDots, craftPill, shoveIndicator, controlsOverlay };
}

function createControlsOverlay(scene: Phaser.Scene) {
  const root = scene.add.container(0,0).setDepth(2000).setScrollFactor(0).setVisible(false);
  const bg = scene.add.rectangle(0,0, scene.scale.width, scene.scale.height, 0x0b0d12, 0.75).setOrigin(0);
  const panel = scene.add.graphics().fillStyle(PLATE_BG, 0.9).fillRoundedRect(0,0, 300, 200, 10)
    .lineStyle(1, PLATE_STROKE, 1).strokeRoundedRect(0,0, 300, 200, 10);
  const cx = scene.scale.width/2, cy = scene.scale.height/2;
  panel.setPosition(cx-150, cy-100);

  const lines = [
    'Controls',
    'WASD: Move',
    'Mouse: Aim',
    'Left Click: Use Slot 1',
    'Right Click: Use Slot 2',
    'E: Pick Up / Search',
    'G: Drop Item',
    'R: Craft',
    'F: Shove',
  ];
  const text = scene.add.text(cx-150+16, cy-100+12, lines.join('\n'), {
    fontFamily:'monospace', fontSize:'12px', color:'#e6e6e6', lineSpacing: 4
  });

  root.add([bg, panel, text]);
  return {
    show(){ root.setVisible(true); },
    hide(){ root.setVisible(false); },
  };
}

function slotLabel(i: number, it: Item | null) {
  if (!it) return `${i + 1}`;
  return `${i + 1}`;
}

export function drawHUD(
  hud: HudElements,
  hp: number,
  maxHp: number,
  inv: Inventory,
  options: HudUpdateOptions = {},
) {
  const { hearts, slotTexts, slotIcons, slotUseDots, shoveIndicator, craftPill } = hud;

  // hearts
  hearts.clear();
  for (let i = 0; i < maxHp; i += 1) {
    const color = i < hp ? 0xff4d4d : 0x3c414e;
    hearts.fillStyle(color, 1).fillCircle(28 + i * 24, 26, 7);
  }

  // slots as chips: tiny label “1/2”, icon, and pips
  for (let i = 0; i < slotTexts.length; i += 1) {
    slotTexts[i].setText(slotLabel(i, inv[i]));
    slotUseDots[i].clear().setVisible(false);

    const item = inv[i];
    if (item) {
      slotIcons[i].setTexture(item.icon).setDisplaySize(20, 20).setVisible(true);

      const totalUses = (item.data as { initialUses?: number } | undefined)?.initialUses ?? item.uses;
      if (totalUses > 0) {
        const spacing = 5;
        const radius = 1.8;
        const baseX = slotIcons[i].x + 18 - (Math.min(totalUses, 5) * spacing);
        const y = slotIcons[i].y;
        slotUseDots[i].fillStyle(0xe6e6e6, 1);
        for (let dot = 0; dot < Math.min(totalUses, 5); dot += 1) {
          const filled = dot < Math.min(item.uses, 5);
          slotUseDots[i].fillStyle(filled ? 0xe6e6e6 : 0x555555, 1);
          slotUseDots[i].fillCircle(baseX + dot * spacing, y, radius);
        }
        slotUseDots[i].setVisible(true);
      }
    } else {
      slotIcons[i].setVisible(false);
    }
  }

  // craft pill visibility
  craftPill.show(!!options.canCraft);

  // shove ring (unchanged, just stylistically tweaked)
  const cooldown = options.shoveCooldown;
  const remaining = Math.max(cooldown?.remainingMs ?? 0, 0);
  const duration = Math.max(cooldown?.durationMs ?? 1, 1);
  const fraction = Math.min(Math.max(remaining / duration, 0), 1);
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
    const endAngle = startAngle + Math.PI * 2 * fraction;
    shoveIndicator.progress.fillStyle(0xfff275, 0.85);
    shoveIndicator.progress.beginPath();
    shoveIndicator.progress.moveTo(shoveIndicator.center.x, shoveIndicator.center.y);
    shoveIndicator.progress.arc(
      shoveIndicator.center.x,
      shoveIndicator.center.y,
      shoveIndicator.radius - 2,
      startAngle,
      endAngle,
      false,
    );
    shoveIndicator.progress.closePath();
    shoveIndicator.progress.fillPath();
  }

  shoveIndicator.label.setColor(ready ? '#ffffff' : '#cccccc').setAlpha(ready ? 1 : 0.85);
}
