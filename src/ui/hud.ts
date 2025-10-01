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

export type HudElements = {
  container: Phaser.GameObjects.Container;
  hearts: Phaser.GameObjects.Graphics;
  slotTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  slotIcons: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  slotUseDots: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Graphics];
  shoveIndicator: HudShoveIndicator;
};

export type HudUpdateOptions = {
  shoveCooldown?: {
    remainingMs: number;
    durationMs: number;
  };
};

export function createHUD(scene: Phaser.Scene, maxHp: number): HudElements {
  const container = scene.add.container(0, 0);
  container.setDepth(1000);
  container.setScrollFactor(0);

  const frame = scene.add.graphics();
  frame.fillStyle(0x111111, 0.6).fillRoundedRect(12, 12, 280, 84, 10);
  frame.lineStyle(1, 0x999999, 0.8).strokeRoundedRect(20, 58, 120, 28, 6);
  frame.strokeRoundedRect(160, 58, 120, 28, 6);
  frame.setScrollFactor(0);
  container.add(frame);

  const controlsPanel = scene.add.graphics();
  controlsPanel
    .fillStyle(0x111111, 0.6)
    .fillRoundedRect(ROOM_W - 244, 12, 232, 156, 8)
    .lineStyle(1, 0x999999, 0.8)
    .strokeRoundedRect(ROOM_W - 242, 14, 228, 152, 8);
  controlsPanel.setScrollFactor(0);
  container.add(controlsPanel);

  const hearts = scene.add.graphics();
  hearts.setScrollFactor(0);
  container.add(hearts);

  const makeSlotElements = (x: number, idx: number) => {
    const icon = scene.add.image(x + 30, 74, ITEM_TEXTURE_KEYS.match);
    icon.setDisplaySize(20, 20);
    icon.setScrollFactor(0);
    icon.setVisible(false);
    container.add(icon);

    const text = scene.add.text(x + 48, 60, `${idx + 1}: —`, {
      fontFamily: 'monospace',
      fontSize: '12px',
      wordWrap: { width: 84 },
    });
    text.setOrigin(0, 0);
    text.setLineSpacing(2);
    text.setScrollFactor(0);
    container.add(text);
    const uses = scene.add.graphics();
    uses.setScrollFactor(0);
    container.add(uses);
    return { icon, text, uses };
  };

  const slotElements = [makeSlotElements(20, 0), makeSlotElements(160, 1)] as const;
  const slotIcons: HudElements['slotIcons'] = [slotElements[0].icon, slotElements[1].icon];
  const slotTexts: HudElements['slotTexts'] = [slotElements[0].text, slotElements[1].text];
  const slotUseDots: HudElements['slotUseDots'] = [slotElements[0].uses, slotElements[1].uses];

  const controlLines = [
    'Controls',
    'WASD: Move',
    'Mouse: Aim',
    'Left Click: Use Slot 1',
    'Right Click: Use Slot 2',
    'E: Pick Up / Search',
    'G: Drop Item',
    'R: Craft',
  ];

  const controlTextStyle: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: 'monospace',
    fontSize: '12px',
    align: 'right',
  };

  const lineHeight = 16;
  controlLines.forEach((line, index) => {
    const text = scene
      .add.text(ROOM_W - 24, 24 + index * lineHeight, line, controlTextStyle)
      .setOrigin(1, 0);
    text.setScrollFactor(0);
    text.setLineSpacing(4);
    container.add(text);
  });

  const shoveText = scene
    .add.text(ROOM_W - 24, 24 + controlLines.length * lineHeight, 'Shove', controlTextStyle)
    .setOrigin(1, 0);
  shoveText.setScrollFactor(0);
  container.add(shoveText);

  const shoveRadius = 12;
  const shoveCenter = {
    x: shoveText.x - shoveText.displayWidth - shoveRadius - 8,
    y: shoveText.y + shoveText.displayHeight / 2,
  };

  const shoveBase = scene.add.graphics();
  shoveBase.setScrollFactor(0);
  container.add(shoveBase);

  const shoveProgress = scene.add.graphics();
  shoveProgress.setScrollFactor(0);
  container.add(shoveProgress);

  const shoveLabel = scene
    .add.text(shoveCenter.x, shoveCenter.y, 'F', {
      fontFamily: 'monospace',
      fontSize: '12px',
      align: 'center',
    })
    .setOrigin(0.5);
  shoveLabel.setScrollFactor(0);
  container.add(shoveLabel);

  // initialize once so the HUD starts with correct values
  const initialInv: Inventory = [null, null];
  const shoveIndicator: HudShoveIndicator = {
    base: shoveBase,
    progress: shoveProgress,
    label: shoveLabel,
    center: shoveCenter,
    radius: shoveRadius,
  };

  drawHUD(
    { container, hearts, slotTexts, slotIcons, slotUseDots, shoveIndicator },
    maxHp,
    maxHp,
    initialInv,
  );

  return { container, hearts, slotTexts, slotIcons, slotUseDots, shoveIndicator };
}

function slotLabel(i: number, it: Item | null) {
  if (!it) return `${i + 1}: —`;
  return `${i + 1}: ${it.label}`;
}

export function drawHUD(
  hud: HudElements,
  hp: number,
  maxHp: number,
  inv: Inventory,
  options: HudUpdateOptions = {},
) {
  const { hearts, slotTexts, slotIcons, slotUseDots, shoveIndicator } = hud;

  hearts.clear();
  for (let i = 0; i < maxHp; i += 1) {
    const color = i < hp ? 0xff4d4d : 0x444444;
    hearts.fillStyle(color, 1).fillCircle(28 + i * 20, 32, 7);
  }

  for (let i = 0; i < slotTexts.length; i += 1) {
    const item = inv[i];
    slotTexts[i].setText(slotLabel(i, item));
    slotUseDots[i].clear();
    slotUseDots[i].setVisible(false);
    if (item) {
      slotIcons[i].setTexture(item.icon);
      slotIcons[i].setDisplaySize(20, 20);
      slotIcons[i].setVisible(true);

      const totalUses = (item.data as { initialUses?: number } | undefined)?.initialUses ?? item.uses;
      if (totalUses > 0) {
        const spacing = 8;
        const radius = 3;
        const startX = slotIcons[i].x - ((totalUses - 1) * spacing) / 2;
        const y = slotIcons[i].y + 12;
        slotUseDots[i].fillStyle(0xfff275, 1);
        for (let dot = 0; dot < totalUses; dot += 1) {
          if (dot < item.uses) {
            const x = startX + dot * spacing;
            slotUseDots[i].fillCircle(x, y, radius);
          }
        }
        slotUseDots[i].setVisible(item.uses > 0);
      }
    } else {
      slotIcons[i].setVisible(false);
    }
  }

  const cooldown = options.shoveCooldown;
  const remaining = Math.max(cooldown?.remainingMs ?? 0, 0);
  const duration = Math.max(cooldown?.durationMs ?? 1, 1);
  const fraction = Math.min(Math.max(remaining / duration, 0), 1);
  const ready = fraction <= 0;

  shoveIndicator.base.clear();
  const baseStrokeColor = ready ? 0xfff275 : 0x666666;
  const baseStrokeAlpha = ready ? 0.95 : 0.65;
  shoveIndicator.base
    .fillStyle(0x111111, ready ? 0.55 : 0.35)
    .fillCircle(shoveIndicator.center.x, shoveIndicator.center.y, shoveIndicator.radius)
    .lineStyle(1.5, baseStrokeColor, baseStrokeAlpha)
    .strokeCircle(shoveIndicator.center.x, shoveIndicator.center.y, shoveIndicator.radius);

  shoveIndicator.progress.clear();
  if (!ready) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * fraction;
    shoveIndicator.progress.fillStyle(0xfff275, 0.8);
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

  shoveIndicator.label.setColor(ready ? '#ffffff' : '#cccccc');
  shoveIndicator.label.setAlpha(ready ? 1 : 0.85);
}
